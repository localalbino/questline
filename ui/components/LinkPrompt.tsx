import Link from "next/link";

type LinkPromptProps = {
  prompt: string;
  href: string;
  linkText: string;
};

export function LinkPrompt({ prompt, href, linkText }: LinkPromptProps) {
  return (
    <div className="flex flex-wrap justify-center gap-x-2 text-center text-sm">
      <span className="text-zinc-600">{prompt}</span>
      <Link className="text-emerald-500 hover:underline" href={href}>
        {linkText}
      </Link>
    </div>
  );
}
