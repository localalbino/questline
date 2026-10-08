import { requireVerifiedSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { CreateBoardForm } from "./CreateBoardForm";
import { userCanCreateBoards } from "@/db/boards";

export default async function CreateBoardPage() {
  const session = await requireVerifiedSession();
  if (!(await userCanCreateBoards(session))) {
    redirect("/boards");
  }

  return <CreateBoardForm />;
}
