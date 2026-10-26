"use client";

import { useActionState } from "react";
import { submitForgotPasswordForm } from "./actions";
import type { ForgotPasswordFormState } from "./schema";
import { FormLayout } from "@/ui/components/FormLayout";
import { FormInput } from "@/ui/components/FormField";
import { FormFooter } from "@/ui/components/FormFooter";
import { FormMessage } from "@/ui/components/FormMessage";
import { LinkPrompt } from "@/ui/components/LinkPrompt";
import { SubmitButton } from "@/ui/components/SubmitButton";
import { useCooldown } from "@/ui/hooks/useCooldown";

export function ForgotPasswordForm() {
  const [cooldown, setCooldown] = useCooldown();
  const [state, formAction, pending] = useActionState(
    async (prevState: ForgotPasswordFormState, formData: FormData) => {
      const result = await submitForgotPasswordForm(prevState, formData);
      if (result?.retryAfter) setCooldown(result.retryAfter);
      return result;
    },
    null,
  );

  return (
    <FormLayout title="Forgot password">
      <form action={formAction} className="flex flex-col gap-4">
        <FormInput id="email" label="Email" type="email" placeholder="Email Address" errors={state?.errors?.email} />
        {state?.success && (
          <FormMessage variant="success">
            A reset link was sent if there is an associated account with that email
          </FormMessage>
        )}
        <SubmitButton pending={pending} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Send reset link"}
        </SubmitButton>
      </form>
      <FormFooter>
        <LinkPrompt prompt="Remembered your password?" href="/login" linkText="Sign in here" />
      </FormFooter>
    </FormLayout>
  );
}
