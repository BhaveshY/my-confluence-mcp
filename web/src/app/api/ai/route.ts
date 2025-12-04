import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { message, apiKey, mode = "parse" } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 400 });
    }

    // Check if this is a document-based request
    const isDocumentRequest = message.includes("[User uploaded a file:");
    
    // Different system prompts based on context
    const systemPrompts: Record<string, string> = {
      parse: `You are a Confluence command parser and document processor. Analyze user messages and return JSON.

IMPORTANT RULES:
1. If user uploaded a document, you MUST extract the content and create a well-formatted Confluence page
2. Determine the intent:
   - "create" - They want to create a new page (including from uploaded documents)
   - "search" - They want to find/search for existing pages  
   - "spaces" - They want to list available spaces
   - "help" - They're asking what you can do
   - "chat" - They're asking a question or having a conversation

Return JSON format:
{
  "type": "create" | "search" | "spaces" | "help" | "chat",
  "title": "page title - create a descriptive title based on the content",
  "content": "HTML content - properly formatted with h2, h3, p, ul, li, table tags",
  "query": "search term if searching",
  "answer": "your response if type is chat"
}

WHEN PROCESSING DOCUMENTS:
- Extract the key information and structure it properly
- Use proper HTML headings (h2 for main sections, h3 for subsections)
- Use lists (ul/li) for bullet points
- Use tables (table/tr/th/td) for tabular data
- Use paragraphs (p) for text blocks
- Add emojis to section headings for visual appeal
- Create a clear, scannable document structure
- The title should reflect the document's purpose

Example for a meeting notes document:
{
  "type": "create",
  "title": "Team Standup - December 4, 2025",
  "content": "<h2>📋 Meeting Overview</h2><p>Weekly team standup meeting...</p><h2>📝 Discussion Points</h2><ul><li>Point 1</li><li>Point 2</li></ul><h2>✅ Action Items</h2><ul><li>[ ] Task 1 - @person</li></ul>"
}

Return ONLY valid JSON, no markdown or explanations.`,

      chat: `You are a helpful Confluence assistant. Answer questions naturally and conversationally.`,
    };

    // Adjust prompt for document processing
    let systemPrompt = systemPrompts[mode] || systemPrompts.parse;
    
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: isDocumentRequest ? 0.3 : 0.2,
        max_tokens: isDocumentRequest ? 4000 : 1500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("DeepSeek API error:", error);
      return NextResponse.json({ error: `AI API error: ${error}` }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    // For chat mode, return the response directly
    if (mode === "chat") {
      return NextResponse.json({ answer: content });
    }

    // For parse mode, extract JSON
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // If no JSON found, treat as a chat response
        return NextResponse.json({
          type: "chat",
          answer: content,
          confidence: 0.9,
        });
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and clean HTML content
      let htmlContent = parsed.content || "";
      if (htmlContent && !htmlContent.includes("<")) {
        // If content isn't HTML, wrap it in paragraph tags
        htmlContent = `<p>${htmlContent.replace(/\n/g, "</p><p>")}</p>`;
      }

      return NextResponse.json({
        type: parsed.type || "create",
        title: parsed.title,
        content: htmlContent,
        query: parsed.query,
        space: parsed.space,
        answer: parsed.answer,
        confidence: 0.95,
      });
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      // If JSON parsing fails, treat as chat
      return NextResponse.json({
        type: "chat",
        answer: content,
        confidence: 0.9,
      });
    }
  } catch (error) {
    console.error("AI proxy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI request failed" },
      { status: 500 }
    );
  }
}
