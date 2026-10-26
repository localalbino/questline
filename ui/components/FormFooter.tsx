import type { PropsWithChildren } from "react";

/** Secondary links under a form, set off by a divider like the profile page's sections. */
export function FormFooter({ children }: PropsWithChildren) {
  return <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">{children}</div>;
}
