import type { KeyboardEvent } from "react";

// Sortable ids share one namespace across columns and cards, so prefix them.
export type DragData = { type: "group"; groupId: number } | { type: "card"; cardId: number; groupId: number };
export const groupKey = (id: number) => `group-${id}`;
export const cardKey = (id: number) => `card-${id}`;

/**
 * Controls nested inside a draggable would otherwise bubble Enter/Space up to the keyboard sensor
 * and pick up the column or card instead of activating themselves.
 */
export function stopDragKeys(event: KeyboardEvent) {
  event.stopPropagation();
}
