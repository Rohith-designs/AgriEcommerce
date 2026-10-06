import type { Requirement } from "@/lib/matching";
import { detectCrop, isoDaysFromNow } from "./crops";

export type ParsedBuyerIntent = Requirement & {
  raw: string;
  cropKey?: string;
  location?: string;
  confidence: number;
  fieldsDetected: string[];
  summary: string;
};

function parseQty(text: string): number | null {
  const q = text.toLowerCase();
  const tonne = q.match(/(\d+(?:\.\d+)?)\s*(?:tonnes?|tons?|t)\b/);
  if (tonne) return Math.round(Number(tonne[1]) * 1000);
  const quintal = q.match(/(\d+(?:\.\d+)?)\s*(?:quintals?|qtl)\b/);
  if (quintal) return Math.round(Number(quintal[1]) * 100);
  const kg = q.match(/(\d+(?:\.\d+)?)\s*(?:kgs?|kilograms?)\b/);
  if (kg) return Math.round(Number(kg[1]));
  const need = q.match(
    /(?:need|want|looking for|require|buy)\s+(\d{2,5})\b/,
  );
  if (need) return Math.round(Number(need[1]));
  const bare = q.match(/\b(\d{2,5})\b/);
  return bare ? Math.round(Number(bare[1])) : null;
}

function parseBudget(text: string): number | undefined {
  const q = text.toLowerCase();
  const under = q.match(
    /(?:under|below|less than|max|upto|up to|budget)\s*₹?\s*(\d+)/,
  );
  if (under) return Number(under[1]);
  const slash = q.match(/₹\s*(\d+)\s*(?:\/|per)\s*kg/);
  if (slash) return Number(slash[1]);
  return undefined;
}

function parseGrade(text: string): string | undefined {
  const q = text.toLowerCase();
  if (/\bgrade\s*[-]?a\b|\ba[\s-]?grade\b|\bpremium\b/.test(q))
    return "Grade A";
  if (/\bgrade\s*[-]?1\b/.test(q)) return "Grade 1";
  if (/\bgrade\s*[-]?b\b/.test(q)) return "Grade B";
  return undefined;
}

function parseDeadline(text: string): string | undefined {
  const q = text.toLowerCase();
  if (/\btoday\b|\basap\b|\burgent\b/.test(q)) return isoDaysFromNow(1);
  if (/\btomorrow\b/.test(q)) return isoDaysFromNow(1);
  if (/\bthis week\b/.test(q)) return isoDaysFromNow(7);
  const days = q.match(/(?:by|within|in)\s+(\d+)\s*days?/);
  if (days) return isoDaysFromNow(Number(days[1]));
  return undefined;
}

function parseDistance(text: string): number | undefined {
  const m = text
    .toLowerCase()
    .match(/(?:within|under|max)\s+(\d+)\s*(?:km|kilometers?)/);
  return m ? Number(m[1]) : undefined;
}

function parseLocation(text: string): string | undefined {
  const near = text.match(/near\s+([A-Za-z][A-Za-z\s]{2,24}?)(?=\s|,|$)/i);
  return near?.[1]?.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Buyer NL → multi-criteria matching requirement. */
export function parseBuyerIntent(raw: string): ParsedBuyerIntent {
  const text = raw.trim();
  const crop = detectCrop(text);
  const qty = parseQty(text) ?? 100;
  const budget = parseBudget(text);
  const grade = parseGrade(text);
  const deadline = parseDeadline(text);
  const maxDistance = parseDistance(text) ?? (parseLocation(text) ? 80 : 200);
  const location = parseLocation(text);
  const fieldsDetected: string[] = [];
  if (crop) fieldsDetected.push("crop");
  if (parseQty(text)) fieldsDetected.push("quantity");
  if (budget != null) fieldsDetected.push("budget");
  if (grade) fieldsDetected.push("grade");
  if (deadline) fieldsDetected.push("deadline");
  if (location || parseDistance(text)) fieldsDetected.push("location/radius");

  const confidence = Math.min(
    100,
    fieldsDetected.length * 18 + (crop ? 10 : 0),
  );

  const parts = [
    crop ? crop.variety : "any produce",
    `${qty} kg`,
    grade,
    budget != null ? `budget ≤ ₹${budget}/kg` : null,
    deadline ? `by ${deadline}` : null,
    location ? `near ${location}` : maxDistance ? `≤ ${maxDistance} km` : null,
  ].filter(Boolean);

  return {
    raw: text,
    category: crop?.category,
    cropKey: crop?.key,
    qty,
    grade,
    budget,
    deadline,
    maxDistance,
    location,
    confidence,
    fieldsDetected,
    summary: parts.join(" · "),
  };
}
