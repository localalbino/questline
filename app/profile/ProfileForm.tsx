"use client";

import Link from "next/link";
import { useActionState, useState, type PropsWithChildren } from "react";
import { deleteAccountAction, resetXpAction, signOutAction, submitChangeEmailForm } from "./actions";
import type { ChangeEmailFormState } from "./schema";
import { levelProgress } from "@/lib/experience";
import { ConfirmDeleteDialog } from "@/ui/components/ConfirmDeleteDialog";
import { FormInput } from "@/ui/components/FormField";
import { FormLayout } from "@/ui/components/FormLayout";
import { FormMessage } from "@/ui/components/FormMessage";
import { OutlineButton } from "@/ui/components/OutlineButton";
import { SubmitButton } from "@/ui/components/SubmitButton";
import { useXp } from "@/ui/components/XpProvider";
import { useCooldown } from "@/ui/hooks/useCooldown";

export function ProfileForm({ email, joinedAt }: { email: string; joinedAt: string }) {
  const { xp } = useXp();
  const level = levelProgress(xp ?? 0).level;

  return (
    <FormLayout title="Profile">
      <Section title="Account">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-zinc-600">Email</dt>
          <dd className="truncate text-zinc-400">{email}</dd>
          <dt className="text-zinc-600">Joined</dt>
          <dd className="text-zinc-400">{joinedAt}</dd>
          <dt className="text-zinc-600">Level</dt>
          <dd className="text-zinc-400">
            {level} · {xp ?? 0} XP
          </dd>
        </dl>
        <form action={signOutAction} className="flex flex-col">
          <OutlineButton type="submit">Sign out</OutlineButton>
        </form>
      </Section>
      <ChangeEmailForm email={email} />
      <Section title="Danger zone">
        <ResetXpButton />
        <DeleteAccountButton />
      </Section>
      <Link href="/boards" className="text-center text-sm text-zinc-600 hover:text-emerald-500">
        Back to boards
      </Link>
    </FormLayout>
  );
}

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-zinc-800 pb-1 text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

function ChangeEmailForm({ email }: { email: string }) {
  const [cooldown, setCooldown] = useCooldown();
  const [state, formAction, pending] = useActionState(async (prevState: ChangeEmailFormState, formData: FormData) => {
    const result = await submitChangeEmailForm(prevState, formData);
    if (result?.retryAfter) setCooldown(result.retryAfter);
    return result;
  }, null);

  return (
    <Section title="Change email">
      <form action={formAction} className="flex flex-col gap-4">
        <FormInput
          id="new-email"
          label="New Email"
          type="email"
          placeholder="Email Address"
          errors={state?.errors?.newEmail}
        />
        {state?.success && (
          <FormMessage variant="success">
            Check {email} to approve the change, then verify the new address from its inbox.
          </FormMessage>
        )}
        <SubmitButton pending={pending} disabled={cooldown > 0}>
          {cooldown > 0 ? `Try again in ${cooldown}s` : "Change email"}
        </SubmitButton>
      </form>
    </Section>
  );
}

const dangerButtonClassName =
  "border border-red-400 px-2 py-1 text-red-400 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50";

function ResetXpButton() {
  const { xp, setXp } = useXp();
  const [confirming, setConfirming] = useState(false);

  async function reset(): Promise<string | null> {
    const result = await resetXpAction();
    if (!result.success) return result.error;
    setXp(0);
    return null;
  }

  return (
    <>
      <button type="button" disabled={!xp} onClick={() => setConfirming(true)} className={dangerButtonClassName}>
        Reset XP
      </button>
      {confirming && (
        <ConfirmDeleteDialog
          title="Reset your XP?"
          confirmLabel="Reset XP"
          pendingLabel="Resetting…"
          onConfirm={reset}
          onClose={() => setConfirming(false)}
        >
          You&apos;ll go back to level 1 with 0 XP. Your boards and completed games stay.
        </ConfirmDeleteDialog>
      )}
    </>
  );
}

function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");

  async function deleteAccount(): Promise<string | null> {
    // Redirects home on success, so this only comes back with an error.
    const result = await deleteAccountAction({ password });
    return result.success ? null : result.error;
  }

  return (
    <>
      <button type="button" onClick={() => setConfirming(true)} className={dangerButtonClassName}>
        Delete account
      </button>
      {confirming && (
        <ConfirmDeleteDialog
          title="Delete your account?"
          confirmLabel="Delete account"
          onConfirm={deleteAccount}
          onClose={() => {
            setConfirming(false);
            setPassword("");
          }}
        >
          <div className="flex flex-col gap-4">
            <span>Your boards, games, and XP are deleted with it. This can&apos;t be undone.</span>
            <FormInput
              id="delete-password"
              label="Password"
              type="password"
              placeholder="Your password"
              autoComplete="current-password"
              // Same background as the dialog, so outline it instead.
              className="ring-1 ring-zinc-700"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </ConfirmDeleteDialog>
      )}
    </>
  );
}
