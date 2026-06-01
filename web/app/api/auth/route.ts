import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const pin = String(formData.get("pin") ?? "");

  const correctPin = process.env.LOGIN_PIN;
  if (!correctPin) {
    return NextResponse.json({ error: "LOGIN_PIN not configured" }, { status: 500 });
  }

  if (pin !== correctPin) {
    return NextResponse.redirect(new URL("/?error=wrong_pin", request.url), 303);
  }

  const userId = process.env.SESSION_USER_ID ?? "1921569966";

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
