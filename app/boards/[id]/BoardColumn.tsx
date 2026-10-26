import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { useState } from "react";
import { cardKey, groupKey, stopDragKeys, type DragData } from "./dnd";
import { GameCard } from "./GameCard";
import { groupTitleSchema } from "./schema";
import type { BoardCard, BoardGroup } from "./types";

type BoardColumnProps = {
  group: BoardGroup;
  onRename: (title: string) => void;
  onAddGame: () => void;
  onDelete: () => void;
  onDeleteCard: (card: BoardCard) => void;
  onUpdateCard: (cardId: number, changes: Partial<Pick<BoardCard, "isCompleted" | "dueDate">>) => void;
};

const columnClassName = "flex max-h-full w-72 shrink-0 flex-col bg-zinc-900";

export function BoardColumn({ group, onRename, onAddGame, onDelete, onDeleteCard, onUpdateCard }: BoardColumnProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: groupKey(group.id),
    data: { type: "group", groupId: group.id } satisfies DragData,
  });
  const completed = group.cards.filter((card) => card.isCompleted).length;

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(columnClassName, isDragging && "opacity-40")}
      aria-label={group.title}
    >
      {/* The header doubles as the drag handle for the column. */}
      <header
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center gap-2 px-3 pt-3 pb-1 active:cursor-grabbing"
      >
        <ColumnTitle title={group.title} onRename={onRename} />
        <span className="shrink-0 text-xs text-zinc-600">
          {completed}/{group.cards.length}
        </span>
        <button
          type="button"
          onClick={onAddGame}
          onKeyDown={stopDragKeys}
          className="shrink-0 px-1 text-lg leading-none text-emerald-500 hover:text-emerald-400"
          aria-label={`Add a game to ${group.title}`}
          title="Add a game"
        >
          +
        </button>
        <button
          type="button"
          onClick={onDelete}
          onKeyDown={stopDragKeys}
          className="shrink-0 px-1 text-xs text-zinc-600 hover:text-red-400"
          aria-label={`Delete column ${group.title}`}
          title="Delete column"
        >
          ✕
        </button>
      </header>
      <SortableContext items={group.cards.map((card) => cardKey(card.id))} strategy={verticalListSortingStrategy}>
        {/* Top padding leaves room for the first card's hover ring, which the scroll container would clip. */}
        <ol className="flex min-h-12 flex-col gap-2 overflow-y-auto px-3 pt-1 pb-3">
          {group.cards.map((card) => (
            <GameCard
              key={card.id}
              card={card}
              groupId={group.id}
              onUpdate={(changes) => onUpdateCard(card.id, changes)}
              onDelete={() => onDeleteCard(card)}
            />
          ))}
          {group.cards.length === 0 && (
            <li className="border border-dashed border-zinc-800 py-4 text-center text-sm text-zinc-600">
              Drop games here
            </li>
          )}
        </ol>
      </SortableContext>
    </section>
  );
}

function ColumnTitle({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  function save() {
    setEditing(false);
    const parsed = groupTitleSchema.safeParse(draft);
    if (parsed.success && parsed.data !== title) onRename(parsed.data);
    else setDraft(title);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(title);
          setEditing(true);
        }}
        onKeyDown={stopDragKeys}
        className="hover:text-foreground min-w-0 flex-1 truncate text-left text-zinc-400"
        title="Rename column"
      >
        {title}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      maxLength={30}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        // Keep the column's keyboard drag handler from treating typing as a drag.
        e.stopPropagation();
        if (e.key === "Enter") save();
        if (e.key === "Escape") {
          setDraft(title);
          setEditing(false);
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="text-foreground min-w-0 flex-1 bg-zinc-800 px-1 caret-emerald-500"
      aria-label="Column title"
    />
  );
}

/** Static copy of a column rendered under the pointer while it's being dragged. */
export function ColumnPreview({ group }: { group: BoardGroup }) {
  return (
    <div className={cn(columnClassName, "cursor-grabbing shadow-xl ring-1 ring-emerald-500")}>
      <div className="px-3 pt-3 pb-2 text-zinc-400">{group.title}</div>
      <div className="px-3 pb-3 text-sm text-zinc-600">
        {group.cards.length} {group.cards.length === 1 ? "game" : "games"}
      </div>
    </div>
  );
}
