"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { categories } from "@/lib/demo-data";
import { useListings } from "@/lib/useListings";
import { parseMarketSearch } from "@/lib/search";
import { parseBuyerIntent } from "@/lib/ai";
import { matchListings } from "@/lib/matching";
import { ProduceCard } from "./ProduceCard";
import { useLanguage } from "@/components/shared/LanguageProvider";

export function MarketplaceClient() {
  const { t } = useLanguage();
  const { listings } = useListings();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All produce");
  const [sort, setSort] = useState("Best match");
  const data = useMemo(() => {
    const parsed = parseMarketSearch(query);
    const intent = query.trim() ? parseBuyerIntent(query) : null;
    const activeCategory =
      category !== "All produce" ? category : parsed.category;
    const plainTerms = query
      .toLowerCase()
      .replace(/near\s+[a-z\s]+/, " ")
      .replace(
        /(?:fresh|today|harvested|under|below|less|than|₹|\d+|kg|in|the|tomato|tomatoes|okra|onion|onions|brinjal|carrot|carrots|mango|mangoes|banana|bananas|pomegranate|rice|paddy|basmati|moong|chilli|chillies)/g,
        " ",
      )
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const matchesCategory = (item: (typeof listings)[number]) =>
      activeCategory === "Rice"
        ? item.category === "Grains" &&
          /rice|paddy|basmati|sona/i.test(item.variety)
        : !activeCategory || item.category === activeCategory;
    const filtered = listings.filter((item) => {
      const text =
        `${item.variety} ${item.category} ${item.farmer} ${item.village}`.toLowerCase();
      return (
        matchesCategory(item) &&
        (!parsed.priceCeiling || item.price <= parsed.priceCeiling) &&
        (!plainTerms.length ||
          plainTerms.some((term) => text.includes(term)))
      );
    });
    if (sort === "Best match" && intent && intent.fieldsDetected.length >= 1) {
      const scored = matchListings(filtered, intent);
      const order = new Map(
        scored.map((row, i) => [row.listing.id, i]),
      );
      return [...filtered].sort((a, b) => {
        const ai = order.get(a.id) ?? 999;
        const bi = order.get(b.id) ?? 999;
        if (ai !== bi) return ai - bi;
        return b.rating - a.rating;
      });
    }
    return filtered.sort((a, b) =>
      sort === "Price: low to high"
        ? a.price - b.price
        : sort === "Distance"
          ? a.distance - b.distance
          : b.rating - a.rating,
    );
  }, [query, category, sort, listings]);

  const sortOptions = ["Best match", "Price: low to high", "Distance"];

  return (
    <>
      <section className="border-b border-stone-200 bg-white dark:border-neutral-800 dark:bg-black">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
            {t("Live farm inventory · Hyderabad region")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t("Buy closer to the source.")}
          </h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-neutral-300">
            {t("Best match")} now uses multi-criteria AI scoring when you
            describe qty, budget, or grade.{" "}
            <Link
              href="/ai"
              className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-400"
            >
              <Sparkles size={14} /> {t("AI Match")}
            </Link>
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label className="flex h-12 flex-1 items-center gap-3 rounded-lg border border-slate-300 bg-stone-50 px-4 dark:border-neutral-700 dark:bg-neutral-900">
              <Search size={18} className="text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(
                  "Try: fresh tomatoes under ₹30/kg near Hyderabad",
                )}
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <label className="relative flex-shrink-0">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-12 appearance-none rounded-lg border border-slate-300 bg-white py-0 pl-4 pr-10 text-sm font-semibold text-slate-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-stone-100"
              >
                {sortOptions.map((option) => (
                  <option key={option} value={option}>
                    {t(option)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-neutral-400"
              />
            </label>
          </div>
        </div>
      </section>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-2 text-sm font-semibold ${category === c ? "border-emerald-700 bg-emerald-700 text-white" : "border-stone-300 bg-white text-slate-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"}`}
            >
              {t(c)}
            </button>
          ))}
          <button className="ml-auto hidden items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold dark:border-neutral-700 sm:flex">
            <SlidersHorizontal size={16} /> {t("More filters")}
          </button>
        </div>
        <p className="mb-4 font-mono text-xs text-slate-500 dark:text-neutral-400">
          {t("{count} live listings · data updated 8 min ago", {
            count: data.length,
          })}
        </p>
        {data.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((listing) => (
              <ProduceCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <p className="font-display text-xl font-bold">
              {t("No produce matches those filters.")}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-neutral-300">
              {t(
                "Broaden your location, price, or freshness filter to see live farm stock.",
              )}
            </p>
          </div>
        )}
      </main>
    </>
  );
}
