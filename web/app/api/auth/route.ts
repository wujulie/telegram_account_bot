import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function verifyTelegram(payload: Record<string, string>, botToken: string) {
  const hash = payload.hash;
  if (!hash) return false;

  const checkString = Object.entries(payload)
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHash("sha256").update(botToken).digest();
  const digest = createHmac("sha256", secret).update(checkString).digest("hex");
  const digestBuffer = Buffer.from(digest, "hex");
  const hashBuffer = Buffer.from(hash, "hex");

  if (digestBuffer.length !== hashBuffer.length) return false;
  return timingSafeEqual(digestBuffer, hashBuffer);
}

async function createSession(request: NextRequest, payload: Record<string, string>) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const shouldVerify = process.env.NODE_ENV === "production" || Boolean(payload.hash);

  if (shouldVerify && !botToken) {
    return NextResponse.json({ error: "Missing TELEGRAM_BOT_TOKEN" }, { status: 500 });
  }

  if (shouldVerify && botToken && !verifyTelegram(payload, botToken)) {
    return NextResponse.json({ error: "Invalid Telegram signature" }, { status: 401 });
  }

  const userId = payload.id ?? process.env.DEV_USER_ID ?? "1921569966";

  const cookieStore = await cookies();
  cookieStore.set("session", userId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.redirect(new URL("/group", request.url), 303);
}

export async function GET(request: NextRequest) {
  const payload = Object.fromEntries(request.nextUrl.searchParams) as Record<string, string>;
  return createSession(request, payload);
}

export async function POST(request: NextRequest) {
  const payload = Object.fromEntries(await request.formData()) as Record<string, string>;
  return createSession(request, payload);
}
