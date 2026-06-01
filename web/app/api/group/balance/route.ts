import { NextResponse } from "next/server";
import { calculateBalances, getActiveGroupId } from "../../../lib/group-data";
import { getSessionUserId, unauthorized } from "../../../lib/session";
import { handleSupabaseError } from "../../../lib/supabase-rest";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  try {
    const groupId = await getActiveGroupId(userId);
    if (!groupId) return NextResponse.json({ data: [] });

    const data = await calculateBalances(groupId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleSupabaseError(error);
  }
}
