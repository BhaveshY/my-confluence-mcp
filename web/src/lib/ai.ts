// Intent parsing - combines rule-based and AI approaches

export interface ParsedIntent {
  type: "create" | "search" | "spaces" | "help" | "chat" | "unknown";
  title?: string;
  content?: string;
  query?: string;
  space?: string;
  answer?: string; // For chat responses
  confidence: number;
}

// Rule-based patterns (fallback only)
const PATTERNS = {
  create: [
    /create\s+(?:a\s+)?(?:new\s+)?(?:page\s+)?(?:called\s+|titled\s+|named\s+)?["']?([^"'\n]+?)["']?(?:\s+page)?$/i,
    /create\s+(?:a\s+)?(?:new\s+)?(.+?)\s+(?:page|notes|doc)/i,
    /new\s+page\s+(?:called\s+|titled\s+)?["']?([^"'\n]+?)["']?$/i,
    /make\s+(?:a\s+)?(?:page\s+)?(?:called\s+)?["']?([^"'\n]+?)["']?/i,
  ],
  search: [
    /(?:find|search|look\s+for)\s+(?:pages?\s+)?(?:about\s+|mentioning\s+|with\s+)?["']?([^"'\n]+?)["']?$/i,
    /(?:pages?\s+)?about\s+["']?([^"'\n]+?)["']?$/i,
    /where\s+(?:is|are)\s+(?:the\s+)?["']?([^"'\n]+?)["']?/i,
  ],
  spaces: [
    /(?:list|show|get)\s+(?:all\s+)?spaces/i,
    /(?:what|which)\s+spaces/i,
    /available\s+spaces/i,
  ],
  help: [
    /^help$/i,
    /what\s+can\s+you\s+do/i,
    /how\s+(?:do\s+i|to)\s+use/i,
  ],
};

// Rule-based parsing (fallback when AI is not available)
function parseWithRules(message: string): ParsedIntent {
  const normalized = message.trim();

  // Check help
  for (const pattern of PATTERNS.help) {
    if (pattern.test(normalized)) {
      return { type: "help", confidence: 0.9 };
    }
  }

  // Check spaces
  for (const pattern of PATTERNS.spaces) {
    if (pattern.test(normalized)) {
      return { type: "spaces", confidence: 0.9 };
    }
  }

  // Check create
  for (const pattern of PATTERNS.create) {
    const match = normalized.match(pattern);
    if (match) {
      let title = match[1]?.trim();
      title = title?.replace(/^(a|an|the)\s+/i, "");
      title = title?.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      const content = generateContent(title || "New Page");
      
      return {
        type: "create",
        title: title || `New Page - ${new Date().toLocaleDateString()}`,
        content,
        confidence: 0.8,
      };
    }
  }

  // Check search
  for (const pattern of PATTERNS.search) {
    const match = normalized.match(pattern);
    if (match) {
      return {
        type: "search",
        query: match[1]?.trim(),
        confidence: 0.8,
      };
    }
  }

  // Default: treat as unknown (without AI, we can't answer questions)
  return { 
    type: "unknown", 
    confidence: 0.3,
    answer: "I'm not sure what you mean. Try:\n• \"Create a page called [title]\"\n• \"Find pages about [topic]\"\n• \"List spaces\"\n\nEnable AI in settings for smarter understanding!",
  };
}

// Generate basic content based on title
function generateContent(title: string): string {
  const lower = title.toLowerCase();
  
  if (lower.includes("meeting")) {
    return `<h2>📋 Attendees</h2><ul><li>Add attendees</li></ul><h2>📌 Agenda</h2><ol><li>Topic 1</li></ol><h2>📝 Notes</h2><p>Meeting notes...</p><h2>✅ Action Items</h2><ul><li>[ ] Action 1</li></ul>`;
  }
  
  if (lower.includes("retro")) {
    return `<h2>✅ What Went Well</h2><ul><li>Item 1</li></ul><h2>🔧 What Could Improve</h2><ul><li>Item 1</li></ul><h2>💡 Action Items</h2><ul><li>[ ] Action 1</li></ul>`;
  }
  
  if (lower.includes("status") || lower.includes("weekly")) {
    return `<h2>📊 Highlights</h2><ul><li>Highlight 1</li></ul><h2>🚧 In Progress</h2><ul><li>Task 1</li></ul><h2>🚫 Blockers</h2><ul><li>None</li></ul>`;
  }

  return `<h2>${title}</h2><p>Content goes here...</p>`;
}

// AI-powered parsing via server-side proxy
async function parseWithAI(message: string, apiKey: string): Promise<ParsedIntent> {
  try {
    console.log("🤖 Calling AI for:", message);
    
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        message, 
        apiKey,
        mode: "parse" 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("AI API error:", errorData);
      throw new Error(errorData.error || "AI request failed");
    }

    const data = await response.json();
    console.log("🤖 AI response:", data);
    
    if (data.error) {
      throw new Error(data.error);
    }

    return {
      type: data.type || "unknown",
      title: data.title,
      content: data.content,
      query: data.query,
      space: data.space,
      answer: data.answer,
      confidence: data.confidence || 0.95,
    };
  } catch (error) {
    console.error("AI parsing failed:", error);
    // Fall back to rule-based only if AI completely fails
    return parseWithRules(message);
  }
}

// Main parsing function
export async function parseIntent(message: string, aiApiKey?: string): Promise<ParsedIntent> {
  // Always try AI first if configured
  if (aiApiKey && aiApiKey.trim()) {
    console.log("🤖 AI is configured, using DeepSeek");
    return parseWithAI(message, aiApiKey);
  }
  
  // Fall back to rules only when no AI key
  console.log("📝 No AI key, using rule-based parsing");
  return parseWithRules(message);
}
