"use client";

import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getChapterContent } from "@/lib/chapter-content";
import type { ChapterSection } from "@/lib/chapter-content-zh";
import AgentLoop from "@/components/visualizations/s01-agent-loop";
import AgentLoop02 from "@/components/visualizations/s02-prompt-engine";
import AgentLoop03 from "@/components/visualizations/s03-tool-system";
import AgentLoop04 from "@/components/visualizations/s04-multi-agent";
import AgentLoop05 from "@/components/visualizations/s05-security";
import AgentLoop06 from "@/components/visualizations/s06-ecosystem";
import AgentLoop07 from "@/components/visualizations/s07-context-economics";
import AgentLoop08 from "@/components/visualizations/s08-design-principles";
import S09Visualization from "@/components/visualizations/s09-extension-ecosystem";
import S10Visualization from "@/components/visualizations/s10-terminal-architecture";
import { FileCode, BookOpen, Target } from "lucide-react";

const VISUALIZATIONS: Record<string, React.ReactNode> = {
  s01: <AgentLoop title="Agent Loop" />,
  s02: <AgentLoop02 title="Prompt Engine" />,
  s03: <AgentLoop03 title="Tool System" />,
  s04: <AgentLoop04 title="Multi-Agent System" />,
  s05: <AgentLoop05 title="Security Layer" />,
  s06: <AgentLoop06 />,
  s07: <AgentLoop07 />,
  s08: <AgentLoop08 />,
  s09: <S09Visualization />,
  s10: <S10Visualization />,
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function FadeInSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}

interface VersionContentProps {
  version: string;
  locale: string;
}

export function VersionContent({ version, locale }: VersionContentProps) {
  const content = getChapterContent(version, locale);

  if (!content) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-[var(--color-text-secondary)]">Content coming soon...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 简介 */}
      <FadeInSection>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 dark:border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-[var(--color-text)] dark:text-[var(--color-text)]">
              {locale === "en" ? "Chapter Introduction" : "章节简介"}
            </h3>
          </div>
          <div className="text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)] leading-relaxed [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_strong]:font-semibold [&_code]:bg-[var(--color-bg)] dark:[&_code]:bg-[var(--color-bg)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.intro}</ReactMarkdown>
          </div>
        </div>
      </FadeInSection>

      {/* 可视化区域 - 只在有可视化组件时显示 */}
      {VISUALIZATIONS[version] && (
        <FadeInSection delay={0.1}>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 min-h-[750px] dark:border-[var(--color-border)]">
            <h3 className="text-xl font-semibold text-[var(--color-text)] dark:text-[var(--color-text)] mb-6">
              {locale === "en" ? "Interactive Visualization" : "交互式可视化"}
            </h3>
            {VISUALIZATIONS[version]}
          </div>
        </FadeInSection>
      )}

      {/* 详细内容 sections */}
      <div className="space-y-6">
        {content.sections.map((section: ChapterSection, index: number) => (
          <FadeInSection key={section.title} delay={0.15 + index * 0.05}>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 dark:border-[var(--color-border)]">
              <h3 id={slugify(section.title)} className="text-lg font-semibold text-[var(--color-text)] dark:text-[var(--color-text)] mb-4 flex items-center gap-2 scroll-mt-32">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-600 text-sm font-bold dark:bg-blue-900 dark:text-blue-300">
                  {index + 1}
                </span>
                {section.title}
              </h3>
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const isInline = !match && !className;
                      if (isInline) {
                        return (
                          <code className="bg-[var(--color-bg)] dark:bg-[var(--color-bg)] px-1.5 py-0.5 rounded font-mono text-sm" {...props}>
                            {children}
                          </code>
                        );
                      }
                      return (
                        <pre className="bg-zinc-900 dark:bg-zinc-950 text-zinc-100 rounded-lg p-4 overflow-x-auto my-4">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      );
                    },
                    p({ children }) {
                      return <p className="text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)] leading-relaxed my-3">{children}</p>;
                    },
                    ul({ children }) {
                      return <ul className="list-disc list-inside my-3 space-y-1 text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)]">{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol className="list-decimal list-inside my-3 space-y-1 text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)]">{children}</ol>;
                    },
                    li({ children }) {
                      return <li className="text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)]">{children}</li>;
                    },
                    strong({ children }) {
                      return <strong className="font-semibold text-[var(--color-text)] dark:text-[var(--color-text)]">{children}</strong>;
                    },
                    h4({ children }) {
                      return <h4 className="font-semibold text-[var(--color-text)] dark:text-[var(--color-text)] mt-4 mb-2">{children}</h4>;
                    },
                    blockquote({ children }) {
                      return <blockquote className="border-l-4 border-blue-500 pl-4 my-3 italic text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)]">{children}</blockquote>;
                    },
                  }}
                >
                  {section.content}
                </ReactMarkdown>
              </div>
            </div>
          </FadeInSection>
        ))}
      </div>

      {/* 关键收获 */}
      <FadeInSection delay={0.4}>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 dark:border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-[var(--color-text)] dark:text-[var(--color-text)]">
              {locale === "en" ? "Key Takeaways" : "关键收获"}
            </h3>
          </div>
          <ul className="space-y-3">
            {content.keyTakeaways.map((takeaway: string, index: number) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-xs font-bold dark:bg-amber-900 dark:text-amber-300 mt-0.5">
                  ✓
                </span>
                <span className="text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)]">{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>
      </FadeInSection>

      {/* 相关源码文件 */}
      <FadeInSection delay={0.5}>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 dark:border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-4">
            <FileCode className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-[var(--color-text)] dark:text-[var(--color-text)]">
              {locale === "en" ? "Related Source Files" : "相关源码文件"}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {content.relatedFiles.map((file: string, index: number) => (
              <code
                key={index}
                className="rounded-md bg-[var(--color-bg)] px-3 py-1.5 text-sm font-mono text-[var(--color-text)] dark:bg-[var(--color-bg)] dark:text-[var(--color-text)]"
              >
                {file}
              </code>
            ))}
          </div>
        </div>
      </FadeInSection>

      {/* 扩展阅读 */}
      <FadeInSection delay={0.6}>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 dark:border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-[var(--color-text)] dark:text-[var(--color-text)]">
              {locale === "en" ? "Dive Deeper into Source Code" : "深入源码研究"}
            </h3>
          </div>
          <p className="text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)] mb-4">
            {locale === "en"
              ? "The best way to understand these concepts is to read the actual source code. Here are the key files to explore:"
              : "理解这些概念的最佳方式是阅读实际源码。以下是值得深入研究的关键文件："}
          </p>
          <ul className="space-y-2 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-secondary)]">
            {content.relatedFiles.map((file: string, index: number) => (
              <li key={index} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <code className="font-mono text-xs">{file.split(" (")[0]}</code>
              </li>
            ))}
          </ul>
        </div>
      </FadeInSection>
    </div>
  );
}
