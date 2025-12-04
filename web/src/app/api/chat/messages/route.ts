import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { conversationOps, messageOps } from "@/lib/db";

// Add a message to a conversation
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, role, content, attachment, action } = body;

    if (!conversationId || !role || !content) {
      return NextResponse.json(
        { error: "conversationId, role, and content are required" },
        { status: 400 }
      );
    }

    // Verify conversation ownership
    const conversation = await conversationOps.findById(conversationId);

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conversation.user_id !== currentUser.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const message = await messageOps.create(conversationId, {
      role,
      content,
      attachment_filename: attachment?.fileName,
      attachment_preview: attachment?.preview,
      action_type: action?.type,
      action_status: action?.status,
      action_data: action?.data ? JSON.stringify(action.data) : undefined,
    });

    // Auto-update conversation title from first user message
    if (role === "user") {
      const allMessages = await messageOps.findByConversationId(conversationId);
      const userMessages = allMessages.filter(m => m.role === "user");
      if (userMessages.length === 1) {
        // This is the first user message, update title
        const newTitle = content.substring(0, 50) + (content.length > 50 ? "..." : "");
        await conversationOps.updateTitle(conversationId, newTitle);
      }
    }

    return NextResponse.json({
      message: {
        ...message,
        action_data: message.action_data ? JSON.parse(message.action_data) : null,
      },
    });
  } catch (error) {
    console.error("Create message error:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}

// Update a message (mainly for action status updates)
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { messageId, actionStatus, actionData } = body;

    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 });
    }

    // For now, just update action status and data
    if (actionStatus) {
      await messageOps.updateAction(
        messageId, 
        actionStatus, 
        actionData ? JSON.stringify(actionData) : undefined
      );
    }

    return NextResponse.json({ message: "Message updated" });
  } catch (error) {
    console.error("Update message error:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}
