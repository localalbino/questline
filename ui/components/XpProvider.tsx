"use client";

import { createContext, useContext, useState, type PropsWithChildren } from "react";

type XpContextValue = { xp: number | null; setXp: (xp: number) => void };

const XpContext = createContext<XpContextValue>({ xp: null, setXp: () => {} });

/**
 * Holds the signed-in user's XP total, or null when nobody is signed in. The root layout doesn't
 * re-render on navigation, so pages that change XP report the new total through `useXp`.
 */
export function XpProvider({ initialXp, children }: PropsWithChildren<{ initialXp: number | null }>) {
  const [xp, setXp] = useState(initialXp);
  // A server refresh (e.g. signing in) hands us a fresh total, which replaces ours.
  const [prevInitialXp, setPrevInitialXp] = useState(initialXp);
  if (initialXp !== prevInitialXp) {
    setPrevInitialXp(initialXp);
    setXp(initialXp);
  }

  return <XpContext value={{ xp, setXp }}>{children}</XpContext>;
}

export function useXp() {
  return useContext(XpContext);
}
