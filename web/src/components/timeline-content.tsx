"use client";

import Link from "next/link";
import { LEARNING_PATH, VERSION_META, LAYERS } from "@/lib/constants";
import { LayerBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

const LAYER_COLORS: Record<string, string> = {
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

const LAYER_DOT_COLORS: Record<string, string> = {
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

interface TimelineContentProps {
  locale: string;
}

export function TimelineContent({ locale }: TimelineContentProps) {
  const t = useTranslations();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t("nav.timeline")}</h1>
      <p className="text-[var(--color-text-secondary)]">
        {t("home.learning_path_desc")}
      </p>

      <div className="relative">
        <div className="absolute left-4 top-0 h-full w-0.5 bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-8">
          {LEARNING_PATH.map((versionId, index) => {
            const meta = VERSION_META[versionId];
            if (!meta) return null;
            return (
              <div key={versionId} className="relative pl-12">
                <div className="absolute left-2.5 top-1 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-900" style={{ backgroundColor: LAYER_DOT_COLORS[meta.layer] }} />
                <Link href={`/${locale}/${versionId}`}>
                  <Card className="transition-all hover:shadow-md" style={{ borderColor: LAYER_COLORS[meta.layer] + '4D' }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-zinc-500">{versionId}</span>
                          <LayerBadge layer={meta.layer}>{t(`layer_labels.${meta.layer}`)}</LayerBadge>
                        </div>
                        <h3 className="mt-1 font-semibold">{t(`sessions.${versionId}`)}</h3>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          {t("keyInsights." + versionId)}
                        </p>
                      </div>
                      {index < LEARNING_PATH.length - 1 && (
                        <span className="text-xs text-zinc-400">↓</span>
                      )}
                    </div>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
