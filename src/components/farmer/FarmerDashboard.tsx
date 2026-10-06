"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Package,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import { farmerNet, priceAdvisory } from "@/lib/pricing";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { useListings } from "@/lib/useListings";

export function FarmerDashboard() {
  const { t } = useLanguage();
  const { listings: visible, myListings, deleteListing } = useListings();
  const mineIds = new Set(myListings.map((m) => m.id));
  const stock = [
    ...myListings,
    ...visible.filter((l) => !mineIds.has(l.id)),
  ].slice(0, 3);
  const confirmDelete = (id: string) => {
    if (
      window.confirm(t("Delete this listing permanently? This cannot be undone."))
    ) {
      deleteListing(id);
    }
  };
  const focus = stock[0];
  const advice = focus
    ? priceAdvisory(focus.price, focus.suggested || focus.price)
    : priceAdvisory(28, 30);
  const listedPrice = focus?.price ?? 28;
  const marketPrice = focus?.suggested ?? 30;
  const sampleNet = focus
    ? farmerNet(focus.price, Math.min(100, focus.quantity), focus.distance)
    : farmerNet(28, 100, 18);
  const estEarnings = stock.reduce((sum, l) => {
    const n = farmerNet(l.price, Math.min(l.quantity, 200), l.distance);
    return sum + Math.max(0, n.net);
  }, 0);
  const stats = [
    { Icon: Package, value: String(visible.length), label: t("Active listings") },
    {
      Icon: TrendingUp,
      value: formatCurrency(estEarnings || sampleNet.net),
      label: t("Est. earnings"),
    },
    { Icon: ArrowUpRight, value: "2", label: t("Orders in progress") },
    { Icon: AlertTriangle, value: "1", label: t("Stock running low") },
  ];
  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {t("SELL PRODUCE")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold">
            {t("Your selling board")}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-neutral-300">
            {t(
              "Any AgriLink member can list fresh produce and manage their own sales.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/ai"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950 dark:bg-amber-950 dark:text-amber-100"
          >
            <Sparkles size={17} /> {t("AI Match")}
          </Link>
          <Link
            href="/dashboard/analytics"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 px-4 py-3 text-sm font-bold text-emerald-800 dark:text-emerald-300"
          >
            <BarChart3 size={17} /> {t("View analytics")}
          </Link>
          <Link
            href="/dashboard/listings/new"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white"
          >
            <Plus size={17} /> {t("New listing")}
          </Link>
        </div>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ Icon, value, label }) => (
          <Card key={label} className="p-4">
            <Icon className="text-emerald-700" size={19} />
            <p className="mt-5 font-mono text-2xl font-bold">{value}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
              {label}
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-200 p-5 dark:border-neutral-800">
            <h2 className="font-display text-xl font-bold">
              {t("Your active stock")}
            </h2>
            <Link
              href="/dashboard/listings"
              className="text-sm font-bold text-emerald-800 dark:text-emerald-400"
            >
              {t("Manage stock")}
            </Link>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-neutral-800">
            {stock.map((x) => (
              <div
                key={x.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{x.variety}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500 dark:text-neutral-400">
                    {x.quantity} kg left · {x.harvest}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold text-emerald-800 dark:text-emerald-400">
                      {formatCurrency(x.price)}/kg
                    </p>
                    <Badge tone="emerald">LIVE</Badge>
                  </div>
                  <button
                    onClick={() => confirmDelete(x.id)}
                    aria-label={`${t("Delete")} ${x.variety}`}
                    title={t("Delete")}
                    className="rounded-lg border border-red-200 p-2 text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {t("Price advisory")}
          </p>
          <h2 className="mt-2 font-display text-xl font-bold">
            {focus
              ? `${focus.variety} · ${advice.label}`
              : t("Tomato market position")}
          </h2>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-mono text-3xl font-bold text-emerald-800 dark:text-emerald-400">
              {formatCurrency(listedPrice)}
            </span>
            <span className="pb-1 text-sm text-slate-500 dark:text-neutral-400">
              {t("your listing / kg")}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-neutral-300">
            Regional average is{" "}
            <span className="font-mono">{formatCurrency(marketPrice)}/kg</span>.
            Your price is {Math.abs(advice.delta)}%{" "}
            {advice.delta >= 0 ? "above" : "below"} market.
          </p>
          <p className="mt-2 font-mono text-xs text-slate-500 dark:text-neutral-400">
            Sample net (100 kg): {formatCurrency(sampleNet.net)} after logistics
            + fee
          </p>
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-5 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            {t(
              "Use AI Match to describe your produce in plain language, compare buyer net payouts, and plan multi-stop delivery.",
            )}
          </div>
          <Link
            href="/ai"
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-emerald-800 dark:text-emerald-400"
          >
            <Sparkles size={14} /> {t("Open AI coordination desk")} →
          </Link>
        </Card>
      </div>
    </main>
  );
}
