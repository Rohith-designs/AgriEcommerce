import { farmerNet, priceAdvisory } from "@/lib/pricing";
import { estimateLogistics, nearestNeighborRoute, type Point } from "@/lib/logistics";
import type { FarmerOffer } from "./ingest";
import {
  BUYER_DEMANDS,
  FARM_HUB,
  type BuyerDemand,
} from "./buyer-demands";
import { detectCrop, isoDaysFromNow } from "./crops";

export type OpportunityScore = {
  price: number;
  quantity: number;
  quality: number;
  distance: number;
  timeline: number;
  total: number;
};

export type SellingOpportunity = {
  demand: BuyerDemand;
  fillQty: number;
  dealPrice: number;
  score: OpportunityScore;
  economics: ReturnType<typeof farmerNet>;
  advisory: ReturnType<typeof priceAdvisory>;
  why: string[];
  rank: number;
};

function scoreOpportunity(
  offer: FarmerOffer,
  demand: BuyerDemand,
  fillQty: number,
  dealPrice: number,
): { score: OpportunityScore; why: string[] } {
  const why: string[] = [];
  // Price fit: farmer asking vs buyer max (25)
  let price = 12;
  if (dealPrice <= demand.maxPrice) {
    const headroom = (demand.maxPrice - dealPrice) / demand.maxPrice;
    price = Math.round(15 + Math.min(10, headroom * 40));
    why.push(
      dealPrice < demand.maxPrice
        ? `Buyer ceiling ₹${demand.maxPrice}/kg leaves ₹${demand.maxPrice - dealPrice} headroom`
        : `Deal at buyer max ₹${demand.maxPrice}/kg`,
    );
  } else {
    price = Math.max(
      0,
      Math.round(15 - ((dealPrice - demand.maxPrice) / demand.maxPrice) * 40),
    );
    why.push(
      `Asking above buyer max by ₹${dealPrice - demand.maxPrice}/kg — may need negotiation`,
    );
  }

  // Quantity: how much of demand we can fill (25)
  const cover = Math.min(1, fillQty / demand.qty);
  const quantity = Math.round(cover * 25);
  if (cover >= 1) why.push(`Can fully supply ${demand.qty} ${demand.unit}`);
  else
    why.push(
      `Partial fill ${fillQty}/${demand.qty} ${demand.unit} (${Math.round(cover * 100)}%)`,
    );

  // Quality (20)
  const quality =
    !demand.grade ||
    offer.grade === demand.grade ||
    (offer.grade === "Grade A" && demand.grade === "Grade 1")
      ? 20
      : 8;
  if (quality === 20) why.push(`Grade ${offer.grade} meets buyer requirement`);
  else why.push(`Grade mismatch (${offer.grade} vs ${demand.grade})`);

  // Distance (15) — closer is better; logistics cost rises with km
  const distance = Math.max(
    0,
    Math.round(15 - (demand.distanceKm / 400) * 15),
  );
  why.push(`${demand.distanceKm} km to ${demand.location}`);

  // Timeline (15)
  const timeline =
    offer.availableUntil >= demand.deadline
      ? 15
      : offer.availableFrom <= demand.deadline
        ? 8
        : 0;
  if (timeline === 15) why.push(`Availability covers buyer deadline ${demand.deadline}`);
  else if (timeline === 8) why.push("Partial overlap with buyer deadline");
  else why.push("Availability misses buyer deadline");

  const total = price + quantity + quality + distance + timeline;
  return {
    score: { price, quantity, quality, distance, timeline, total },
    why,
  };
}

