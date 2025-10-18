"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const components: Components = {
  // Tables with horizontal scroll on mobile
  table: ({ ...props }) => (
    <div className="overflow-x-auto">
      <table
        className="min-w-full divide-y divide-border"
        {...props}
      />
    </div>
  ),
  // Code blocks with proper styling
  pre: ({ ...props }) => (
    <pre
      className="overflow-x-auto rounded-lg bg-muted/80 p-4 text-sm"
      {...props}
    />
  ),
  // Inline code with better styling
  code: ({ inline, ...props }: { inline?: boolean }) => {
    if (inline) {
      return (
        <code
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground"
          {...props}
        />
      );
    }
    return <code {...props} />;
  },
  // Links with security attributes
  a: ({ ...props }) => (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline decoration-primary/30 hover:decoration-primary/60"
      {...props}
    />
  ),
};

export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "prose prose-slate max-w-none dark:prose-invert prose-headings:font-semibold prose-code:before:hidden prose-code:after:hidden prose-th:border prose-td:border prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
