import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { getXp } from "@/db/experience";
import { getSession } from "@/lib/session";
import { LevelBadge } from "@/ui/components/LevelBadge";
import { XpProvider } from "@/ui/components/XpProvider";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Questline",
  description: "Trello-style gaming backlog manager.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  const xp = session?.user.emailVerified ? await getXp(session.user.id) : null;

  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <XpProvider initialXp={xp}>
          {children}
          <LevelBadge />
        </XpProvider>
      </body>
    </html>
  );
}
