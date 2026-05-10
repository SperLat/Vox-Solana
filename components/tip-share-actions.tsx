"use client";

import { ArrowUpRight, Clipboard, Check } from "lucide-react";
import { useState } from "react";

export function TipShareActions({ actionUrl, shareUrl }: { actionUrl: string; shareUrl: string }) {
  const [copied, setCopied] = useState<"share" | "action" | null>(null);

  async function copy(value: string, target: "share" | "action") {
    await navigator.clipboard.writeText(value);
    setCopied(target);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-black text-paper transition hover:bg-ink/90"
        onClick={() => void copy(shareUrl, "share")}
      >
        {copied === "share" ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
        Copy share page
      </button>
      <button
        type="button"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink/10 bg-paper px-4 text-sm font-black text-ink transition hover:border-ink/30 hover:bg-white"
        onClick={() => void copy(actionUrl, "action")}
      >
        {copied === "action" ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
        Copy action URL
      </button>
      <a
        href={actionUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink/10 bg-white px-4 text-sm font-black text-ink/70 transition hover:border-ink/30 hover:text-ink"
      >
        View JSON <ArrowUpRight className="h-4 w-4" />
      </a>
    </div>
  );
}
