"use client";

import Link from "next/link";
import { useDemo } from "./DemoProvider";

export function DemoBanner() {
  const { reset } = useDemo();
  return (
    <footer className="mt-auto flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
      <span>
        <span className="text-emerald-500">Demo</span> · Changes stay in this tab and are never saved.
      </span>
      <button type="button" onClick={reset} className="hover:text-zinc-300">
        Reset demo
      </button>
      <Link href="/signup" className="ml-auto text-emerald-500 hover:text-emerald-400">
        Sign up to keep your boards →
      </Link>
    </footer>
  );
}
