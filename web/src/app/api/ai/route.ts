import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { message, apiKey, mode = "parse" } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 400 });
    }

    // Check if this is a document-based request (multiple indicators)
    const isDocumentRequest = 
      message.includes("DOCUMENT PROCESSING REQUEST") ||
      message.includes("[User uploaded") ||
      message.includes("Document content:") ||
      message.includes("File content:");
    
    // System prompt specifically for document processing
    const documentProcessingPrompt = `You are a Confluence page creator. Your ONLY job is to create a well-formatted page from the provided document.

CRITICAL: The user uploaded a document. You MUST:
1. Read and understand ALL the document content provided
2. Create a proper Confluence page with the full content
3. Use proper HTML formatting

OUTPUT FORMAT - Return ONLY this JSON:
{
  "type": "create",
  "title": "A descriptive title based on document content",
  "content": "<h2>Section</h2><p>Content...</p>..."
}

HTML FORMATTING RULES:
- Use <h2> for main sections (with emojis like 📋 📝 ✅)
- Use <h3> for subsections
- Use <p> for paragraphs
- Use <ul><li>...</li></ul> for bullet lists
- Use <ol><li>...</li></ol> for numbered lists
- Use <table><tr><th>...</th></tr><tr><td>...</td></tr></table> for tables
- Use <strong> for bold, <em> for italic
- Use <code> for code snippets
- Use <blockquote> for quotes

IMPORTANT:
- Extract and include ALL meaningful content from the document
- Organize the content logically with proper sections
- Don't truncate or summarize unless the content is extremely long
- The title should describe what the document is about
- DO NOT include phrases like "for this" or "from the document" - use actual content

Return ONLY valid JSON. No explanations, no markdown blocks.`;

    // System prompt for general commands
    const commandParsingPrompt = `You are a Confluence assistant that parses user commands. Analyze what the user wants and return JSON.

INTENTS:
- "create": User wants to create a new page. Extract title from their message.
- "search": User wants to find pages. Extract the search query.
- "spaces": User wants to list available spaces.
- "help": User is asking what you can do.
- "chat": User is asking a general question.

UNDERSTANDING CONTEXT:
- If user says "create a page called X" → type: create, title: X
- If user says "find pages about Y" → type: search, query: Y
- If user mentions "this", "it", "the document" with no file context → ask for clarification

OUTPUT JSON:
{
  "type": "create" | "search" | "spaces" | "help" | "chat",
  "title": "page title for create",
  "content": "HTML content for create",
  "query": "search terms for search",
  "answer": "response for chat/help"
}

For "create" without document:
- Generate appropriate template content based on the title
- Meeting notes → include Attendees, Agenda, Notes, Action Items sections
- Status update → include Highlights, In Progress, Blockers sections
- Generic → include a basic structure

Return ONLY valid JSON.`;

    // Select the appropriate prompt
    let systemPrompt: string;
    if (isDocumentRequest) {
      systemPrompt = documentProcessingPrompt;
    } else if (mode === "chat") {
      systemPrompt = "You are a helpful Confluence assistant. Answer questions naturally and conversationally.";
    } else {
      systemPrompt = commandParsingPrompt;
    }
    
    console.log("🤖 AI Request - Document mode:", isDocumentRequest);
    console.log("🤖 Message preview:", message.substring(0, 200) + "...");
    
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
        // Lower temperature for more consistent output, more tokens for documents
        temperature: isDocumentRequest ? 0.1 : 0.2,
        max_tokens: isDocumentRequest ? 8000 : 2000,
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
      console.log("🤖 Raw AI response:", content.substring(0, 500));
      
      // Try to find JSON in the response (handle various formats)
      let jsonStr = content;
      
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
      
      // Find the JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("No JSON found in response:", content);
        // If no JSON found, treat as a chat response
        return NextResponse.json({
          type: "chat",
          answer: content,
          confidence: 0.9,
        });
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log("🤖 Parsed result - type:", parsed.type, "title:", parsed.title);
      
      // Validate the title - reject vague/placeholder titles
      let title = parsed.title || "";
      if (title && (
        title.toLowerCase().includes("for this") ||
        title.toLowerCase() === "this" ||
        title.toLowerCase() === "document" ||
        title.toLowerCase() === "untitled" ||
        title.length < 3
      )) {
        // Try to generate a better title from content
        console.log("🤖 Detected vague title, attempting to improve");
        title = "Imported Document - " + new Date().toLocaleDateString();
      }
      
      // Validate and clean HTML content
      let htmlContent = parsed.content || "";
      if (htmlContent && !htmlContent.includes("<")) {
        // If content isn't HTML, wrap it properly
        htmlContent = htmlContent
          .split("\n\n")
          .map((p: string) => `<p>${p.trim()}</p>`)
          .join("");
      }
      
      // Ensure we have actual content for create operations
      if (parsed.type === "create" && !htmlContent) {
        htmlContent = "<p>Page created via Confluence GPT.</p>";
      }

      return NextResponse.json({
        type: parsed.type || "create",
        title: title,
        content: htmlContent,
        query: parsed.query,
        space: parsed.space,
        answer: parsed.answer,
        confidence: 0.95,
      });
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Content:", content);
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