/** Rank buyer demands against a structured farmer offer with net-profit. */
export function evaluateOpportunities(
  offer: FarmerOffer,
  demands: BuyerDemand[] = BUYER_DEMANDS,
): SellingOpportunity[] {
  if (!offer.cropKey || offer.cropKey === "unknown" || offer.quantity <= 0) {
    return [];
  }

  const matched = demands.filter(
    (d) =>
      d.cropKey === offer.cropKey ||
      (d.category === offer.category &&
        (offer.variety.toLowerCase().includes(d.cropKey) ||
          d.cropKey === offer.cropKey)),
  );

  const rows: SellingOpportunity[] = matched.map((demand) => {
    const fillQty = Math.min(offer.quantity, demand.qty);
    const dealPrice = Math.min(offer.expectedPrice, demand.maxPrice);
    const { score, why } = scoreOpportunity(offer, demand, fillQty, dealPrice);
    const economics = farmerNet(dealPrice, fillQty, demand.distanceKm);
    const advisory = priceAdvisory(dealPrice, offer.marketPrice || demand.maxPrice);
    if (demand.urgency === "high") why.unshift("High urgency buyer — faster clearance");
    return {
      demand,
      fillQty,
      dealPrice,
      score,
      economics,
      advisory,
      why,
      rank: 0,
    };
  });

  return rows
    .sort((a, b) => {
      // Prefer higher net, then match score
      if (b.economics.net !== a.economics.net)
        return b.economics.net - a.economics.net;
      return b.score.total - a.score.total;
    })
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

export type RoutePlan = {
  stops: string[];
  distanceKm: number;
  durationMins: number;
  logisticsCost: number;
  combinedNet: number;
  explanation: string;
};

/** Multi-stop pickup/drop plan for top opportunities (demo route optimization). */
export function planMultiStopRoute(
  opportunities: SellingOpportunity[],
  maxStops = 3,
): RoutePlan | null {
  const top = opportunities.slice(0, maxStops);
  if (top.length < 2) return null;

  const start: Point = { ...FARM_HUB };
  const stops: Point[] = top.map((o) => ({
    name: o.demand.buyerName,
    lat: o.demand.lat,
    lng: o.demand.lng,
  }));
  const routed = nearestNeighborRoute(start, stops);
  const totalWeight = top.reduce((s, o) => s + o.fillQty, 0);
  const logisticsCost = estimateLogistics(routed.distanceKm, totalWeight);
  const gross = top.reduce((s, o) => s + o.economics.gross, 0);
  const fees = top.reduce((s, o) => s + o.economics.platformFee, 0);
  const combinedNet = gross - logisticsCost - fees;

  return {
    stops: [FARM_HUB.name, ...routed.route.map((p) => p.name)],
    distanceKm: routed.distanceKm,
    durationMins: routed.durationMins,
    logisticsCost,
    combinedNet,
    explanation: `Nearest-neighbor route across ${top.length} buyers from your farm hub. Combined logistics ₹${logisticsCost} vs separate trips often higher — batching improves net.`,
  };
}

export type HarvestAdvisory = {
  label: string;
  tone: "sell_now" | "hold" | "list_soon";
  headline: string;
  detail: string;
  suggestedUntil: string;
};

export function harvestWindowAdvisory(
  offer: FarmerOffer,
  opportunities: SellingOpportunity[],
): HarvestAdvisory {
  const best = opportunities[0];
  const crop = detectCrop(offer.variety) ?? detectCrop(offer.raw);
  const shelf = crop?.shelfDays ?? 7;
  const market = offer.marketPrice || offer.expectedPrice;
  const delta =
    market > 0
      ? Math.round(((offer.expectedPrice - market) / market) * 100)
      : 0;

  if (best && best.demand.urgency === "high" && best.score.total >= 70) {
    return {
      label: "Sell now",
      tone: "sell_now",
      headline: "Strong buyer demand in your window",
      detail: `${best.demand.buyerName} needs ${best.demand.qty} ${best.demand.unit} by ${best.demand.deadline}. Estimated net ${best.economics.net.toLocaleString("en-IN")} after logistics.`,
      suggestedUntil: best.demand.deadline,
    };
  }
  if (delta > 10 && shelf > 10) {
    return {
      label: "Hold / renegotiate",
      tone: "hold",
      headline: "Price is above market — buyers may wait",
      detail: `Your ask is ${delta}% above regional ₹${market}. Soften by ₹${Math.ceil((offer.expectedPrice - market) * 0.5)} or wait for processor demand.`,
      suggestedUntil: isoDaysFromNow(Math.min(shelf, 14)),
    };
  }
  if (shelf <= 5) {
    return {
      label: "List soon",
      tone: "list_soon",
      headline: "Short shelf life — prioritise nearby buyers",
      detail: `Estimated ${shelf}-day freshness window. Prefer buyers under 60 km to protect quality and net payout.`,
      suggestedUntil: isoDaysFromNow(Math.min(shelf, 4)),
    };
  }
  return {
    label: "Good window",
    tone: "list_soon",
    headline: "Competitive listing window",
    detail:
      opportunities.length > 0
        ? `${opportunities.length} buyer opportunities ranked by net profit. Compare logistics before accepting.`
        : "No exact crop match yet — broaden grade or lower ask slightly to unlock demand.",
    suggestedUntil: offer.availableUntil || isoDaysFromNow(7),
  };
}
