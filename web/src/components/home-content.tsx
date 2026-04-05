"use client";

import Link from "next/link";
import { LEARNING_PATH, VERSION_META, LAYERS } from "@/lib/constants";
import { LayerBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

const LAYER_BORDER_COLORS: Record<string, string> = {
  architecture: "border-blue-500/30 hover:border-blue-500/60",
  core: "border-emerald-500/30 hover:border-emerald-500/60",
  "multi-agent": "border-purple-500/30 hover:border-purple-500/60",
  security: "border-amber-500/30 hover:border-amber-500/60",
  context: "border-red-500/30 hover:border-red-500/60",
  principles: "border-pink-500/30 hover:border-pink-500/60",
  ecosystem: "border-cyan-500/30 hover:border-cyan-500/60",
  infrastructure: "border-orange-500/30 hover:border-orange-500/60",
  foundation: "border-violet-500/30 hover:border-violet-500/60",
};

const LAYER_BAR_COLORS: Record<string, string> = {
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

interface HomeContentProps {
  locale: string;
}

export function HomeContent({ locale }: HomeContentProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-20 pb-16">
      <section className="flex flex-col items-center px-2 pt-8 text-center sm:pt-20">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          {t("home.hero_title")}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-[var(--color-text-secondary)] sm:text-xl">
          {t("home.hero_subtitle")}
        </p>
        <div className="mt-8">
          <Link
            href={`/${locale}/timeline`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            {t("home.start")}
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{t("home.learning_path")}</h2>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            {t("home.learning_path_desc")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LEARNING_PATH.map((versionId) => {
            const meta = VERSION_META[versionId];
            if (!meta) return null;
            return (
              <Link key={versionId} href={`/${locale}/${versionId}`} className="group block">
                <Card
                  className={cn(
                    "h-full border transition-all duration-200",
                    LAYER_BORDER_COLORS[meta.layer]
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <LayerBadge layer={meta.layer}>{versionId}</LayerBadge>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold group-hover:underline">
                    {t(`sessions.${versionId}`)}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {t("keyInsights." + versionId)}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{t("home.layers_title")}</h2>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            {t("home.layers_desc")}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {LAYERS.map((layer) => (
            <div
              key={layer.id}
              className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
            >
              <div
                className="h-full w-1.5 self-stretch rounded-full"
                style={{ backgroundColor: LAYER_BAR_COLORS[layer.id] }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{t(`layer_labels.${layer.id}`)}</h3>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {layer.versions.length} {t("home.versions_in_layer")}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {layer.versions.map((vid) => {
                    const meta = VERSION_META[vid];
                    return (
                      <Link key={vid} href={`/${locale}/${vid}`}>
                        <LayerBadge
                          layer={layer.id}
                          className="cursor-pointer transition-opacity hover:opacity-80"
                        >
                          {vid}: {t(`sessions.${vid}`)}
                        </LayerBadge>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
