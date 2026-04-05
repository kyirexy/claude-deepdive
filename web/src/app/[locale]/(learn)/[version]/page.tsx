import Link from "next/link";
import { LEARNING_PATH, VERSION_META } from "@/lib/constants";
import { VersionDetailClient } from "./client";
import { VersionHeader } from "@/components/version-header";
import { TableOfContents } from "@/components/table-of-contents";
import { getChapterContent } from "@/lib/chapter-content";

const LOCALES = ["en", "zh"];

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    LEARNING_PATH.map((version) => ({ locale, version }))
  );
}

export default async function VersionPage({
  params,
}: {
  params: Promise<{ locale: string; version: string }>;
}) {
  const { locale, version } = await params;
  const meta = VERSION_META[version];

  if (!meta) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold">Chapter not found</h1>
      </div>
    );
  }

  const pathIndex = LEARNING_PATH.indexOf(version as typeof LEARNING_PATH[number]);
  const prevVersion = pathIndex > 0 ? LEARNING_PATH[pathIndex - 1] : null;
  const nextVersion =
    pathIndex < LEARNING_PATH.length - 1 ? LEARNING_PATH[pathIndex + 1] : null;

  const content = getChapterContent(version, locale);

  return (
    <div className="flex gap-12 mx-auto max-w-7xl py-4">
      <div className="flex-1 min-w-0">
        <div className="max-w-3xl">
          <VersionHeader
            version={version}
            locale={locale}
            layer={meta.layer}
            prevVersion={prevVersion}
            nextVersion={nextVersion}
          />

          <VersionDetailClient version={version} />

          <div className="border-t border-zinc-200 pt-6 dark:border-zinc-700" />
        </div>
      </div>
      {content && <TableOfContents sections={content.sections} />}
    </div>
  );
}