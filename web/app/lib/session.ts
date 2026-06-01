export async function getSessionUserId() {
  const userId = Number(process.env.SESSION_USER_ID ?? "1921569966");

  if (!Number.isSafeInteger(userId)) {
    return null;
  }

  return userId;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
