"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ChapterSection } from "@/lib/chapter-content-zh";

interface TableOfContentsProps {
  sections: ChapterSection[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function TableOfContents({ sections }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [isVisible, setIsVisible] = useState(false);

  const items = sections.map((section) => ({
    id: slugify(section.title),
    title: section.title,
  }));

  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100; // Account for sticky header
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    // Set first item as active initially
    if (items.length > 0) {
      setActiveId(items[0].id);
      setIsVisible(true);
    }

    // Intersection Observer for active tracking
    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      rootMargin: "-80px 0px -70% 0px",
      threshold: 0,
    });

    // Observe after a short delay to ensure DOM is ready
    const observeTimer = setTimeout(() => {
      items.forEach((item) => {
        const el = document.getElementById(item.id);
        if (el) observer.observe(el);
      });
    }, 200);

    return () => {
      clearTimeout(observeTimer);
      observer.disconnect();
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : 20 }}
      transition={{ duration: 0.3 }}
      className="hidden w-56 shrink-0 lg:block"
    >
      <div className="sticky top-32 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          On this page
        </h3>
        <nav className="space-y-1 border-l border-zinc-200 dark:border-zinc-700">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={cn(
                "relative block w-full py-1.5 pr-4 text-left text-sm transition-colors hover:text-zinc-900 dark:hover:text-white",
                activeId === item.id
                  ? "font-medium text-zinc-900 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              {activeId === item.id && (
                <motion.div
                  layoutId="toc-active-indicator"
                  className="absolute -left-px top-1/2 h-5 w-0.5 -translate-y-1/2 bg-zinc-900 dark:bg-white"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative pl-3">{item.title}</span>
            </button>
          ))}
        </nav>
      </div>
    </motion.aside>
  );
}
