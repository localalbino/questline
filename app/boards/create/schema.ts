import { z } from "zod";

export const createBoardSchema = z.object({
  title: z.string().min(2, "Board title must be at least 2 characters"),
});

export type CreateBoardFormState = {
  success: boolean;
  errors?: Partial<Record<keyof z.infer<typeof createBoardSchema>, string[]>>;
} | null;
