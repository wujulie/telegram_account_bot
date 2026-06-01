import { NextResponse } from "next/server";
import { handleSupabaseError, supabaseTable } from "../../lib/supabase-rest";
import { getSessionUserId, unauthorized } from "../../lib/session";
import type { Transaction } from "../../lib/types";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  try {
    const query: Record<string, string | number> = {
      select: "*",
      user_id: `eq.${userId}`,
      order: "date.desc,created_at.desc",
    };

    const data = await supabaseTable<Transaction[]>("transactions", { query });
    return NextResponse.json({ data });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();
    const rows = await supabaseTable<Transaction[]>("transactions", {
      method: "POST",
      body: {
        user_id: userId,
        type: body.type,
        amount: Number(body.amount),
        category: body.category,
        description: body.description ?? null,
        date: body.date ?? new Date().toISOString().slice(0, 10),
      },
    });

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error) {
    return handleSupabaseError(error);
  }
}
