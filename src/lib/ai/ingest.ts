import { detectCrop, isoDaysFromNow, type CropMeta } from "./crops";

export type FarmerOffer = {
  raw: string;
  variety: string;
  category: string;
  cropKey: string;
  quantity: number;
  unit: string;
  grade: string;
  expectedPrice: number;
  marketPrice: number;
  location: string;
  availableFrom: string;
  availableUntil: string;
  confidence: number;
  fieldsDetected: string[];
  missing: string[];
  notes: string[];
};

function parseQuantity(text: string): { qty: number; unit: string } | null {
  const q = text.toLowerCase();
  // 2 tonne / 2 tons / 2 t
  const tonne = q.match(/(\d+(?:\.\d+)?)\s*(?:tonnes?|tons?|t)\b/);
  if (tonne) return { qty: Math.round(Number(tonne[1]) * 1000), unit: "kg" };
  // 5 quintal
  const quintal = q.match(/(\d+(?:\.\d+)?)\s*(?:quintals?|qtl)\b/);
  if (quintal) return { qty: Math.round(Number(quintal[1]) * 100), unit: "kg" };
  // 200 kg / 200kgs
  const kg = q.match(/(\d+(?:\.\d+)?)\s*(?:kgs?|kilograms?)\b/);
  if (kg) return { qty: Math.round(Number(kg[1])), unit: "kg" };
  // bare number near crop words: "200 tomatoes"
  const bare = q.match(/\b(\d{2,5})\b/);
  if (bare) return { qty: Math.round(Number(bare[1])), unit: "kg" };
  return null;
}

function parsePrice(text: string): number | null {
  const q = text.toLowerCase();
  const m =
    q.match(
      /(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)\s*(?:\/?\s*(?:per\s*)?(?:kg|kilo))?/,
    ) ??
    q.match(
      /(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|rupees?)?\s*(?:\/|per)\s*(?:kg|kilo)/,
    ) ??
    q.match(
      /(?:want|expect(?:ed)?|asking|price|rate|bhav)\s*(?:of|at|is|=|:)?\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)/,
    );
  return m ? Math.round(Number(m[1])) : null;
}

function parseGrade(text: string): string | null {
  const q = text.toLowerCase();
  if (/\bgrade\s*[-]?a\b|\ba[\s-]?grade\b|\bfirst[\s-]?quality\b|\bpremium\b/.test(q))
    return "Grade A";
  if (/\bgrade\s*[-]?1\b|\bgrade\s*i\b/.test(q)) return "Grade 1";
  if (/\bgrade\s*[-]?b\b|\bsecond[\s-]?quality\b/.test(q)) return "Grade B";
  return null;
}

function parseLocation(text: string): string | null {
  const near = text.match(
    /(?:near|from|at|in)\s+([A-Za-z][A-Za-z\s]{2,30}?)(?=\s*,|\s+(?:want|expect|available|this|next|for|with|₹|rs|grade|\d)|$)/i,
  );
  if (near) {
    const loc = near[1].trim().replace(/\s+/g, " ");
    if (loc.length >= 3 && !/^(kg|the|my|a|an|this|week)$/i.test(loc)) {
      return loc.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  return null;
}

function parseAvailability(text: string, crop: CropMeta | null) {
  const q = text.toLowerCase();
  const shelf = crop?.shelfDays ?? 7;
  const from = isoDaysFromNow(0);
  if (/\btoday\b|\bready now\b|\bavailable now\b/.test(q)) {
    return { from, until: isoDaysFromNow(Math.min(shelf, 3)) };
  }
  if (/\bthis week\b|\bwithin a week\b/.test(q)) {
    return { from, until: isoDaysFromNow(7) };
  }
  if (/\bnext week\b/.test(q)) {
    return { from: isoDaysFromNow(7), until: isoDaysFromNow(14) };
  }
  const days = q.match(/(?:for|next|within)\s+(\d+)\s*days?/);
  if (days) {
    return { from, until: isoDaysFromNow(Number(days[1])) };
  }
  return { from, until: isoDaysFromNow(Math.min(shelf, 7)) };
}

/**
 * Natural-language farmer offer → structured produce profile.
 * Deterministic agent-style ingestion (no external LLM required).
 */
export function ingestFarmerOffer(raw: string): FarmerOffer {
  const text = raw.trim();
  const crop = detectCrop(text);
  const qty = parseQuantity(text);
  const price = parsePrice(text);
  const grade = parseGrade(text) ?? crop?.gradeDefault ?? "Grade A";
  const location = parseLocation(text) ?? "Chevella, Telangana";
  const window = parseAvailability(text, crop);
  const fieldsDetected: string[] = [];
  const missing: string[] = [];
  const notes: string[] = [];

  if (crop) fieldsDetected.push("crop");
  else missing.push("crop / variety");
  if (qty) fieldsDetected.push("quantity");
  else missing.push("quantity");
  if (price != null) fieldsDetected.push("expected price");
  else missing.push("expected price");
  if (parseGrade(text)) fieldsDetected.push("grade");
  if (parseLocation(text)) fieldsDetected.push("location");
  if (/\btoday|this week|next week|\d+\s*days?/i.test(text))
    fieldsDetected.push("availability");

  const marketPrice = crop?.suggestedPrice ?? price ?? 0;
  const expectedPrice = price ?? marketPrice;
  if (price == null && crop) {
    notes.push(
      `No asking price found — using regional baseline ₹${marketPrice}/${crop.unit}.`,
    );
  }
  if (crop && price != null) {
    const delta = Math.round(((price - marketPrice) / marketPrice) * 100);
    if (delta > 8)
      notes.push(
        `Asking ${delta}% above regional average (₹${marketPrice}) — may slow matching.`,
      );
    else if (delta < -8)
      notes.push(
        `Asking ${Math.abs(delta)}% below regional average — strong match likelihood.`,
      );
    else notes.push("Asking price is competitive vs regional baseline.");
  }

  const confidence = Math.min(
    100,
    Math.round(
      (fieldsDetected.includes("crop") ? 35 : 0) +
        (fieldsDetected.includes("quantity") ? 25 : 0) +
        (fieldsDetected.includes("expected price") ? 20 : 0) +
        (fieldsDetected.includes("grade") ? 10 : 0) +
        (fieldsDetected.includes("location") ? 5 : 0) +
        (fieldsDetected.includes("availability") ? 5 : 0),
    ),
  );

  return {
    raw: text,
    variety: crop?.variety ?? "Unknown produce",
    category: crop?.category ?? "Vegetables",
    cropKey: crop?.key ?? "unknown",
    quantity: qty?.qty ?? 0,
    unit: qty?.unit ?? crop?.unit ?? "kg",
    grade,
    expectedPrice,
    marketPrice,
    location,
    availableFrom: window.from,
    availableUntil: window.until,
    confidence,
    fieldsDetected,
    missing,
    notes,
  };
}
