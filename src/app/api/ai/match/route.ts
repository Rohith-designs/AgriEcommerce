import { NextResponse } from "next/server";
import { listings } from "@/lib/demo-data";
import { matchListings } from "@/lib/matching";
import { parseBuyerIntent } from "@/lib/ai";
import { buyerCost } from "@/lib/pricing";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const text = String(body.text ?? body.query ?? "").trim();

  const requirement = text
    ? parseBuyerIntent(text)
    : {
        category: body.category,
        qty: Number(body.qty) || 100,
        grade: body.grade,
        budget: body.budget != null ? Number(body.budget) : undefined,
        deadline: body.deadline,
        maxDistance:
          body.maxDistance != null ? Number(body.maxDistance) : undefined,
        raw: "",
        confidence: 60,
        fieldsDetected: [] as string[],
        summary: "Structured requirement",
      };

  const matches = matchListings(listings, requirement).slice(0, 8).map((m) => {
    const qty = Math.min(requirement.qty, m.listing.quantity);
    const cost = buyerCost(m.listing.price, qty, m.listing.distance);
    return { ...m, fillQty: qty, buyerEconomics: cost };
  });

  return NextResponse.json({
    requirement,
    matches,
    explanation:
      "Multi-criteria score: price 25 · quantity 25 · quality 20 · distance 15 · timeline 15. Buyer total includes logistics + 2.5% platform fee.",
  });
}
