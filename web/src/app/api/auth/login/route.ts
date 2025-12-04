import { NextRequest, NextResponse } from "next/server";
import { loginUser, setSessionCookie } from "@/lib/auth";
import { settingsOps } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Login the user
    const result = await loginUser(email, password);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    // Set session cookie
    await setSessionCookie(result.token);

    // Get user settings
    const settings = settingsOps.findByUserId(result.user.id);

    return NextResponse.json({
      user: result.user,
      settings: settings ? {
        confluence: {
          domain: settings.confluence_domain || "",
          email: settings.confluence_email || "",
          apiToken: settings.confluence_token || "",
        },
        ai: {
          apiKey: settings.ai_api_key || "",
          baseUrl: settings.ai_base_url || "https://api.deepseek.com",
          model: settings.ai_model || "deepseek-chat",
          enabled: Boolean(settings.ai_enabled),
        },
      } : null,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}

