"use client";

import { submitCreateBoardForm } from "./actions";
import { useActionState } from "react";
import { FormLayout } from "@/ui/components/FormLayout";
import { FormInput } from "@/ui/components/FormField";
import { SubmitButton } from "@/ui/components/SubmitButton";

export function CreateBoardForm() {
  const [state, formAction, pending] = useActionState(submitCreateBoardForm, null);

  return (
    <FormLayout title="New board">
      <form action={formAction} className="flex flex-col gap-4">
        <FormInput id="title" label="Title" errors={state?.errors?.title} />
        <SubmitButton pending={pending}>Create board</SubmitButton>
      </form>
    </FormLayout>
  );
}
