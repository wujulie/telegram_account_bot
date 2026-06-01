import { NextResponse } from "next/server";
import { getActiveGroupId, getGroupMembers } from "../../../../lib/group-data";
import { getSessionUserId, unauthorized } from "../../../../lib/session";
import { handleSupabaseError, supabaseTable } from "../../../../lib/supabase-rest";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;

  try {
    const groupId = await getActiveGroupId(userId);
    if (!groupId) return NextResponse.json({ error: "No active group" }, { status: 404 });

    const body = await request.json();
    const category = String(body.category ?? "").trim();
    const amount = Number(body.amount);
    const splitType: "equal" | "full" | "none" | undefined = body.split_type;

    if (!category) return NextResponse.json({ error: "category required" }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
    }

    // Update expense
    const rows = await supabaseTable<Array<{ id: string; paid_by_member_id: string }>>("expenses", {
      method: "PATCH",
      query: { id: `eq.${id}`, group_id: `eq.${groupId}` },
      body: { category, amount },
    });

    if (!rows[0]) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    // Rebuild splits if split_type provided
    if (splitType) {
      // Delete existing splits
      await supabaseTable("expense_splits", {
        method: "DELETE",
        query: { expense_id: `eq.${id}` },
        prefer: "return=minimal",
      });

      const members = await getGroupMembers(groupId);
      const paidByMemberId = rows[0].paid_by_member_id;

      if (splitType === "equal" && members.length > 0) {
        const share = Math.round((amount / members.length) * 100) / 100;
        await supabaseTable("expense_splits", {
          method: "POST",
          body: members.map((m) => ({
            expense_id: id,
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
              expense_id: id,
              member_id: m.member_id,
              share_amount: share,
            })),
          });
        }
      }
      // splitType === "none" → no splits
    } else {
      // No split_type change — just recalculate existing splits with new amount
      const splits = await supabaseTable<Array<{ id: string }>>("expense_splits", {
        query: { select: "id", expense_id: `eq.${id}` },
      });
      if (splits.length > 0) {
        const share = Math.round((amount / splits.length) * 100) / 100;
        await Promise.all(
          splits.map((split) =>
            supabaseTable("expense_splits", {
              method: "PATCH",
              query: { id: `eq.${split.id}` },
              body: { share_amount: share },
              prefer: "return=minimal",
            }),
          ),
        );
      }
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;

  try {
    const groupId = await getActiveGroupId(userId);
    if (!groupId) return NextResponse.json({ error: "No active group" }, { status: 404 });

    await supabaseTable("expense_splits", {
      method: "DELETE",
      query: { expense_id: `eq.${id}` },
      prefer: "return=minimal",
    });

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
