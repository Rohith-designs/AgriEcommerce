"use client";

import Link from "next/link";
import { Menu, Sprout } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { AuthControl } from "./AuthControl";
import { CartControl } from "./CartControl";
import { LanguageSelector } from "./LanguageSelector";
import { LocationPrompt } from "@/components/marketing/LocationPrompt";
import { AssistantChat } from "./AssistantChat";
import { useLanguage } from "./LanguageProvider";

export function Navbar() {
  const { t } = useLanguage();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-stone-50/95 dark:border-neutral-800 dark:bg-black/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-emerald-800 dark:text-emerald-400"
          >
            <span className="grid h-8 w-8 place-items-center rounded bg-emerald-700 text-white">
              <Sprout size={18} />
            </span>
            AgriLink
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-slate-600 dark:text-neutral-300 md:flex">
            <Link href="/marketplace">{t("Buy produce")}</Link>
            <Link href="/dashboard">{t("Sell produce")}</Link>
            <Link href="/ai" className="text-emerald-800 dark:text-emerald-400">
              {t("AI Match")}
            </Link>
            <Link href="/articles">{t("Learn")}</Link>
            <Link href="/analytics">{t("Analytics")}</Link>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSelector />
            <ThemeToggle />
            <CartControl />
            <AuthControl />
            <Menu
              className="text-slate-800 dark:text-stone-100 md:hidden"
              size={20}
            />
          </div>
        </div>
      </header>
      <LocationPrompt />
      <AssistantChat />
    </>
  );
}
