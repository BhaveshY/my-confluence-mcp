import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { conversationOps, messageOps } from "@/lib/db";

// Get all conversations for the current user
export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversations = conversationOps.findByUserId(currentUser.user.id);

    // Add last message preview to each conversation
    const conversationsWithPreview = conversations.map((conv) => {
      const lastMessage = messageOps.getLastMessage(conv.id);
      return {
        ...conv,
        lastMessage: lastMessage ? {
          content: lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? "..." : ""),
          role: lastMessage.role,
          created_at: lastMessage.created_at,
        } : null,
      };
    });

    return NextResponse.json({ conversations: conversationsWithPreview });
  } catch (error) {
    console.error("Get conversations error:", error);
    return NextResponse.json(
      { error: "Failed to get conversations" },
      { status: 500 }
    );
  }
}

// Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title } = body;

    const conversation = conversationOps.create(
      currentUser.user.id,
      title || `Chat ${new Date().toLocaleDateString()}`
    );

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("Create conversation error:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}

// Delete all conversations for the current user
export async function DELETE() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    conversationOps.deleteByUserId(currentUser.user.id);

    return NextResponse.json({ message: "All conversations deleted" });
  } catch (error) {
    console.error("Delete conversations error:", error);
    return NextResponse.json(
      { error: "Failed to delete conversations" },
      { status: 500 }
    );
  }
}

