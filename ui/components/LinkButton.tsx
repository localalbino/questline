import Link, { LinkProps } from "next/link";
import { PropsWithChildren } from "react";

const variants = {
  primary: "bg-emerald-500 text-zinc-900 hover:bg-emerald-400",
  outline: "border border-emerald-500 text-emerald-500 hover:bg-emerald-500/10",
};

type LinkButtonProps = PropsWithChildren<Omit<LinkProps, "className">> & {
  variant?: keyof typeof variants;
};

export function LinkButton({ href, variant = "primary", children, ...props }: LinkButtonProps) {
  return (
    <Link className={`px-2 py-1 text-center ${variants[variant]}`} href={href} {...props}>
      {children}
    </Link>
  );
}
