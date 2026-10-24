"use client";

import {
  closestCenter,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useXp } from "@/ui/components/XpProvider";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { createGroupAction, moveCardAction, moveGroupAction, renameGroupAction, updateCardAction } from "./actions";
import { AddColumnForm } from "./AddColumnForm";
import { BoardColumn, ColumnPreview } from "./BoardColumn";
import { GameCardPreview } from "./GameCard";
import { GameSearchDialog } from "./GameSearchDialog";
import type { ActionResult } from "./schema";
import type { BoardCard, BoardGroup } from "./types";
import { groupKey, type DragData } from "./dnd";

function findCard(groups: BoardGroup[], cardId: number) {
  for (const [groupIndex, group] of groups.entries()) {
    const cardIndex = group.cards.findIndex((card) => card.id === cardId);
    if (cardIndex !== -1) return { groupIndex, cardIndex, groupId: group.id, card: group.cards[cardIndex] };
  }
  return null;
}

function withGroupCards(groups: BoardGroup[], groupId: number, update: (cards: BoardCard[]) => BoardCard[]) {
  return groups.map((group) => (group.id === groupId ? { ...group, cards: update(group.cards) } : group));
}

/*
 * Columns only collide with columns, preferring the one under the pointer. Cards prefer the card
 * under the pointer, then fall back to the column under the pointer and the closest card within it,
 * so dragging into the empty space of a column still lands somewhere sensible.
 */
const collisionDetection: CollisionDetection = (args) => {
  const type = (args.active.data.current as DragData | undefined)?.type;
  if (type === "group") {
    const groupArgs = {
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === "group"),
    };
    const pointerHits = pointerWithin(groupArgs);
    return pointerHits.length > 0 ? pointerHits : closestCenter(groupArgs);
  }

  const pointerHits = pointerWithin(args);
  const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
  const cardHit = hits.find((hit) => String(hit.id).startsWith("card-"));
  if (cardHit) return [cardHit];

  const groupHit = hits.find((hit) => String(hit.id).startsWith("group-"));
  if (!groupHit) return [];
  const groupId = (args.droppableContainers.find((c) => c.id === groupHit.id)?.data.current as DragData).groupId;
  const cardsInGroup = args.droppableContainers.filter(
    (c) => c.data.current?.type === "card" && c.data.current.groupId === groupId && c.id !== args.active.id,
  );
  return cardsInGroup.length > 0 ? closestCenter({ ...args, droppableContainers: cardsInGroup }) : [groupHit];
};

