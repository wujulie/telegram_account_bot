import { cookies } from "next/headers";

export async function getSessionUserId() {
  const cookieStore = await cookies();
  const value = cookieStore.get("session")?.value;
  const userId = Number(value);

  if (!Number.isSafeInteger(userId)) {
    return null;
  }

  return userId;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
