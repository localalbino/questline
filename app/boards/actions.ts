"use server";

import { z } from "zod";
import { deleteOwnedBoard } from "@/db/boards";
import { requireVerifiedSession } from "@/lib/session";
import { idSchema, type ActionResult } from "./[id]/schema";

const deleteBoardSchema = z.object({ boardId: idSchema });

export async function deleteBoardAction(input: z.input<typeof deleteBoardSchema>): Promise<ActionResult> {
  const parsed = deleteBoardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const session = await requireVerifiedSession();
  if (!(await deleteOwnedBoard(session, parsed.data.boardId))) return { success: false, error: "Not found" };
  return { success: true, data: undefined };
}
