import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { after } from "next/server";
import { Resend } from "resend";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { consumeRateLimit, getRetryAfter, type RateLimitRule } from "@/lib/rate-limit";

const resend = new Resend(process.env.RESEND_API_KEY);

export const PASSWORD_REUSED_CODE = "PASSWORD_REUSED";
export const USER_EXISTS_CODE = "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";
export const RATE_LIMITED_CODE = "RATE_LIMITED";

// Limit per email address on endpoints that send email, so nobody can flood an inbox.
export const EMAIL_RATE_LIMIT: RateLimitRule = { cooldown: 60, max: 5, window: 60 * 60 };
const EMAIL_RATE_LIMITED_PATHS = ["/send-verification-email", "/request-password-reset"] as const;
type EmailRateLimitedPath = (typeof EMAIL_RATE_LIMITED_PATHS)[number];

function emailRateLimitKey(path: EmailRateLimitedPath, email: string) {
  return `${path}:${email.trim().toLowerCase()}`;
}

/** Seconds until another email can be sent to `email` from `path`, or 0 if one can be sent now. */
export function getEmailRetryAfter(path: EmailRateLimitedPath, email: string) {
  return getRetryAfter(emailRateLimitKey(path, email), EMAIL_RATE_LIMIT);
}

/** The seconds to wait if `error` is a rate limit rejection from the hook below, otherwise null. */
export function getRateLimitedRetryAfter(error: unknown): number | null {
  if (!(error instanceof APIError) || error.body?.code !== RATE_LIMITED_CODE) return null;
  return Number(error.body.retryAfter) || EMAIL_RATE_LIMIT.cooldown;
}

async function sendEmail(to: string, subject: string, text: string) {
  const { error } = await resend.emails.send({
    from: "Questline <noreply@verify.questline.localalbino.com>",
    to,
    subject,
    text,
  });

  if (error) {
    throw new Error(`Failed to send "${subject}" email: [${error.name}] ${error.message}`);
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: ({ user, url }) =>
      sendEmail(
        user.email,
        "Verify your account",
        `Click this link to verify your account: ${url}\n\nDidn't create an account? Ignore this email.`,
      ),
  },
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: ({ user, url }) =>
      sendEmail(
        user.email,
        "Reset your password",
        `Click this link to reset your password: ${url}\n\nDidn't request a password reset? Ignore this email.`,
      ),
  },
  user: {
    changeEmail: {
      enabled: true,
      // Asks the current address to approve first. Approving sends a verification link to the new
      // address, and the email only changes once that one is clicked too.
      sendChangeEmailConfirmation: ({ user, newEmail, url }) =>
        sendEmail(
          user.email,
          "Confirm your email change",
          `Someone asked to change your Questline email to ${newEmail}. Click this link to approve it: ${url}\n\nDidn't ask for this? Ignore this email and change your password.`,
        ),
    },
    // Deletion asks for the password (see app/profile/actions.ts). Boards and XP cascade with the user.
    deleteUser: { enabled: true },
  },
  advanced: {
    // Emails are sent after the response so response time doesn't reveal whether the account exists.
    // Better Auth catches and logs failures before handing the promise over.
    backgroundTasks: { handler: (promise) => after(promise) },
  },
  hooks: {
    // Reject a reset to the user's current password. This runs before the endpoint so the reset
    // token isn't consumed and the user can try again with a different password.
    before: createAuthMiddleware(async (ctx) => {
      // Runs for server action calls through auth.api too, which skip Better Auth's own rate limiter.
      const path = EMAIL_RATE_LIMITED_PATHS.find((p) => p === ctx.path);
      const email: unknown = ctx.body?.email;
      if (path && typeof email === "string") {
        const result = await consumeRateLimit(emailRateLimitKey(path, email), EMAIL_RATE_LIMIT);
        if (!result.allowed) {
          throw new APIError(
            "TOO_MANY_REQUESTS",
            {
              message: "Too many requests. Please try again later.",
              code: RATE_LIMITED_CODE,
              retryAfter: result.retryAfter,
            },
            { "Retry-After": String(result.retryAfter) },
          );
        }
        return;
      }

      if (ctx.path !== "/reset-password") return;

      const token: string | undefined = ctx.body?.token || ctx.query?.token;
      const newPassword: string | undefined = ctx.body?.newPassword;
      if (!token || !newPassword) return;

      const verification = await ctx.context.internalAdapter.findVerificationValue(`reset-password:${token}`);
      if (!verification || new Date(verification.expiresAt) < new Date()) return;

      const account = await ctx.context.internalAdapter.findCredentialAccount(verification.value);
      if (!account?.password) return;

      if (await ctx.context.password.verify({ hash: account.password, password: newPassword })) {
        throw new APIError("BAD_REQUEST", {
          message: "New password must be different from your current password",
          code: PASSWORD_REUSED_CODE,
        });
      }
    }),
  },
  // nextCookies must be the last plugin so cookies set in server actions are applied
  plugins: [nextCookies()],
});
