"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Github, Menu, X, Sun, Moon, User, ExternalLink, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { useDarkMode } from "@/hooks/useDarkMode";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "zh", label: "中文" },
];

export function Header() {
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";
  const t = useTranslations();
  const [mobileOpen, setMobileOpen] = useState(false);
  const dark = useDarkMode();

  function toggleDark() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  function switchLocale(newLocale: string) {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    window.location.href = newPath;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} className="text-lg font-bold">
          Claude DeepDive
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href={`/${locale}/timeline`}
            className={cn(
              "text-sm font-medium transition-colors hover:text-zinc-900 dark:hover:text-white",
              pathname.includes("timeline")
                ? "text-zinc-900 dark:text-white"
                : "text-zinc-500 dark:text-zinc-400"
            )}
          >
            {t("nav.timeline")}
          </Link>
          <Link
            href={`/${locale}/layers`}
            className={cn(
              "text-sm font-medium transition-colors hover:text-zinc-900 dark:hover:text-white",
              pathname.includes("layers")
                ? "text-zinc-900 dark:text-white"
                : "text-zinc-500 dark:text-zinc-400"
            )}
          >
            {t("nav.layers")}
          </Link>

          <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] p-0.5">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => switchLocale(l.code)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  locale === l.code
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                )}
              >
                {l.label}
              </button>
            ))}
          </div>

          <button
            onClick={toggleDark}
            className="rounded-md p-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <ContactMenu />
        </nav>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center md:hidden"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-4 md:hidden">
          <Link
            href={`/${locale}/timeline`}
            className="flex min-h-[44px] items-center text-sm"
            onClick={() => setMobileOpen(false)}
          >
            {t("nav.timeline")}
          </Link>
          <Link
            href={`/${locale}/layers`}
            className="flex min-h-[44px] items-center text-sm"
            onClick={() => setMobileOpen(false)}
          >
            {t("nav.layers")}
          </Link>
        </div>
      )}
    </header>
  );
}

function ContactMenu() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function copyToClipboard(text: string, type: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback
    }
  }

  const menuItems = [
    { label: "GitHub", sublabel: "kyirexy", href: "https://github.com/kyirexy/claude-deepdive" },
    { label: "B站", sublabel: "1679132605", href: "https://space.bilibili.com/1679132605" },
    { label: "微信", sublabel: "lxy11300725", copy: "lxy11300725" },
    { label: "QQ", sublabel: "1592880030", copy: "1592880030" },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
          open
            ? "border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800"
            : "border-[var(--color-border)] hover:border-zinc-300 hover:bg-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        )}
      >
        <User size={16} className="text-zinc-500" />
        <span className="hidden sm:inline">联系我</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2 shadow-lg">
          {menuItems.map((item) => (
            <div key={item.label} className="flex flex-col">
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => setOpen(false)}
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{item.label}</div>
                    <div className="text-xs text-zinc-400">{item.sublabel}</div>
                  </div>
                  <ExternalLink size={14} className="text-zinc-400" />
                </a>
              ) : (
                <button
                  onClick={() => item.copy && copyToClipboard(item.copy, item.label)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <div className="text-left">
                    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{item.label}</div>
                    <div className="text-xs text-zinc-400">{item.sublabel}</div>
                  </div>
                  {copied === item.label ? (
                    <Check size={14} className="text-emerald-500" />
                  ) : (
                    <Copy size={14} className="text-zinc-400" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}