export function BoardView({ boardId, initialGroups }: { boardId: number; initialGroups: BoardGroup[] }) {
  const router = useRouter();
  const { setXp } = useXp();
  const dndId = useId();

  // Local state is the source of truth while editing; actions persist in the background.
  // A server refresh (e.g. after a failed action) hands us fresh props, which replace it.
  const [groups, setGroups] = useState(initialGroups);
  const [prevInitialGroups, setPrevInitialGroups] = useState(initialGroups);
  if (initialGroups !== prevInitialGroups) {
    setPrevInitialGroups(initialGroups);
    setGroups(initialGroups);
  }

  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<DragData | null>(null);
  const [searchGroupId, setSearchGroupId] = useState<number | null>(null);
  // Where the board stood when the drag started, to diff against on drop and restore on cancel.
  const dragStartGroups = useRef<BoardGroup[] | null>(null);

  const sensors = useSensors(
    // A small distance keeps clicks on titles, checkboxes, etc. from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function persist<T>(action: Promise<ActionResult<T>>, onSuccess?: (data: T) => void) {
    const fail = (message: string) => {
      setError(message);
      router.refresh();
    };
    action.then(
      (result) => (result.success ? onSuccess?.(result.data) : fail(result.error)),
      () => fail("Something went wrong. Your board has been reloaded."),
    );
  }

  function handleDragStart({ active }: DragStartEvent) {
    setError(null);
    setActive(active.data.current as DragData);
    dragStartGroups.current = groups;
  }

  // Moving between columns happens live during the drag so the card has a slot to animate into.
  // Reordering within a column is left to the sortable strategy until the drop.
  function handleDragOver({ active, over }: DragOverEvent) {
    const dragged = active.data.current as DragData;
    const target = over?.data.current as DragData | undefined;
    if (dragged.type !== "card" || !over || !target) return;

    const from = findCard(groups, dragged.cardId);
    if (!from || from.groupId === target.groupId) return;
    const toCards = groups.find((group) => group.id === target.groupId)?.cards;
    if (!toCards) return;

    let toIndex = toCards.length;
    if (target.type === "card") {
      const overIndex = toCards.findIndex((card) => card.id === target.cardId);
      const translated = active.rect.current.translated;
      const isBelow = translated && translated.top > over.rect.top + over.rect.height / 2;
      if (overIndex !== -1) toIndex = overIndex + (isBelow ? 1 : 0);
    }

    setGroups(
      groups.map((group) => {
        if (group.id === from.groupId) return { ...group, cards: group.cards.filter((c) => c.id !== dragged.cardId) };
        if (group.id === target.groupId) return { ...group, cards: group.cards.toSpliced(toIndex, 0, from.card) };
        return group;
      }),
    );
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const dragged = active.data.current as DragData;
    const startGroups = dragStartGroups.current;
    setActive(null);
    dragStartGroups.current = null;
    if (!startGroups) return;

    if (dragged.type === "group") {
      const oldIndex = groups.findIndex((group) => group.id === dragged.groupId);
      const newIndex = groups.findIndex((group) => groupKey(group.id) === over?.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      setGroups(arrayMove(groups, oldIndex, newIndex));
      persist(moveGroupAction({ groupId: dragged.groupId, toIndex: newIndex }));
      return;
    }

    let next = groups;
    const current = findCard(groups, dragged.cardId);
    const target = over?.data.current as DragData | undefined;
    if (current && target?.type === "card" && target.cardId !== dragged.cardId) {
      const overIndex = groups[current.groupIndex].cards.findIndex((card) => card.id === target.cardId);
      if (overIndex !== -1) {
        next = withGroupCards(groups, current.groupId, (cards) => arrayMove(cards, current.cardIndex, overIndex));
        setGroups(next);
      }
    }

    const start = findCard(startGroups, dragged.cardId);
    const end = findCard(next, dragged.cardId);
    if (!start || !end || (start.groupId === end.groupId && start.cardIndex === end.cardIndex)) return;
    persist(moveCardAction({ cardId: dragged.cardId, toGroupId: end.groupId, toIndex: end.cardIndex }));
  }

  function handleDragCancel() {
    if (dragStartGroups.current) setGroups(dragStartGroups.current);
    dragStartGroups.current = null;
    setActive(null);
  }

  async function addColumn(title: string): Promise<string | null> {
    setError(null);
    const result = await createGroupAction({ boardId, title });
    if (!result.success) return result.error;
    setGroups((current) => [...current, result.data]);
    return null;
  }

  function renameColumn(groupId: number, title: string) {
    setError(null);
    setGroups((current) => current.map((group) => (group.id === groupId ? { ...group, title } : group)));
    persist(renameGroupAction({ groupId, title }));
  }

  function updateCard(cardId: number, changes: Partial<Pick<BoardCard, "isCompleted" | "dueDate">>) {
    setError(null);
    setGroups((current) =>
      current.map((group) => ({
        ...group,
        cards: group.cards.map((card) => (card.id === cardId ? { ...card, ...changes } : card)),
      })),
    );
    persist(updateCardAction({ cardId, ...changes }), ({ xp }) => xp !== null && setXp(xp));
  }

  function addCard(groupId: number, card: BoardCard) {
    setGroups((current) => withGroupCards(current, groupId, (cards) => [...cards, card]));
  }

  const activeGroup = active?.type === "group" ? groups.find((group) => group.id === active.groupId) : undefined;
  const activeCard = active?.type === "card" ? findCard(groups, active.cardId)?.card : undefined;
  const searchGroup = groups.find((group) => group.id === searchGroupId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error && (
        <div className="flex items-center justify-between bg-red-400/10 px-4 py-2 text-sm text-red-400">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="hover:text-red-300" aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex min-h-0 flex-1 items-start gap-4 overflow-x-auto p-4">
          <SortableContext items={groups.map((group) => groupKey(group.id))} strategy={horizontalListSortingStrategy}>
            {groups.map((group) => (
              <BoardColumn
                key={group.id}
                group={group}
                onRename={(title) => renameColumn(group.id, title)}
                onAddGame={() => setSearchGroupId(group.id)}
                onUpdateCard={updateCard}
              />
            ))}
          </SortableContext>
          <AddColumnForm onAdd={addColumn} />
        </div>
        <DragOverlay>
          {activeGroup && <ColumnPreview group={activeGroup} />}
          {activeCard && <GameCardPreview card={activeCard} />}
        </DragOverlay>
      </DndContext>
      {searchGroup && (
        <GameSearchDialog
          groupId={searchGroup.id}
          groupTitle={searchGroup.title}
          onAdded={(card) => addCard(searchGroup.id, card)}
          onClose={() => setSearchGroupId(null)}
        />
      )}
    </div>
  );
}
