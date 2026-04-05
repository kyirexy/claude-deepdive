import { LayersContent } from "@/components/layers-content";

const LOCALES = ["en", "zh"];

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LayersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <LayersContent locale={locale} />;
}