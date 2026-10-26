"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { changeEmailSchema, deleteAccountSchema, type ChangeEmailFormState } from "./schema";
import type { ActionResult } from "@/app/boards/[id]/schema";
import { resetXp } from "@/db/experience";
import { auth, EMAIL_RATE_LIMIT } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { requireVerifiedSession } from "@/lib/session";

export async function submitChangeEmailForm(
  prevState: ChangeEmailFormState,
  formData: FormData,
): Promise<ChangeEmailFormState> {
  const validatedFields = changeEmailSchema.safeParse({
    newEmail: formData.get("new-email"),
  });

  if (!validatedFields.success) {
    return { success: false, errors: z.flattenError(validatedFields.error).fieldErrors };
  }

  const session = await requireVerifiedSession();
  const newEmail = validatedFields.data.newEmail.toLowerCase();
  if (newEmail === session.user.email) {
    return { success: false, errors: { newEmail: ["That's already your email"] } };
  }

  // Keyed on the account rather than the address, since every request mails the current inbox.
  const limit = await consumeRateLimit(`/change-email:${session.user.id}`, EMAIL_RATE_LIMIT);
  if (!limit.allowed) {
    return {
      success: false,
      errors: { newEmail: ["Too many email changes requested. Please wait before trying again."] },
      retryAfter: limit.retryAfter,
    };
  }

  try {
    // Reports success even when the new address is taken, so this doesn't reveal who has an account.
    await auth.api.changeEmail({
      body: { newEmail, callbackURL: "/profile" },
      headers: await headers(),
    });
  } catch (error) {
    console.error("Change email request failed:", error);
    return { success: false, errors: { newEmail: ["Something went wrong. Try again."] } };
  }

  return { success: true, retryAfter: EMAIL_RATE_LIMIT.cooldown };
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

export async function resetXpAction(): Promise<ActionResult> {
  const session = await requireVerifiedSession();
  await resetXp(session.user.id);
  return { success: true, data: undefined };
}

export async function deleteAccountAction(input: z.input<typeof deleteAccountSchema>): Promise<ActionResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  await requireVerifiedSession();
  try {
    await auth.api.deleteUser({
      body: { password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
      return { success: false, error: "Incorrect password" };
    }
    throw error;
  }

  redirect("/");
}
