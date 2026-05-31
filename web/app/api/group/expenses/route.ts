import { NextResponse } from "next/server";
import { getActiveGroupId, getGroupExpenses, getGroupMembers } from "../../../lib/group-data";
import { getSessionUserId, unauthorized } from "../../../lib/session";
import { handleSupabaseError, SupabaseRestError, supabaseTable } from "../../../lib/supabase-rest";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  try {
    const groupId = await getActiveGroupId(userId);
    if (!groupId) return NextResponse.json({ data: [] });

    const data = await getGroupExpenses(groupId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  try {
    const groupId = await getActiveGroupId(userId);
    if (!groupId) return NextResponse.json({ error: "No active group" }, { status: 404 });

    const body = await request.json();
    const paidByMemberId = String(body.paid_by_member_id ?? "");
    if (!paidByMemberId) {
      return NextResponse.json({ error: "paid_by_member_id required" }, { status: 400 });
    }

    const amount = Number(body.amount);
    const splitType: "equal" | "full" | "none" = body.split_type ?? "equal";

    // Insert expense — expense_date column may not exist in older schemas, fall back to omitting it
    const expenseDate: string | null = body.expense_date || null;
    let rows: Array<{ id: string }>;
    try {
      rows = await supabaseTable<Array<{ id: string }>>("expenses", {
        method: "POST",
        body: {
          group_id: groupId,
          paid_by_member_id: paidByMemberId,
          amount,
          category: body.category || "其他",
          expense_date: expenseDate,
        },
      });
    } catch (err) {
      // Schema cache missing expense_date column → retry without it, store date in description
      const isPgrst204 =
        err instanceof SupabaseRestError &&
        (err.details as { code?: string })?.code === "PGRST204";
      if (!isPgrst204) throw err;
      rows = await supabaseTable<Array<{ id: string }>>("expenses", {
        method: "POST",
        body: {
          group_id: groupId,
          paid_by_member_id: paidByMemberId,
          amount,
          category: body.category || "其他",
          description: expenseDate ?? undefined,
        },
      });
    }

    const expenseId = rows[0]?.id;
    if (!expenseId) throw new Error("Expense insert failed");

    // Build splits
    const members = await getGroupMembers(groupId);

    if (splitType === "equal" && members.length > 0) {
      const share = Math.round((amount / members.length) * 100) / 100;
      await supabaseTable("expense_splits", {
        method: "POST",
        body: members.map((m) => ({
          expense_id: expenseId,
          member_id: m.member_id,
          share_amount: share,
        })),
      });
    } else if (splitType === "full") {
      const nonPayers = members.filter((m) => m.member_id !== paidByMemberId);
      if (nonPayers.length > 0) {
        const share = Math.round((amount / nonPayers.length) * 100) / 100;
        await supabaseTable("expense_splits", {
          method: "POST",
          body: nonPayers.map((m) => ({
            expense_id: expenseId,
            member_id: m.member_id,
            share_amount: share,
          })),
        });
      }
    }
    // splitType === "none" → no splits created

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error) {
    return handleSupabaseError(error);
  }
}
