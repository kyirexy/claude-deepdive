"use client";

import { cn } from "@/lib/utils";
import type { LayerId } from "@/types/agent-data";

const LAYER_COLORS: Record<LayerId, string> = {
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

export function LayerBadge({
  layer,
  children,
  className,
}: {
  layer: LayerId;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white",
        className
      )}
      style={{ backgroundColor: LAYER_COLORS[layer] }}
    >
      {children}
    </span>
  );
}