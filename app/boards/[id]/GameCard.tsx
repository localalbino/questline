import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { xpForTimeToBeat } from "@/lib/experience";
import { cn } from "cn";
import Image from "next/image";
import { useState } from "react";
import { cardKey, stopDragKeys, type DragData } from "./dnd";
import type { BoardCard } from "./types";

type CardChanges = Partial<Pick<BoardCard, "isCompleted" | "dueDate">>;

const cardClassName = "flex gap-3 bg-zinc-800 p-2";

export function GameCard({
  card,
  groupId,
  onUpdate,
  onDelete,
}: {
  card: BoardCard;
  groupId: number;
  onUpdate: (changes: CardChanges) => void;
  onDelete: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: cardKey(card.id),
    data: { type: "card", cardId: card.id, groupId } satisfies DragData,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        cardClassName,
        "group relative cursor-grab hover:ring-1 hover:ring-zinc-700 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <CardContents card={card} onUpdate={onUpdate} />
      <button
        type="button"
        onClick={onDelete}
        onKeyDown={stopDragKeys}
        className="absolute top-1 right-1 px-1 text-xs text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 focus-visible:opacity-100"
        aria-label={`Delete ${card.game?.title ?? "game"}`}
        title="Delete game"
      >
        ✕
      </button>
    </li>
  );
}

/** Static copy of a card rendered under the pointer while it's being dragged. */
export function GameCardPreview({ card }: { card: BoardCard }) {
  return (
    <div className={cn(cardClassName, "w-66 cursor-grabbing shadow-xl ring-1 ring-emerald-500")}>
      <CardContents card={card} />
    </div>
  );
}

function CardContents({ card, onUpdate }: { card: BoardCard; onUpdate?: (changes: CardChanges) => void }) {
  const title = card.game?.title ?? `Unknown game #${card.gameId}`;

  return (
    <>
      <BoxArt url={card.game?.boxArtUrl ?? null} title={title} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
        <span className={cn("line-clamp-2 pr-4 text-sm", card.isCompleted && "text-zinc-500 line-through")}>
          {title}
        </span>
        <XpReward xp={xpForTimeToBeat(card.game?.timeToBeat ?? null)} isCompleted={card.isCompleted} />
        <DueDate
          dueDate={card.dueDate}
          isCompleted={card.isCompleted}
          onChange={onUpdate && ((dueDate) => onUpdate({ dueDate }))}
        />
        <label className="mt-auto flex w-fit cursor-pointer items-center gap-1.5 text-zinc-500 hover:text-zinc-400">
          <input
            type="checkbox"
            checked={card.isCompleted}
            disabled={!onUpdate}
            onChange={(e) => onUpdate?.({ isCompleted: e.target.checked })}
            onKeyDown={stopDragKeys}
            className="accent-emerald-500"
          />
          {card.isCompleted ? "Completed" : "Not completed"}
        </label>
      </div>
    </>
  );
}

function XpReward({ xp, isCompleted }: { xp: number | null; isCompleted: boolean }) {
  if (xp === null) return <span className="text-zinc-600">No XP data</span>;
  if (isCompleted) return <span className="text-emerald-500">{xp} XP earned</span>;
  return <span className="text-zinc-500">+{xp} XP</span>;
}

function BoxArt({ url, title }: { url: string | null; title: string }) {
  // IGDB's t_cover_big is 264x374; keep that aspect ratio.
  if (!url) {
    return (
      <div className="flex h-[78px] w-14 shrink-0 items-center justify-center bg-zinc-900 text-xs text-zinc-700">?</div>
    );
  }
  return (
    <Image
      src={url}
      alt={`${title} box art`}
      width={56}
      height={78}
      draggable={false}
      className="h-[78px] w-14 shrink-0 bg-zinc-900 object-cover"
    />
  );
}

function DueDate({
  dueDate,
  isCompleted,
  onChange,
}: {
  dueDate: Date | null;
  isCompleted: boolean;
  onChange?: (dueDate: Date | null) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && onChange) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={dueDate ? toDateInputValue(dueDate) : ""}
        onBlur={(e) => {
          setEditing(false);
          const value = e.target.value ? fromDateInputValue(e.target.value) : null;
          if (value?.getTime() !== dueDate?.getTime()) onChange(value);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-fit bg-zinc-900 px-1 text-zinc-400 [color-scheme:dark]"
        aria-label="Due date"
      />
    );
  }

  const overdue = dueDate && !isCompleted && toDateInputValue(dueDate) < toDateInputValue(new Date());
  return (
    <button
      type="button"
      disabled={!onChange}
      onClick={() => setEditing(true)}
      onKeyDown={stopDragKeys}
      className={cn(
        "w-fit text-left enabled:hover:text-zinc-300",
        overdue ? "text-red-400" : dueDate ? "text-zinc-400" : "text-zinc-600",
      )}
      title="Set due date"
    >
      {dueDate ? `Due ${formatDueDate(dueDate)}` : "No due date"}
    </button>
  );
}

// Due dates are calendar days stored as UTC midnight, so read and write them in UTC to avoid
// shifting a day depending on the viewer's time zone.
function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fromDateInputValue(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function formatDueDate(date: Date): string {
  // Fixed locale so the server and client render the same text.
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
