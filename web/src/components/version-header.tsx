"use client";

import Link from "next/link";
import { useTranslations } from "@/lib/i18n";
import { LayerBadge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LayerId } from "@/types/agent-data";

interface VersionHeaderProps {
  version: string;
  locale: string;
  layer: LayerId;
  prevVersion: string | null;
  nextVersion: string | null;
}

export function VersionHeader({
  version,
  locale,
  layer,
  prevVersion,
  nextVersion,
}: VersionHeaderProps) {
  const t = useTranslations();
  const sessionTitle = t(`sessions.${version}`);
  const layerLabel = t(`layer_labels.${layer}`);

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-zinc-100 px-3 py-1 font-mono text-lg font-bold dark:bg-zinc-800">
          {version}
        </span>
        <h1 className="text-2xl font-bold sm:text-3xl">{sessionTitle}</h1>
        <LayerBadge layer={layer}>{layerLabel}</LayerBadge>
      </div>

      <nav className="flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-700">
        {prevVersion ? (
          <Link
            href={`/${locale}/${prevVersion}`}
            className="group flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-white"
          >
            <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            <div>
              <div className="text-xs text-zinc-400">{locale === "en" ? "Previous" : "上一章"}</div>
              <div className="font-medium">
                {t(`sessions.${prevVersion}`)}
              </div>
            </div>
          </Link>
        ) : (
          <div />
        )}
        {nextVersion ? (
          <Link
            href={`/${locale}/${nextVersion}`}
            className="group flex items-center gap-2 text-right text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-white"
          >
            <div>
              <div className="text-xs text-zinc-400">{locale === "en" ? "Next" : "下一章"}</div>
              <div className="font-medium">
                {t(`sessions.${nextVersion}`)}
              </div>
            </div>
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        ) : (
          <div />
        )}
      </nav>
    </header>
  );
}
