import type { Metadata } from "next";
import { redirectIfSignedIn } from "@/lib/session";
import { createDemoState, DEMO_GAME_IDS } from "./demo-boards";
import { DemoBanner } from "./DemoBanner";
import { DemoProvider } from "./DemoProvider";
import { getDemoGameDetails } from "./games";

export const metadata: Metadata = { title: "Questline demo" };

/** The demo: the real board UI over boards that only exist in the visitor's browser. Nothing is saved. */
export default async function DemoLayout({ children }: LayoutProps<"/demo">) {
  // Signed-in users already have the real thing, and their level badge would clash with the demo's.
  await redirectIfSignedIn();
  const initialState = createDemoState(await getDemoGameDetails(DEMO_GAME_IDS), new Date());

  return (
    <div className="flex h-dvh flex-col">
      <DemoProvider initialState={initialState}>
        {children}
        <DemoBanner />
      </DemoProvider>
    </div>
  );
}
