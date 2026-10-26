import { useState } from "react";
import { groupTitleSchema } from "./schema";

/** Trello-style "+ Add column" tile that expands into an inline form. */
export function AddColumnForm({ onAdd }: { onAdd: (title: string) => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function close() {
    setOpen(false);
    setTitle("");
    setError(null);
  }

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = groupTitleSchema.safeParse(title);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setPending(true);
    const actionError = await onAdd(parsed.data);
    setPending(false);
    if (actionError) {
      setError(actionError);
      return;
    }
    // Stay open so several columns can be added in a row, like Trello.
    setTitle("");
    setError(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-72 shrink-0 border border-dashed border-zinc-800 px-3 py-3 text-left text-zinc-600 hover:border-emerald-500 hover:text-emerald-500"
      >
        + Add column
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-72 shrink-0 flex-col gap-2 bg-zinc-900 p-3">
      <input
        autoFocus
        value={title}
        maxLength={30}
        placeholder="Column title"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && close()}
        className="w-full bg-zinc-800 px-2 py-1 text-zinc-400 caret-emerald-500"
        aria-label="Column title"
      />
      {error && <span className="text-sm text-red-400">{error}</span>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-emerald-500 px-2 py-1 text-zinc-900 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add column
        </button>
        <button type="button" onClick={close} className="px-2 py-1 text-zinc-600 hover:text-zinc-400">
          Cancel
        </button>
      </div>
    </form>
  );
}
