import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const result = await getCurrentUser();

    if (!result) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: result.user,
      settings: result.settings ? {
        confluence: {
          domain: result.settings.confluence_domain || "",
          email: result.settings.confluence_email || "",
          apiToken: result.settings.confluence_token || "",
        },
        ai: {
          apiKey: result.settings.ai_api_key || "",
          baseUrl: result.settings.ai_base_url || "https://api.deepseek.com",
          model: result.settings.ai_model || "deepseek-chat",
          enabled: Boolean(result.settings.ai_enabled),
        },
      } : null,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json({ user: null }, { status: 401 });
  }
}

