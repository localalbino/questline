import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type Session = typeof auth.$Infer.Session;

// Cached so multiple checks in one render only hit the database once.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** For guest-only pages (login, signup, etc.): sends signed-in users to where they belong. */
export async function redirectIfSignedIn() {
  const session = await getSession();
  if (session) redirect(session.user.emailVerified ? "/boards" : "/verify");
}

/** For app pages: returns the session if the user is signed in and verified, otherwise redirects. */
export async function requireVerifiedSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.emailVerified) redirect("/verify");
  return session;
}
