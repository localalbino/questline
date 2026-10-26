import { z } from "zod";

export const createBoardSchema = z.object({
  // Matches the varchar(30) on boards.title.
  title: z
    .string()
    .trim()
    .min(2, "Board title must be at least 2 characters")
    .max(30, "Board title must be at most 30 characters"),
});

export type CreateBoardFormState = {
  success: boolean;
  errors?: Partial<Record<keyof z.infer<typeof createBoardSchema>, string[]>>;
} | null;
