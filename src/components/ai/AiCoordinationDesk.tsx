"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Bot,
  MapPin,
  Package,
  Route,
  Sparkles,
  TrendingUp,
  Truck,
  Wheat,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatQuantity } from "@/lib/utils";
import {
  evaluateOpportunities,
  harvestWindowAdvisory,
  ingestFarmerOffer,
  parseBuyerIntent,
  planMultiStopRoute,
  type FarmerOffer,
  type HarvestAdvisory,
  type RoutePlan,
  type SellingOpportunity,
} from "@/lib/ai";
import { matchListings } from "@/lib/matching";
import { buyerCost } from "@/lib/pricing";
import { listings as demoListings } from "@/lib/demo-data";
import { useListings } from "@/lib/useListings";
import { addMyListing } from "@/lib/listings-store";
import { useLanguage } from "@/components/shared/LanguageProvider";
import type { Listing, MatchBreakdown } from "@/types";

type Mode = "farmer" | "buyer";

type BuyerMatchRow = {
  listing: Listing;
  breakdown: MatchBreakdown;
  fillQty: number;
  buyerEconomics: ReturnType<typeof buyerCost>;
};

const FARMER_EXAMPLES = [
  "I have 200 kg Grade-A tomatoes near Warangal, want ₹28/kg this week",
  "500 kg red onions from Nashik, expecting ₹24 per kg, available next week",
  "2 tonnes Sona Masoori paddy Grade 1, asking ₹32/kg, ready now",
];

const BUYER_EXAMPLES = [
  "Need 150 kg Grade A tomatoes under ₹30/kg near Hyderabad this week",
  "Looking for 400 kg onions within 100 km, budget ₹26/kg",
  "Buy 800 kg Grade 1 mangoes under ₹90/kg by next week",
];

