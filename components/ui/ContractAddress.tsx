"use client";
import { useEffect, useState } from "react";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_LOTTO_TOKEN_MINT ?? "4rjjZswXG4JUcRDsPqzK7Ukx5eZRsG1jTVjaMDpapump";

function shorten(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function ContractAddress() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      } else {
        const ta = document.createElement("textarea");
        ta.value = CONTRACT_ADDRESS;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : `Copy contract address: ${CONTRACT_ADDRESS}`}
      aria-label="Copy contract address"
      className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 font-mono text-xs text-mist transition-colors hover:bg-white/[0.09] hover:text-frost focus-visible:outline focus-visible:outline-2 focus-visible:outline-aqua"
    >
      <span className="font-display font-semibold text-aqua">CA</span>
      <span className="hidden lg:inline">{shorten(CONTRACT_ADDRESS)}</span>
      <span
        aria-hidden
        className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] transition-colors ${
          copied ? "bg-mint/20 text-mint" : "bg-white/[0.07] text-mist group-hover:text-frost"
        }`}
      >
        {copied ? "✓" : "⧉"}
      </span>
      <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
