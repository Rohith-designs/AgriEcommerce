"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { addMyListing } from "@/lib/listings-store";
import { ingestFarmerOffer, isoDaysFromNow } from "@/lib/ai";

const CATEGORIES = ["Vegetables", "Fruits", "Grains", "Pulses", "Spices"];

export function ListingForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const [error, setError] = useState("");
  const [nl, setNl] = useState("");
  const [variety, setVariety] = useState("Hybrid Tomato");
  const [category, setCategory] = useState("Vegetables");
  const [quantity, setQuantity] = useState("100");
  const [grade, setGrade] = useState("Grade A");
  const [price, setPrice] = useState("28");
  const [from, setFrom] = useState(isoDaysFromNow(0));
  const [until, setUntil] = useState(isoDaysFromNow(4));
  const [suggested, setSuggested] = useState(30);

  const applyNl = () => {
    if (!nl.trim()) return;
    const offer = ingestFarmerOffer(nl);
    if (offer.variety !== "Unknown produce") setVariety(offer.variety);
    if (offer.category) setCategory(offer.category);
    if (offer.quantity > 0) setQuantity(String(offer.quantity));
    setGrade(offer.grade);
    if (offer.expectedPrice > 0) setPrice(String(offer.expectedPrice));
    setFrom(offer.availableFrom);
    setUntil(offer.availableUntil);
    if (offer.marketPrice > 0) setSuggested(offer.marketPrice);
  };

  const submit = (form: FormData) => {
    const quantity = Number(form.get("quantity"));
    const price = Number(form.get("price"));
    const start = String(form.get("from")),
      until = String(form.get("until"));
    if (quantity <= 0)
      return setError(t("Quantity must be greater than zero."));
    if (!Number.isFinite(price) || price <= 0)
      return setError(t("Price must be greater than zero."));
    if (
      !until ||
      new Date(until) <= new Date(start) ||
      new Date(until) < new Date()
    )
      return setError(
        t(
          "Available-until must be after available-from and cannot be in the past.",
        ),
      );
    setError("");
    addMyListing({
      variety: String(form.get("variety") ?? ""),
      category: String(form.get("category") ?? "Vegetables"),
      quantity,
      unit: String(form.get("unit") ?? "kg"),
      grade: String(form.get("grade") ?? "Grade A"),
      price,
      phone: String(form.get("phone") ?? ""),
      availableUntil: until,
    });
    router.push("/dashboard");
  };
  return (
    <form action={submit} className="grid gap-5">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-200">
          <Sparkles size={16} /> {t("AI Match")} — describe produce in plain language
        </div>
        <textarea
          value={nl}
          onChange={(e) => setNl(e.target.value)}
          rows={2}
          placeholder="e.g. 200 kg Grade-A tomatoes near Warangal, want ₹28/kg this week"
          className="mt-3 w-full rounded-lg border border-emerald-200 bg-white p-3 text-sm font-normal dark:border-emerald-800 dark:bg-neutral-950"
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={applyNl}>
            Fill form from text
          </Button>
          <Link
            href="/ai"
            className="inline-flex items-center text-sm font-bold text-emerald-800 dark:text-emerald-400"
          >
            Full opportunity desk →
          </Link>
        </div>
      </div>
      <label className="text-sm font-semibold">
        {t("Produce variety")}
        <input
          name="variety"
          value={variety}
          onChange={(e) => setVariety(e.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          {t("Quantity")}
          <input
            name="quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          {t("Unit")}
          <select
            name="unit"
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"
          >
            <option>kg</option>
            <option>quintal</option>
            <option>tonne</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          {t("Grade")}
          <select
            name="grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"
          >
            <option>Grade A</option>
            <option>Grade B</option>
            <option>Grade C</option>
            <option>Grade 1</option>
          </select>
        </label>
      </div>
      <label className="text-sm font-semibold">
        {t("Category")}
        <select
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          {t("Available from")}
          <input
            name="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          {t("Available until")}
          <input
            name="until"
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          {t("Contact number")}
          <input
            name="phone"
            type="tel"
            defaultValue="+91 90000 00000"
            placeholder="+91 xxxxx xxxxx"
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          {t("Expected price / kg")}
          <input
            name="price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"
          />
          <span className="mt-2 block font-mono text-xs text-emerald-800">
            Regional suggested price: ₹{suggested}/kg
          </span>
        </label>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        {t(
          "Farm location: Chevella, Telangana. Complete your profile before publishing if this is not correct.",
        )}
      </div>
      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <Button type="submit">{t("Publish listing")}</Button>
    </form>
  );
}
