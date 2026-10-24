import { z } from "zod";

const id = z.int().positive();

// Matches the varchar(30) on groups.title.
export const groupTitleSchema = z
  .string()
  .trim()
  .min(1, "Column title can't be empty")
  .max(30, "Column title must be at most 30 characters");

export const createGroupSchema = z.object({ boardId: id, title: groupTitleSchema });
export const renameGroupSchema = z.object({ groupId: id, title: groupTitleSchema });
export const moveGroupSchema = z.object({ groupId: id, toIndex: z.int().nonnegative() });

export const addCardSchema = z.object({ groupId: id, gameId: id });
export const moveCardSchema = z.object({ cardId: id, toGroupId: id, toIndex: z.int().nonnegative() });
export const updateCardSchema = z.object({
  cardId: id,
  isCompleted: z.boolean().optional(),
  dueDate: z.date().nullable().optional(),
});

export type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };
