import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, updateUserSettings } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { confluence, ai } = body;

    // Update settings in database
    const updatedSettings = await updateUserSettings(currentUser.user.id, {
      confluence_domain: confluence?.domain,
      confluence_email: confluence?.email,
      confluence_token: confluence?.apiToken,
      ai_api_key: ai?.apiKey,
      ai_base_url: ai?.baseUrl,
      ai_model: ai?.model,
      ai_enabled: ai?.enabled,
    });

    return NextResponse.json({
      message: "Settings saved",
      settings: {
        confluence: {
          domain: updatedSettings.confluence_domain || "",
          email: updatedSettings.confluence_email || "",
          apiToken: updatedSettings.confluence_token || "",
        },
        ai: {
          apiKey: updatedSettings.ai_api_key || "",
          baseUrl: updatedSettings.ai_base_url || "https://api.deepseek.com",
          model: updatedSettings.ai_model || "deepseek-chat",
          enabled: Boolean(updatedSettings.ai_enabled),
        },
      },
    });
  } catch (error) {
    console.error("Save settings error:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      settings: currentUser.settings ? {
        confluence: {
          domain: currentUser.settings.confluence_domain || "",
          email: currentUser.settings.confluence_email || "",
          apiToken: currentUser.settings.confluence_token || "",
        },
        ai: {
          apiKey: currentUser.settings.ai_api_key || "",
          baseUrl: currentUser.settings.ai_base_url || "https://api.deepseek.com",
          model: currentUser.settings.ai_model || "deepseek-chat",
          enabled: Boolean(currentUser.settings.ai_enabled),
        },
      } : null,
    });
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 }
    );
  }
}

