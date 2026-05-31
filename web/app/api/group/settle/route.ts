import { NextResponse } from "next/server";
import { calculateBalances, getActiveGroupId } from "../../../lib/group-data";
import { getSessionUserId, unauthorized } from "../../../lib/session";
import { handleSupabaseError, supabaseTable } from "../../../lib/supabase-rest";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  try {
    const groupId = await getActiveGroupId(userId);
    if (!groupId) return NextResponse.json({ error: "No active group" }, { status: 404 });

    const body = await request.json();
    const balances = await calculateBalances(groupId);
    const target = balances[0];

    const fromMemberId = String(body.from_member_id ?? target?.from_member_id ?? "");
    const toMemberId = String(body.to_member_id ?? target?.to_member_id ?? "");
    const amount = Number(body.amount ?? target?.amount ?? 0);

    if (!fromMemberId || !toMemberId || amount <= 0) {
      return NextResponse.json({ error: "No balance to settle" }, { status: 400 });
    }

    const rows = await supabaseTable("settlements", {
      method: "POST",
      body: {
        group_id: groupId,
        from_member_id: fromMemberId,
        to_member_id: toMemberId,
        amount,
      },
    });

    return NextResponse.json({ data: Array.isArray(rows) ? rows[0] : rows }, { status: 201 });
  } catch (error) {
    return handleSupabaseError(error);
  }
}
