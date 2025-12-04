import { NextRequest, NextResponse } from "next/server";
import { logoutUser, clearSessionCookie } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("confluence-gpt-session");

    if (sessionCookie?.value) {
      // Remove session from database
      await logoutUser(sessionCookie.value);
    }

    // Clear session cookie
    await clearSessionCookie();

    return NextResponse.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    // Still clear the cookie even if there's an error
    await clearSessionCookie();
    return NextResponse.json({ message: "Logged out" });
  }
}

