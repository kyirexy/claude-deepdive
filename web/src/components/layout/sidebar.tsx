"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LAYERS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

const LAYER_DOT_BG: Record<string, string> = {
  architecture: "#3B82F6",
  core: "#10B981",
  "multi-agent": "#8B5CF6",
  security: "#F59E0B",
  context: "#EF4444",
  principles: "#EC4899",
  ecosystem: "#06B6D4",
  infrastructure: "#F97316",
  foundation: "#8B5CF6",
};

export function Sidebar() {
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";
  const t = useTranslations();

  return (
    <nav className="hidden w-56 shrink-0 md:block">
      <div className="sticky top-[calc(3.5rem+2rem)] space-y-5">
        {LAYERS.map((layer) => (
          <div key={layer.id}>
            <div className="flex items-center gap-1.5 pb-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LAYER_DOT_BG[layer.id] }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {t(`layer_labels.${layer.id}`)}
              </span>
            </div>
            <ul className="space-y-0.5">
              {layer.versions.map((vId) => {
                const href = `/${locale}/${vId}`;
                const isActive =
                  pathname === href ||
                  pathname === `${href}/` ||
                  pathname.startsWith(`${href}/diff`);

                return (
                  <li key={vId}>
                    <Link
                      href={href}
                      className={cn(
                        "block rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-white"
                          : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-300"
                      )}
                    >
                      <span className="font-mono text-xs">{vId}</span>
                      <span className="ml-1.5">{t(`sessions.${vId}`)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}