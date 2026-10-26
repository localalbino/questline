"use client";

import { submitLoginForm } from "./actions";
import { useActionState } from "react";
import { FormLayout } from "@/ui/components/FormLayout";
import { FormInput } from "@/ui/components/FormField";
import { FormFooter } from "@/ui/components/FormFooter";
import { FormMessage } from "@/ui/components/FormMessage";
import { LinkPrompt } from "@/ui/components/LinkPrompt";
import { SubmitButton } from "@/ui/components/SubmitButton";

export function LoginForm({ passwordReset }: { passwordReset: boolean }) {
  const [state, formAction, pending] = useActionState(submitLoginForm, null);

  return (
    <FormLayout title="Sign in to Questline">
      <form action={formAction} className="flex flex-col gap-4">
        {passwordReset && !state && (
          <FormMessage variant="success">Password updated. Sign in with your new password.</FormMessage>
        )}
        <FormInput
          id="email"
          label="Email"
          type="email"
          placeholder="Email Address"
          defaultValue={state?.values?.email}
          errors={state?.errors?.email}
        />
        <FormInput
          id="password"
          label="Password"
          type="password"
          placeholder="Your Password"
          errors={state?.errors?.password}
        />
        {state?.errors?.catchAll && <FormMessage variant="error">{state.errors.catchAll[0]}</FormMessage>}
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>
      <FormFooter>
        <LinkPrompt prompt="Don't have an account?" href="/signup" linkText="Create one here" />
        <LinkPrompt prompt="Forgot your password?" href="/forgot-password" linkText="Send reset link" />
      </FormFooter>
    </FormLayout>
  );
}
