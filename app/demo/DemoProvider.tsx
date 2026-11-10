"use client";

import { BoardActionsProvider, type BoardActions } from "@/app/boards/board-actions";
import type { ActionResult } from "@/app/boards/[id]/schema";
import { LevelBadge } from "@/ui/components/LevelBadge";
import { XpProvider } from "@/ui/components/XpProvider";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { searchDemoGamesAction } from "./actions";
import * as demo from "./state";
import type { DemoState, Step } from "./state";

// Per tab: a refresh keeps the visitor's changes, closing the tab starts the demo over.
const STORAGE_KEY = "questline-demo-v1";

function loadState(): DemoState | null {
  try {
    const json = sessionStorage.getItem(STORAGE_KEY);
    return json ? demo.parseDemoState(json) : null;
  } catch {
    return null;
  }
}

function saveState(state: DemoState | null) {
  try {
    if (state) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be full or blocked; the demo still works until the tab is refreshed.
  }
}

type DemoContextValue = {
  state: DemoState;
  /** Bumped when the board UI should drop its local state and re-read the store. */
  revision: number;
  createBoard: (title: string) => ActionResult<{ id: number }>;
  reset: () => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemo must be used inside a DemoProvider");
  return context;
}

/** Holds the demo's boards in the browser and hands the board UI actions that change them instead of the database. */
export function DemoProvider({ initialState, children }: PropsWithChildren<{ initialState: DemoState }>) {
  // Null until we've checked session storage, so the pages don't flash the starting boards first.
  const [state, setState] = useState<DemoState | null>(null);
  const [revision, setRevision] = useState(0);
  // Actions read and write through the ref so several in one tick each see the last one's result.
  const stateRef = useRef<DemoState>(initialState);
  const initialStateRef = useRef(initialState);

  useEffect(() => {
    stateRef.current = loadState() ?? initialStateRef.current;
    // Reading session storage has to wait until we're in the browser.
    setState(stateRef.current);
  }, []);

  const value = useMemo(() => {
    function commit(next: DemoState) {
      stateRef.current = next;
      setState(next);
      saveState(next);
    }

    function run<T>(step: (current: DemoState) => Step<T>): ActionResult<T> {
      const { state: next, result } = step(stateRef.current);
      if (result.success && next !== stateRef.current) commit(next);
      return result;
    }

    // Async to match the server actions, though everything here (but search) settles right away.
    const actions: BoardActions = {
      deleteBoard: async (input) => run((s) => demo.deleteBoard(s, input)),
      createGroup: async (input) => run((s) => demo.createGroup(s, input)),
      renameGroup: async (input) => run((s) => demo.renameGroup(s, input)),
      moveGroup: async (input) => run((s) => demo.moveGroup(s, input)),
      deleteGroup: async (input) => run((s) => demo.deleteGroup(s, input)),
      addCard: async (input) => run((s) => demo.addCard(s, input)),
      moveCard: async (input) => run((s) => demo.moveCard(s, input)),
      deleteCard: async (input) => run((s) => demo.deleteCard(s, input)),
      updateCard: async (input) => run((s) => demo.updateCard(s, input, new Date())),
      setStreakWeeks: async (input) => run((s) => demo.setStreakWeeks(s, input, new Date())),
      searchGames: searchDemoGamesAction,
      refresh: () => setRevision((r) => r + 1),
    };

    return {
      actions,
      createBoard: (title: string) => run((s) => demo.createBoard(s, { title })),
      reset: () => {
        saveState(null);
        commit(initialStateRef.current);
        setRevision((r) => r + 1);
      },
    };
  }, []);

  if (!state) return null;

  return (
    <DemoContext value={{ state, revision, createBoard: value.createBoard, reset: value.reset }}>
      <BoardActionsProvider actions={value.actions}>
        <XpProvider initialXp={state.xp}>
          {children}
          <LevelBadge href="/demo" />
        </XpProvider>
      </BoardActionsProvider>
    </DemoContext>
  );
}
