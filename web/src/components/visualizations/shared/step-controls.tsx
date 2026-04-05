"use client";

import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepControls({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  onReset,
  isPlaying,
  onToggleAutoPlay,
  stepTitle,
  stepDescription,
}: {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  isPlaying: boolean;
  onToggleAutoPlay: () => void;
  stepTitle: string;
  stepDescription: string;
}) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {stepTitle}
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {stepDescription}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={onReset}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={onPrev}
            disabled={currentStep === 0}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <motion.div
            className="absolute left-0 top-0 h-full bg-blue-500"
            initial={false}
            animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <span className="min-w-[3rem] text-center font-mono text-xs text-zinc-400">
          {currentStep + 1}/{totalSteps}
        </span>

        <button
          onClick={onNext}
          disabled={currentStep === totalSteps - 1}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={onToggleAutoPlay}
          className={cn(
            "rounded-md p-1.5",
            isPlaying
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          )}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
    </div>
  );
}