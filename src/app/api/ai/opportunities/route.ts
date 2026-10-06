import { NextResponse } from "next/server";
import {
  BUYER_DEMANDS,
  evaluateOpportunities,
  harvestWindowAdvisory,
  ingestFarmerOffer,
  planMultiStopRoute,
  type FarmerOffer,
} from "@/lib/ai";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  let offer: FarmerOffer;

  if (body.text || body.query) {
    offer = ingestFarmerOffer(String(body.text ?? body.query));
  } else if (body.offer) {
    offer = body.offer as FarmerOffer;
  } else {
    return NextResponse.json(
      { error: "Provide text or a structured offer." },
      { status: 400 },
    );
  }

  const opportunities = evaluateOpportunities(offer, BUYER_DEMANDS);
  const route = planMultiStopRoute(opportunities, 3);
  const advisory = harvestWindowAdvisory(offer, opportunities);

  return NextResponse.json({
    offer,
    opportunities,
    route,
    advisory,
    demandPoolSize: BUYER_DEMANDS.length,
    explanation:
      "Opportunities ranked by farmer net profit (gross − logistics − platform fee), then match score. Route uses nearest-neighbor multi-stop optimization.",
  });
}
