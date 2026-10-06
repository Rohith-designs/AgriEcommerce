"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Route, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/shared/Navbar";
import { ProduceCard } from "@/components/buyer/ProduceCard";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { useListings } from "@/lib/useListings";

export default function Home() {
  const { t } = useLanguage();
  const { listings } = useListings();
  const features = [
    {
      Icon: BarChart3,
      title: t("Price clarity"),
      copy: t(
        "See regional price baselines and your net payout before you accept.",
      ),
    },
    {
      Icon: Route,
      title: t("Coordinated delivery"),
      copy: t(
        "Transparent distance and multi-stop route estimates for every order.",
      ),
    },
    {
      Icon: ShieldCheck,
      title: t("Tracked lifecycle"),
      copy: t(
        "From harvest pack to hand-off to delivery, every update is visible.",
      ),
    },
  ];
  return (
    <>
      <Navbar />
      <main>
        <section className="border-b border-stone-200 bg-emerald-950 text-stone-50 dark:border-neutral-800">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.1fr_.9fr] md:py-20">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">
                {t("Direct produce exchange · India")}
              </p>
              <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
                {t("Better prices start at the farm gate.")}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-emerald-100">
                {t(
                  "AgriLink gives farmers control of inventory and buyers a clear view of fresh stock, delivery cost, and the people behind every order.",
                )}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950"
                >
                  {t("Browse today's harvest")} <ArrowRight size={17} />
                </Link>
                <Link
                  href="/ai"
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-emerald-900 px-5 py-3 text-sm font-bold text-amber-200"
                >
                  {t("AI Match")}
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg border border-emerald-700 px-5 py-3 text-sm font-bold"
                >
                  {t("List your produce")}
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 self-end">
              <div className="border border-emerald-800 bg-emerald-900 p-4">
                <span className="font-mono text-2xl font-bold text-amber-300">
                  126
                </span>
                <p className="mt-1 text-xs text-emerald-100">
                  {t("active farm lots")}
                </p>
              </div>
              <div className="border border-emerald-800 bg-emerald-900 p-4">
                <span className="font-mono text-2xl font-bold text-amber-300">
                  ₹2.4L
                </span>
                <p className="mt-1 text-xs text-emerald-100">
                  {t("farmer payouts this week")}
                </p>
              </div>
              <div className="col-span-2 border border-emerald-800 bg-emerald-900 p-4">
                <p className="font-mono text-xs text-emerald-200">
                  {t("MARKET UPDATE")}
                </p>
                <p className="mt-2 font-display text-xl font-bold">
                  {t("Fresh lots added all day")}
                </p>
                <p className="mt-1 text-sm text-emerald-100">
                  {t("Compare quality, source, and price before buying")}
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                {t("Fresh off the field")}
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold">
                {t("Market board")}
              </h2>
            </div>
            <Link
              href="/marketplace"
              className="text-sm font-bold text-emerald-800 dark:text-emerald-400"
            >
              {t("See all listings →")}
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {listings
              .slice(0, 9)
              .map((x) => <ProduceCard key={x.id} listing={x} />)}
          </div>
        </section>
        <section className="border-y border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
            {features.map(({ Icon, title, copy }) => (
              <div key={title} className="flex gap-3">
                <Icon className="shrink-0 text-emerald-700 dark:text-emerald-400" />
                <div>
                  <h3 className="font-display font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-neutral-300">
                    {copy}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
