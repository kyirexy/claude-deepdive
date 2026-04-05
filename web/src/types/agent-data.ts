export interface VersionMeta {
  title: string;
  subtitle: string;
  coreAddition: string;
  keyInsight: string;
  layer: LayerId;
  prevVersion: string | null;
}

export type LayerId = "architecture" | "core" | "multi-agent" | "security" | "context" | "principles" | "ecosystem" | "infrastructure" | "foundation";

export interface Layer {
  id: LayerId;
  label: string;
  color: string;
  versions: string[];
}

export type VersionId = "s01" | "s02" | "s03" | "s04" | "s05" | "s06" | "s07" | "s08" | "s09" | "s10" | "s11";
