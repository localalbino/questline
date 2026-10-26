"use server";

import { z } from "zod";
import { CreateBoardFormState, createBoardSchema } from "./schema";
import { requireVerifiedSession } from "@/lib/session";
import { db } from "@/db";
import { boardsTable } from "@/db/schema";
import { BOARDS_PER_USER_LIMIT, isLimitError, userCanCreateBoards } from "@/db/boards";
import { redirect } from "next/navigation";

export async function submitCreateBoardForm(
  prevState: CreateBoardFormState,
  formData: FormData,
): Promise<CreateBoardFormState> {
  const validatedFields = createBoardSchema.safeParse({
    title: formData.get("title"),
  });

  if (!validatedFields.success) {
    return { success: false, errors: z.flattenError(validatedFields.error).fieldErrors };
  }

  const session = await requireVerifiedSession();
  if (!(await userCanCreateBoards(session))) {
    redirect("/boards");
  }

  let boards: { id: number }[];
  try {
    boards = await db
      .insert(boardsTable)
      .values({ title: validatedFields.data.title, ownerId: session.user.id })
      .returning({ id: boardsTable.id });
  } catch (error) {
    // Another request created a board after we counted.
    if (isLimitError(error, BOARDS_PER_USER_LIMIT)) redirect("/boards");
    throw error;
  }

  if (boards.length <= 0) {
    return { success: false };
  }

  redirect(`/boards/${boards[0].id}`);
}
