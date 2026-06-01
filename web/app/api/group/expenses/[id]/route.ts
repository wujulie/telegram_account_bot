import { NextResponse } from "next/server";
import { getActiveGroupId } from "../../../../lib/group-data";
import { getSessionUserId, unauthorized } from "../../../../lib/session";
import { handleSupabaseError, supabaseTable } from "../../../../lib/supabase-rest";

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;

  try {
    const groupId = await getActiveGroupId(userId);
    if (!groupId) return NextResponse.json({ error: "No active group" }, { status: 404 });

    // Delete splits first (FK constraint)
    await supabaseTable("expense_splits", {
      method: "DELETE",
      query: { expense_id: `eq.${id}` },
      prefer: "return=minimal",
    });

    // Delete expense (verify it belongs to this group)
    await supabaseTable("expenses", {
      method: "DELETE",
      query: { id: `eq.${id}`, group_id: `eq.${groupId}` },
      prefer: "return=minimal",
    });

    return NextResponse.json({ data: null });
  } catch (error) {
    return handleSupabaseError(error);
  }
}
