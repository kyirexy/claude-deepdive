import { TimelineContent } from "@/components/timeline-content";

const LOCALES = ["en", "zh"];

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <TimelineContent locale={locale} />;
}