"use client";

import { FormInput } from "@/ui/components/FormField";
import { FormLayout } from "@/ui/components/FormLayout";
import { SubmitButton } from "@/ui/components/SubmitButton";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useDemo } from "../../DemoProvider";

export default function DemoCreateBoardPage() {
  const router = useRouter();
  const { createBoard } = useDemo();
  const [error, formAction, pending] = useActionState(async (_: string | null, formData: FormData) => {
    const result = createBoard(String(formData.get("title") ?? ""));
    if (!result.success) return result.error;
    router.push(`/demo/boards/${result.data.id}`);
    return null;
  }, null);

  return (
    <FormLayout title="New board">
      <form action={formAction} className="flex flex-col gap-4">
        <FormInput id="title" label="Title" errors={error ? [error] : undefined} />
        <SubmitButton pending={pending}>Create board</SubmitButton>
      </form>
    </FormLayout>
  );
}
