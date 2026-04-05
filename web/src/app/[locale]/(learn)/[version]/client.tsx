"use client";

import { VersionContent } from "@/components/version-content";
import { useLocale } from "@/lib/i18n";

export function VersionDetailClient({ version }: { version: string }) {
  const locale = useLocale();

  return <VersionContent version={version} locale={locale} />;
}
