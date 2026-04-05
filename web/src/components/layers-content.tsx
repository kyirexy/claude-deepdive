"use client";

import Link from "next/link";
import { LAYERS, VERSION_META } from "@/lib/constants";
import { LayerBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

const LAYER_BAR_COLORS: Record<string, string> = {
  architecture: "#3B82F6",
  core: "#10B981",
  "multi-agent": "#8B5CF6",
  security: "#F59E0B",
  context: "#EF4444",
  principles: "#EC4899",
  ecosystem: "#06B6D4",
  infrastructure: "#F97316",
  foundation: "#84CC16",
};

interface LayersContentProps {
  locale: string;
}

export function LayersContent({ locale }: LayersContentProps) {
  const t = useTranslations();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t("home.layers_title")}</h1>
      <p className="text-[var(--color-text-secondary)]">
        {t("home.layers_desc")}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {LAYERS.map((layer) => (
          <Card key={layer.id} className="overflow-hidden">
            <div className="h-1.5" style={{ backgroundColor: LAYER_BAR_COLORS[layer.id] }} />
            <div className="p-4">
              <h3 className="text-lg font-semibold">{t(`layer_labels.${layer.id}`)}</h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {layer.versions.length} {t("home.versions_in_layer")}
              </p>
              <div className="mt-4 space-y-2">
                {layer.versions.map((vid) => {
                  const meta = VERSION_META[vid];
                  return (
                    <Link key={vid} href={`/${locale}/${vid}`} className="block">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-zinc-500">{vid}</span>
                        <span className="flex-1">{t(`sessions.${vid}`)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
