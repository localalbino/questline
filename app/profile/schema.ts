import { z } from "zod";

export const changeEmailSchema = z.object({
  newEmail: z.email("Invalid email address"),
});

export type ChangeEmailFormState = {
  success: boolean;
  errors?: Partial<Record<keyof z.infer<typeof changeEmailSchema>, string[]>>;
  /** Seconds until another change can be requested. */
  retryAfter?: number;
} | null;

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password"),
});
