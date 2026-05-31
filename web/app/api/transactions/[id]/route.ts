import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized } from "../../../lib/session";
import { handleSupabaseError, supabaseTable } from "../../../lib/supabase-rest";
import type { Transaction } from "../../../lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  try {
    const rows = await supabaseTable<Transaction[]>("transactions", {
      method: "PATCH",
      query: {
        id: `eq.${id}`,
        user_id: `eq.${userId}`,
      },
      body,
    });

    return NextResponse.json({ data: rows[0] ?? null });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;

  try {
    await supabaseTable<Transaction[]>("transactions", {
      method: "DELETE",
      query: {
        id: `eq.${id}`,
        user_id: `eq.${userId}`,
      },
    });

    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    return handleSupabaseError(error);
  }
}
