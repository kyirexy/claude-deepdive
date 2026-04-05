import { CHAPTER_CONTENT as ZH } from "./chapter-content-zh";
import { CHAPTER_CONTENT_EN as EN } from "./chapter-content-en";

export const CHAPTER_CONTENT = ZH;

export function getChapterContent(version: string, locale: string) {
  return (locale === "en" ? EN : ZH)[version] || null;
}