function ScoreBars({ breakdown }: { breakdown: MatchBreakdown | SellingOpportunity["score"] }) {
  const parts: { key: string; value: number; max: number }[] = [
    { key: "Price", value: breakdown.price, max: 25 },
    { key: "Qty", value: breakdown.quantity, max: 25 },
    { key: "Quality", value: breakdown.quality, max: 20 },
    { key: "Distance", value: breakdown.distance, max: 15 },
    { key: "Timeline", value: breakdown.timeline, max: 15 },
  ];
  return (
    <div className="mt-3 grid gap-1.5">
      {parts.map((p) => (
        <div key={p.key} className="flex items-center gap-2 text-[11px]">
          <span className="w-14 shrink-0 font-mono text-slate-500 dark:text-neutral-400">
            {p.key}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-stone-100 dark:bg-neutral-800">
            <div
              className="h-full rounded bg-emerald-600"
              style={{ width: `${Math.min(100, (p.value / p.max) * 100)}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-slate-600 dark:text-neutral-300">
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function AdvisoryCard({ advisory }: { advisory: HarvestAdvisory }) {
  const tone =
    advisory.tone === "sell_now"
      ? "emerald"
      : advisory.tone === "hold"
        ? "amber"
        : "orange";
  return (
    <Card className="p-5">
      <p className="font-mono text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        Harvest sales window
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h3 className="font-display text-xl font-bold">{advisory.headline}</h3>
        <Badge tone={tone}>{advisory.label}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-neutral-300">
        {advisory.detail}
      </p>
      <p className="mt-3 font-mono text-xs text-slate-500 dark:text-neutral-400">
        Suggested sell-by · {advisory.suggestedUntil}
      </p>
    </Card>
  );
}

function RouteCard({ route }: { route: RoutePlan }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Route size={18} className="text-emerald-700" />
        <h3 className="font-display text-lg font-bold">Multi-stop logistics plan</h3>
      </div>
      <ol className="mt-4 space-y-2">
        {route.stops.map((stop, i) => (
          <li key={`${stop}-${i}`} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 font-mono text-[10px] font-bold text-emerald-800">
              {i + 1}
            </span>
            <span>{stop}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="font-mono text-lg font-bold">{route.distanceKm} km</p>
          <p className="text-[11px] text-slate-500">route</p>
        </div>
        <div>
          <p className="font-mono text-lg font-bold">~{route.durationMins}m</p>
          <p className="text-[11px] text-slate-500">ETA</p>
        </div>
        <div>
          <p className="font-mono text-lg font-bold text-emerald-800 dark:text-emerald-400">
            {formatCurrency(route.combinedNet)}
          </p>
          <p className="text-[11px] text-slate-500">batched net</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-neutral-400">
        Logistics {formatCurrency(route.logisticsCost)} · {route.explanation}
      </p>
    </Card>
  );
}

export function AiCoordinationDesk() {
  const { t } = useLanguage();
  const { listings } = useListings();
  const [mode, setMode] = useState<Mode>("farmer");
  const [text, setText] = useState(FARMER_EXAMPLES[0]);
  const [pending, startTransition] = useTransition();
  const [offer, setOffer] = useState<FarmerOffer | null>(null);
  const [opps, setOpps] = useState<SellingOpportunity[]>([]);
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [advisory, setAdvisory] = useState<HarvestAdvisory | null>(null);
  const [buyerMatches, setBuyerMatches] = useState<BuyerMatchRow[]>([]);
  const [buyerSummary, setBuyerSummary] = useState("");
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const pool = useMemo(
    () => (listings.length ? listings : demoListings),
    [listings],
  );

  const run = () => {
    startTransition(() => {
      setPublishedId(null);
      if (mode === "farmer") {
        const next = ingestFarmerOffer(text);
        const ranked = evaluateOpportunities(next);
        setOffer(next);
        setOpps(ranked);
        setRoute(planMultiStopRoute(ranked, 3));
        setAdvisory(harvestWindowAdvisory(next, ranked));
        setBuyerMatches([]);
        setBuyerSummary("");
      } else {
        const intent = parseBuyerIntent(text);
        const matches = matchListings(pool, intent)
          .slice(0, 6)
          .map((m) => {
            const fillQty = Math.min(intent.qty, m.listing.quantity);
            return {
              ...m,
              fillQty,
              buyerEconomics: buyerCost(
                m.listing.price,
                fillQty,
                m.listing.distance,
              ),
            };
          });
        setOffer(null);
        setOpps([]);
        setRoute(null);
        setAdvisory(null);
        setBuyerMatches(matches);
        setBuyerSummary(intent.summary);
      }
    });
  };

  const publishOffer = () => {
    if (!offer || offer.quantity <= 0) return;
    const listing = addMyListing({
      variety: offer.variety,
      category: offer.category,
      quantity: offer.quantity,
      unit: offer.unit,
      grade: offer.grade,
      price: offer.expectedPrice,
      phone: "+91 90000 00000",
      availableUntil: offer.availableUntil,
    });
    setPublishedId(listing.id);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setText(next === "farmer" ? FARMER_EXAMPLES[0] : BUYER_EXAMPLES[0]);
    setOffer(null);
    setOpps([]);
    setRoute(null);
    setAdvisory(null);
    setBuyerMatches([]);
    setBuyerSummary("");
    setPublishedId(null);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            AI coordination · AIgnite
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t("Match produce to buyers — intelligently")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-neutral-300">
            Natural-language intake, multi-criteria matching, net-profit
            comparison, and multi-stop logistics — the challenge layer on top of
            the AgriLink marketplace.
          </p>
        </div>
        <div className="flex rounded-lg border border-stone-200 p-1 dark:border-neutral-700">
          <button
            type="button"
            onClick={() => switchMode("farmer")}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              mode === "farmer"
                ? "bg-emerald-700 text-white"
                : "text-slate-600 dark:text-neutral-300"
            }`}
          >
            Farmer agent
          </button>
          <button
            type="button"
            onClick={() => switchMode("buyer")}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              mode === "buyer"
                ? "bg-emerald-700 text-white"
                : "text-slate-600 dark:text-neutral-300"
            }`}
          >
            Buyer agent
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { Icon: Wheat, label: "NL profile ingestion" },
          { Icon: Sparkles, label: "Multi-criteria match" },
          { Icon: TrendingUp, label: "Net-profit ranking" },
          { Icon: Truck, label: "Route optimization" },
        ].map(({ Icon, label }) => (
          <Card key={label} className="flex items-center gap-3 p-4">
            <Icon size={18} className="text-emerald-700" />
            <p className="text-sm font-semibold">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-7 p-5">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-emerald-700" />
          <h2 className="font-display text-xl font-bold">
            {mode === "farmer"
              ? "Describe your produce in plain language"
              : "Describe what you need to buy"}
          </h2>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="mt-4 w-full rounded-lg border border-slate-300 bg-stone-50 p-3 text-sm leading-6 outline-none focus:border-emerald-600 dark:border-neutral-700 dark:bg-neutral-950"
          placeholder={
            mode === "farmer" ? FARMER_EXAMPLES[0] : BUYER_EXAMPLES[0]
          }
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {(mode === "farmer" ? FARMER_EXAMPLES : BUYER_EXAMPLES).map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="rounded-full border border-stone-200 px-3 py-1 text-left text-xs text-slate-600 hover:border-emerald-600 hover:text-emerald-800 dark:border-neutral-700 dark:text-neutral-300"
            >
              {ex.length > 56 ? `${ex.slice(0, 56)}…` : ex}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={run} disabled={pending || !text.trim()}>
            {pending
              ? "Analyzing…"
              : mode === "farmer"
                ? "Find selling opportunities"
                : "Rank farm matches"}
          </Button>
          {mode === "farmer" && offer && offer.quantity > 0 && (
            <Button variant="secondary" onClick={publishOffer}>
              Publish as listing
            </Button>
          )}
          {publishedId && (
            <Link
              href={`/marketplace/${publishedId}`}
              className="inline-flex items-center text-sm font-bold text-emerald-800 dark:text-emerald-400"
            >
              View live listing →
            </Link>
          )}
        </div>
      </Card>

      {offer && (
        <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card className="p-5">
            <p className="font-mono text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Structured offer · {offer.confidence}% confidence
            </p>
            <h3 className="mt-2 font-display text-2xl font-bold">
              {offer.variety}
            </h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Quantity</dt>
                <dd className="font-mono font-bold">
                  {formatQuantity(offer.quantity, offer.unit)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Ask / market</dt>
                <dd className="font-mono font-bold">
                  {formatCurrency(offer.expectedPrice)} /{" "}
                  {formatCurrency(offer.marketPrice)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Grade</dt>
                <dd className="font-bold">{offer.grade}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Location</dt>
                <dd className="font-bold">{offer.location}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Availability</dt>
                <dd className="font-mono text-sm font-bold">
                  {offer.availableFrom} → {offer.availableUntil}
                </dd>
              </div>
            </dl>
            {offer.fieldsDetected.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {offer.fieldsDetected.map((f) => (
                  <Badge key={f} tone="emerald">
                    {f}
                  </Badge>
                ))}
              </div>
            )}
            {offer.missing.length > 0 && (
              <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">
                Missing: {offer.missing.join(", ")}
              </p>
            )}
            {offer.notes.map((n) => (
              <p
                key={n}
                className="mt-2 text-xs leading-5 text-slate-600 dark:text-neutral-300"
              >
                {n}
              </p>
            ))}
          </Card>
          {advisory && <AdvisoryCard advisory={advisory} />}
        </div>
      )}

      {mode === "farmer" && opps.length > 0 && (
        <section className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold">
                Ranked selling opportunities
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
                Sorted by estimated farmer net (after logistics + 2.5% fee)
              </p>
            </div>
            <Badge tone="emerald">{opps.length} matches</Badge>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
            <div className="grid gap-4">
              {opps.map((o) => (
                <Card key={o.demand.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">
                          #{o.rank}
                        </span>
                        <h3 className="font-display text-lg font-bold">
                          {o.demand.buyerName}
                        </h3>
                        <Badge
                          tone={
                            o.demand.urgency === "high"
                              ? "orange"
                              : o.demand.urgency === "medium"
                                ? "amber"
                                : "slate"
                          }
                        >
                          {o.demand.buyerType} · {o.demand.urgency}
                        </Badge>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-600 dark:text-neutral-300">
                        <MapPin size={14} /> {o.demand.location} ·{" "}
                        {o.demand.distanceKm} km
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-2xl font-bold text-emerald-800 dark:text-emerald-400">
                        {formatCurrency(o.economics.net)}
                      </p>
                      <p className="text-xs text-slate-500">est. net to farmer</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Deal</p>
                      <p className="font-mono font-bold">
                        {formatCurrency(o.dealPrice)}/{o.demand.unit} ×{" "}
                        {o.fillQty}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Gross</p>
                      <p className="font-mono font-bold">
                        {formatCurrency(o.economics.gross)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Logistics</p>
                      <p className="font-mono font-bold">
                        −{formatCurrency(o.economics.logistics)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Match score</p>
                      <p className="font-mono font-bold">{o.score.total}/100</p>
                    </div>
                  </div>
                  <ScoreBars breakdown={o.score} />
                  <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-neutral-300">
                    {o.why.slice(0, 4).map((w) => (
                      <li key={w}>· {w}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs italic text-slate-500">
                    {o.demand.notes}
                  </p>
                </Card>
              ))}
            </div>
            <div className="space-y-4">
              {route && <RouteCard route={route} />}
              <Card className="p-5">
                <Package size={18} className="text-emerald-700" />
                <h3 className="mt-3 font-display text-lg font-bold">
                  How scoring works
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-neutral-300">
                  Price fit 25 · quantity cover 25 · quality 20 · distance 15 ·
                  delivery timeline 15. Final ranking prioritises{" "}
                  <strong>net earnings</strong> so farmers compare real take-home,
                  not just sticker price.
                </p>
              </Card>
            </div>
          </div>
        </section>
      )}

      {mode === "farmer" && offer && opps.length === 0 && offer.cropKey !== "unknown" && (
        <Card className="mt-7 p-5">
          <p className="text-sm text-slate-600 dark:text-neutral-300">
            No live buyer demands for <strong>{offer.variety}</strong> in the
            demo pool yet. Try the tomato / onion / paddy / mango examples, or
            publish the listing so marketplace buyers can find you.
          </p>
        </Card>
      )}

      {mode === "buyer" && buyerSummary && (
        <section className="mt-7">
          <h2 className="font-display text-2xl font-bold">
            Ranked farm matches
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
            Requirement: {buyerSummary}
          </p>
          <div className="mt-5 grid gap-4">
            {buyerMatches.length === 0 && (
              <Card className="p-5 text-sm text-slate-600">
                No listings matched. Broaden budget, grade, or distance.
              </Card>
            )}
            {buyerMatches.map(({ listing, breakdown, fillQty, buyerEconomics }, i) => (
              <Card key={listing.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">
                        #{i + 1}
                      </span>
                      <h3 className="font-display text-lg font-bold">
                        {listing.variety}
                      </h3>
                      <Badge tone="emerald">{breakdown.total}/100</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
                      {listing.farmer} · {listing.village} · {listing.distance}{" "}
                      km · {listing.grade}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl font-bold">
                      {formatCurrency(buyerEconomics.total)}
                    </p>
                    <p className="text-xs text-slate-500">
                      total for {formatQuantity(fillQty, listing.unit)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <span>
                    Price {formatCurrency(listing.price)}/{listing.unit}
                  </span>
                  <span>
                    Logistics {formatCurrency(buyerEconomics.logistics)}
                  </span>
                  <span>Fee {formatCurrency(buyerEconomics.platformFee)}</span>
                </div>
                <ScoreBars breakdown={breakdown} />
                <Link
                  href={`/marketplace/${listing.id}`}
                  className="mt-3 inline-block text-sm font-bold text-emerald-800 dark:text-emerald-400"
                >
                  Open listing →
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
