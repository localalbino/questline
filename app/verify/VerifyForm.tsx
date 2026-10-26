"use client";

import { FormLayout } from "@/ui/components/FormLayout";
import { SubmitButton } from "@/ui/components/SubmitButton";
import { useActionState } from "react";
import { signOutFromVerify, submitVerifyForm } from "./actions";
import { FormFooter } from "@/ui/components/FormFooter";
import { FormMessage } from "@/ui/components/FormMessage";
import { OutlineButton } from "@/ui/components/OutlineButton";
import { useCooldown } from "@/ui/hooks/useCooldown";

type VerifyFormProps = {
  email: string;
  linkInvalid: boolean;
  retryAfter: number;
};

export function VerifyForm({ email, linkInvalid, retryAfter }: VerifyFormProps) {
  const [cooldown, setCooldown] = useCooldown(retryAfter);
  const [state, formAction, isPending] = useActionState(async () => {
    const result = await submitVerifyForm();
    if (result?.retryAfter) setCooldown(result.retryAfter);
    return result;
  }, null);

  return (
    <FormLayout title="Verify your account">
      <form action={formAction} className="flex flex-col gap-4">
        <span className="text-zinc-600">Your account isn&apos;t verified yet.</span>
        {linkInvalid && !state && (
          <FormMessage variant="error">That verification link is invalid or has expired. Send a new one.</FormMessage>
        )}
        {state?.success && (
          <FormMessage variant="success">Verification email sent to {email}. Check your inbox.</FormMessage>
        )}
        {state?.error && <FormMessage variant="error">{state.error}</FormMessage>}
        <SubmitButton pending={isPending} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Send verification email"}
        </SubmitButton>
      </form>
      <FormFooter>
        <form action={signOutFromVerify} className="flex flex-col gap-2">
          <span className="text-center text-sm text-zinc-600">Not {email}?</span>
          <OutlineButton type="submit">Sign out</OutlineButton>
        </form>
      </FormFooter>
    </FormLayout>
  );
}
