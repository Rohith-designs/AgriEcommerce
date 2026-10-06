import { NextResponse } from "next/server";
import { ingestFarmerOffer } from "@/lib/ai";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const text = String(body.text ?? body.query ?? "").trim();
  if (!text) {
    return NextResponse.json(
      { error: "Provide text describing your produce." },
      { status: 400 },
    );
  }
  const offer = ingestFarmerOffer(text);
  return NextResponse.json({
    offer,
    explanation:
      "Agent extracts crop, quantity, grade, price, location and availability from natural language — no form required.",
  });
}
