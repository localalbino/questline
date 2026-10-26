import { requireVerifiedSession } from "@/lib/session";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const session = await requireVerifiedSession();
  const joinedAt = session.user.createdAt.toLocaleDateString("en-US", { dateStyle: "long" });

  return <ProfileForm email={session.user.email} joinedAt={joinedAt} />;
}
