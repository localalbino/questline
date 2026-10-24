import type { PropsWithChildren } from "react";

/** Top bar for app pages. Leaves room on the right for the fixed LevelBadge. */
export function PageHeader({ children }: PropsWithChildren) {
  return (
    <header className="flex h-13 shrink-0 items-center gap-4 border-b border-zinc-800 pr-48 pl-4 sm:pr-72">
      {children}
    </header>
  );
}
