import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, apiKey: rawApiKey, mode = "parse" } = body;

    console.log("📥 Received request - mode:", mode, "message length:", message?.length);
    console.log("📥 Raw API key type:", typeof rawApiKey, "length:", rawApiKey?.length);

    // Clean the API key - remove whitespace and any invisible characters
    const apiKey = rawApiKey?.toString().trim().replace(/[\u200B-\u200D\uFEFF]/g, '');

    if (!apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 400 });
    }
    
    // Detailed key format debugging
    console.log("🔑 API Key debug:");
    console.log("   - Length:", apiKey.length);
    console.log("   - Starts with:", apiKey.substring(0, 5));
    console.log("   - Ends with:", apiKey.slice(-6));
    console.log("   - Contains spaces:", apiKey.includes(' '));
    console.log("   - Contains newlines:", apiKey.includes('\n'));
    
    // Validate key format (DeepSeek keys typically start with 'sk-')
    if (!apiKey.startsWith('sk-')) {
      console.warn("⚠️ API key doesn't start with 'sk-' - might be invalid format");
    }

    // Check if this is a document-based request (multiple indicators)
    const isDocumentRequest = 
      message.includes("DOCUMENT PROCESSING REQUEST") ||
      message.includes("[User uploaded") ||
      message.includes("Document content:") ||
      message.includes("File content:");
    
    // System prompt specifically for document processing - VERY EXPLICIT
    const documentProcessingPrompt = `You are a document-to-Confluence converter. Convert the uploaded document to a Confluence page.

## CRITICAL RULES - YOU MUST FOLLOW THESE:

1. **INCLUDE EVERYTHING** - Do NOT summarize. Do NOT shorten. Include ALL text from the document.
2. **PRESERVE ALL DETAILS** - Every paragraph, every bullet point, every piece of information must be in the output.
3. **NO SUMMARIZATION** - If the document has 50 items, your output must have 50 items. Not 5. Not 10. ALL 50.
4. **VERBATIM CONTENT** - Copy the actual text content, don't paraphrase or condense it.

## OUTPUT FORMAT - Return ONLY this JSON:

{
  "type": "create",
  "title": "Exact title from document OR descriptive title based on content",
  "content": "FULL HTML content with ALL document text"
}

## HTML FORMATTING:

- <h2>📋 Section Title</h2> for main sections
- <h3>Subsection</h3> for subsections  
- <p>Paragraph text here</p> for paragraphs
- <ul><li>Item 1</li><li>Item 2</li></ul> for bullet lists
- <ol><li>Step 1</li><li>Step 2</li></ol> for numbered lists
- <table><tr><th>Header</th></tr><tr><td>Data</td></tr></table> for tables
- <strong>bold</strong> and <em>italic</em> for emphasis
- <code>code</code> for code/technical terms

## WHAT TO INCLUDE:

- ALL headings and sections from the document
- ALL paragraphs of text
- ALL list items (every single one)
- ALL table data (every row and column)
- ALL names, dates, numbers, and specific details
- ALL action items, tasks, or to-dos

## WHAT NOT TO DO:

- Do NOT say "etc." or "and more" - list everything
- Do NOT summarize sections - include full text
- Do NOT skip "less important" content
- Do NOT use placeholder text like "..." or "[more items]"
- Do NOT truncate lists

## EXAMPLE:

If document says:
"Attendees: John, Mary, Bob, Alice, Tom
Agenda: 1. Review Q3 results 2. Discuss budget 3. Plan Q4"

Your output MUST include:
"<h2>👥 Attendees</h2><ul><li>John</li><li>Mary</li><li>Bob</li><li>Alice</li><li>Tom</li></ul><h2>📋 Agenda</h2><ol><li>Review Q3 results</li><li>Discuss budget</li><li>Plan Q4</li></ol>"

Return ONLY the JSON object. No markdown, no explanations.`;

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
    
    // Build request body
    const requestBody = {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
        temperature: isDocumentRequest ? 0.05 : 0.2,
        max_tokens: isDocumentRequest ? 8192 : 2000,  // DeepSeek max is 8192
    };
    
    // Build headers
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    };
    
    console.log("🤖 Request headers (auth masked):", {
      ...headers,
      "Authorization": `Bearer ${apiKey.substring(0, 5)}...${apiKey.slice(-4)}`,
    });
    console.log("🤖 Request body preview:", JSON.stringify(requestBody).substring(0, 300));
    
    // Use the standard DeepSeek endpoint
    const endpoint = "https://api.deepseek.com/chat/completions";
    console.log("🤖 Calling endpoint:", endpoint);
    
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestBody),
      });
    } catch (fetchError) {
      console.error("🤖 Fetch error:", fetchError);
      return NextResponse.json({ 
        error: `Network error calling DeepSeek: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` 
      }, { status: 500 });
    }
    
    console.log("🤖 Response status:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("🤖 DeepSeek API error response:", errorText);
      
      // Parse error message for better feedback
      let errorMessage = errorText;
      let errorDetails = "";
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
        errorDetails = JSON.stringify(errorJson, null, 2);
      } catch {}
      
      console.error("🤖 Parsed error:", errorMessage);
      console.error("🤖 Full error details:", errorDetails);
      
      // Check for common issues
      if (errorMessage.toLowerCase().includes("invalid") || errorMessage.toLowerCase().includes("authentication")) {
        return NextResponse.json({ 
          error: `DeepSeek rejected the API key. Make sure you're using a valid key from platform.deepseek.com. Response: ${errorMessage}` 
        }, { status: 401 });
      }
      
      return NextResponse.json({ error: `DeepSeek API error: ${errorMessage}` }, { status: response.status });
    }
    
    console.log("🤖 DeepSeek API call successful!");

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
