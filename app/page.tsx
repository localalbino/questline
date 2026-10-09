import { LinkButton } from "@/ui/components/LinkButton";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl">Questline</h1>
        <p className="max-w-md text-zinc-400 sm:text-lg">Time to clear out your gaming backlog.</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-4 sm:max-w-md sm:flex-row">
        <div className="flex flex-1 flex-col">
          <LinkButton href="/signup">Sign up</LinkButton>
        </div>
        <div className="flex flex-1 flex-col">
          <LinkButton href="/login" variant="outline">
            Sign in
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
