import type { ComponentProps } from "react";

/** Secondary action, outlined to sit below the primary SubmitButton. */
export function OutlineButton({ type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className="border border-emerald-500 px-2 py-1 text-emerald-500 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    />
  );
}
