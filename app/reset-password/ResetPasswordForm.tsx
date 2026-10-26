"use client";

import { useActionState } from "react";
import { submitResetPasswordForm } from "./actions";
import { FormLayout } from "@/ui/components/FormLayout";
import { FormInput } from "@/ui/components/FormField";
import { FormFooter } from "@/ui/components/FormFooter";
import { FormMessage } from "@/ui/components/FormMessage";
import { LinkPrompt } from "@/ui/components/LinkPrompt";
import { SubmitButton } from "@/ui/components/SubmitButton";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(submitResetPasswordForm.bind(null, token), null);

  return (
    <FormLayout title="Reset password">
      <form action={formAction} className="flex flex-col gap-4">
        <FormInput
          id="new-password"
          label="New Password"
          placeholder="Your password"
          type="password"
          errors={state?.errors?.newPassword}
        />
        <FormInput
          id="confirm-password"
          label="Confirm Password"
          placeholder="Your password"
          type="password"
          errors={state?.errors?.confirmPassword}
        />
        {state?.errors?.token && <FormMessage variant="error">{state.errors.token[0]}</FormMessage>}
        <SubmitButton pending={isPending}>Reset Password</SubmitButton>
      </form>
      <FormFooter>
        <LinkPrompt prompt="Didn't get a reset password email?" href="/forgot-password" linkText="Forgot password" />
      </FormFooter>
    </FormLayout>
  );
}
