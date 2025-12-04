"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { AuthScreen } from "@/components/auth/auth-screen";
import { SettingsDialog } from "@/components/settings-dialog";
import { Dashboard } from "@/components/dashboard";
import { ChatHistory } from "@/components/chat/chat-history";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Sparkles, ExternalLink, Loader2, Paperclip, X, FileText, LayoutDashboard, MessageSquare } from "lucide-react";
import { getApiClient } from "@/lib/confluence-client";
import { parseIntent } from "@/lib/ai";
import { cn } from "@/lib/utils";

// Types
interface Message {
  id: string;
  dbId?: number;
  role: "user" | "assistant";
  content: string;
  attachment?: {
    fileName: string;
    preview: string;
  };
  action?: {
    type: "create" | "search" | "spaces";
    data?: any;
    status?: "pending" | "executing" | "done" | "error";
  };
}

interface UploadedFile {
  fileName: string;
  content: string;
  preview: string;
}

// Quick suggestions
const SUGGESTIONS = [
  "Create meeting notes for today",
  "Find pages about API",
  "List all spaces",
];

export default function HomePage() {
  const { user, isLoading: authLoading, isAuthenticated, confluenceSettings, aiSettings, isConfigured, isAIConfigured } = useAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "chat">("dashboard");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiClient = isConfigured ? getApiClient(confluenceSettings) : null;

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Welcome message for new chat
  const showWelcomeMessage = useCallback(() => {
    if (!isAuthenticated) return;
    
    const welcome = isConfigured
      ? `Hey ${user?.name || "there"}! 👋 I'm your Confluence assistant. Tell me what you need:\n\n• "Create a page called Project Roadmap"\n• "Find pages about authentication"\n• Upload a document and say "Create a page from this"\n\nWhat would you like to do?`
      : `Welcome ${user?.name || ""}! 👋\n\nFirst, let's connect to your Confluence. Click the **Settings** icon in the top right to add your credentials.`;
    
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: welcome,
    }]);
  }, [isConfigured, user?.name, isAuthenticated]);

  // Show welcome message when chat tab is opened with no conversation
  useEffect(() => {
    if (messages.length === 0 && activeTab === "chat" && isAuthenticated && !currentConversationId) {
      showWelcomeMessage();
    }
  }, [activeTab, isAuthenticated, currentConversationId, messages.length, showWelcomeMessage]);

  // Create new conversation
  const createConversation = useCallback(async (title: string): Promise<number | null> => {
    try {
      const response = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.conversation.id;
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
    return null;
  }, []);

  // Save message to database
  const saveMessage = useCallback(async (
    conversationId: number,
    message: Message
  ): Promise<number | null> => {
    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          role: message.role,
          content: message.content,
          attachment: message.attachment,
          action: message.action ? {
            type: message.action.type,
            status: message.action.status,
            data: message.action.data,
          } : undefined,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.message.id;
      }
    } catch (error) {
      console.error("Failed to save message:", error);
    }
    return null;
  }, []);

  // Load conversation
  const loadConversation = useCallback(async (conversationId: number) => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          id: `db-${msg.id}`,
          dbId: msg.id,
          role: msg.role,
          content: msg.content,
          attachment: msg.attachment_filename ? {
            fileName: msg.attachment_filename,
            preview: msg.attachment_preview || "",
          } : undefined,
          action: msg.action_type ? {
            type: msg.action_type,
            status: msg.action_status,
            data: msg.action_data,
          } : undefined,
        }));
        setMessages(loadedMessages);
        setCurrentConversationId(conversationId);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  }, []);

  // Handle selecting a conversation
  const handleSelectConversation = useCallback((id: number) => {
    loadConversation(id);
  }, [loadConversation]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
    showWelcomeMessage();
  }, [showWelcomeMessage]);

  // Handle delete conversation
  const handleDeleteConversation = useCallback((id: number) => {
    if (currentConversationId === id) {
      handleNewConversation();
    }
  }, [currentConversationId, handleNewConversation]);

  // Add message helper
  const addMessage = useCallback((role: "user" | "assistant", content: string, extra?: Partial<Message>) => {
    const msg: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      ...extra,
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  // Update last message
  const updateLastMessage = useCallback((updates: Partial<Message>) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      const last = newMessages[newMessages.length - 1];
      if (last) {
        newMessages[newMessages.length - 1] = { ...last, ...updates };
      }
      return newMessages;
    });
  }, []);

  // Process file (shared by upload and drag-drop)
  const processFile = useCallback(async (file: File) => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      // Create preview (first 200 chars)
      const preview = data.content.substring(0, 200) + (data.content.length > 200 ? "..." : "");

      setUploadedFile({
        fileName: data.fileName,
        content: data.content,
        preview,
      });

      // Focus the input
      inputRef.current?.focus();
    } catch (error) {
      console.error("Upload error:", error);
      addMessage("assistant", `❌ Failed to upload: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    setIsUploading(false);
  }, [addMessage]);

  // Handle file input change
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [processFile]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  }, [processFile]);

  // Handle send
  const handleSend = useCallback(async () => {
    if ((!input.trim() && !uploadedFile) || isLoading) return;
    if (!isConfigured) {
      addMessage("user", input.trim());
      addMessage("assistant", "Please configure your Confluence settings first. Click the ⚙️ icon in the top right.");
      setInput("");
      return;
    }

    const userMessage = input.trim();
    const currentFile = uploadedFile;
    
    setInput("");
    setUploadedFile(null);

    // Create conversation if needed
    let convId = currentConversationId;
    if (!convId) {
      const title = userMessage.substring(0, 50) || "New Chat";
      convId = await createConversation(title);
      if (convId) {
        setCurrentConversationId(convId);
      }
    }

    // Show user message with attachment info
    const userMsg = addMessage("user", userMessage || "Process this document", currentFile ? {
      attachment: {
        fileName: currentFile.fileName,
        preview: currentFile.preview,
      },
    } : undefined);

    // Save user message to database
    if (convId) {
      saveMessage(convId, userMsg);
    }

    setIsLoading(true);

    try {
      // Build the context for AI with better intent understanding
      let contextMessage = userMessage;
      
      if (currentFile) {
        // Resolve pronouns and vague references to the actual file
        let resolvedRequest = userMessage || "Create a Confluence page from this document";
        
        // Replace common vague references with explicit file reference
        const vaguePatterns = [
          /\b(this|it|that|the file|the document|the pdf|the content)\b/gi,
        ];
        
        // If user message contains vague references, make them explicit
        const hasVagueReference = vaguePatterns.some(p => p.test(resolvedRequest));
        
        if (hasVagueReference || !userMessage) {
          // Explicitly tell AI what to do with the document - PRESERVE ALL CONTENT
          const fileBaseName = currentFile.fileName.replace(/\.[^/.]+$/, "");
          contextMessage = `DOCUMENT PROCESSING REQUEST

IMPORTANT: Convert this ENTIRE document to a Confluence page. Include ALL content - do not summarize or skip anything.

=== DOCUMENT TO CONVERT ===
File: ${currentFile.fileName}
Default title if none found: ${fileBaseName}

--- FULL DOCUMENT CONTENT START ---
${currentFile.content}
--- FULL DOCUMENT CONTENT END ---

=== INSTRUCTIONS ===
1. Create a Confluence page containing ALL the text from this document
2. Include EVERY paragraph, EVERY list item, EVERY detail - nothing should be left out
3. Format with HTML tags (h2, h3, p, ul, ol, li, table, etc.)
4. Use a title from the document, or "${fileBaseName}" if no title is found
5. DO NOT summarize - include the complete content

Return JSON: {"type": "create", "title": "...", "content": "<full HTML content>"}`;
        } else {
          // User gave a specific instruction (like search), preserve it
          contextMessage = `[User uploaded file: ${currentFile.fileName}]\n\nFile content:\n${currentFile.content}\n\n---\nUser request: ${resolvedRequest}`;
        }
      }

      // Parse intent (AI or rule-based)
      const intent = await parseIntent(contextMessage, isAIConfigured ? aiSettings.apiKey : undefined);

      switch (intent.type) {
        case "create": {
          const title = intent.title || (currentFile ? currentFile.fileName.replace(/\.[^/.]+$/, "") : `New Page - ${new Date().toLocaleDateString()}`);
          const content = intent.content || "<p>Page created via Confluence GPT.</p>";
          
          const assistantMsg = addMessage("assistant", `Creating page: **${title}**...`, {
            action: {
              type: "create",
              status: "executing",
            },
          });

          const spaces = await apiClient!.getSpaces();
          const spaceKey = intent.space || spaces[0]?.key;
          
          if (!spaceKey) {
            updateLastMessage({
              content: "❌ No spaces found. Please create a space in Confluence first.",
              action: { type: "create", status: "error" },
            });
            // Save to DB
            if (convId) {
              saveMessage(convId, {
                ...assistantMsg,
                content: "❌ No spaces found. Please create a space in Confluence first.",
                action: { type: "create", status: "error" },
              });
            }
            break;
          }

          const result = await apiClient!.createPage({ title, spaceKey, content });
          const finalContent = `✅ Created: **${result.title}**`;
          const finalAction = {
            type: "create" as const,
            status: "done" as const,
            data: { link: result.link, title: result.title },
          };
          updateLastMessage({
            content: finalContent,
            action: finalAction,
          });
          // Save to DB
          if (convId) {
            saveMessage(convId, {
              ...assistantMsg,
              content: finalContent,
              action: finalAction,
            });
          }
          break;
        }

        case "search": {
          const assistantMsg = addMessage("assistant", `Searching for "${intent.query}"...`, {
            action: {
              type: "search",
              status: "executing",
            },
          });

          const results = await apiClient!.searchPages(intent.query);
          
          let finalContent: string;
          let finalAction: Message["action"];
          
          if (results.length === 0) {
            finalContent = `No pages found matching "${intent.query}".`;
            finalAction = { type: "search", status: "done", data: [] };
          } else {
            finalContent = `Found ${results.length} page(s):`;
            finalAction = {
              type: "search",
              status: "done",
              data: results.slice(0, 10),
            };
          }
          updateLastMessage({ content: finalContent, action: finalAction });
          // Save to DB
          if (convId) {
            saveMessage(convId, {
              ...assistantMsg,
              content: finalContent,
              action: finalAction,
            });
          }
          break;
        }

        case "spaces": {
          const assistantMsg = addMessage("assistant", "Fetching spaces...", {
            action: {
              type: "spaces",
              status: "executing",
            },
          });

          const spaces = await apiClient!.getSpaces();
          const spaceList = spaces.map((s: any) => `• **${s.name}** (\`${s.key}\`)`).join("\n");
          const finalContent = `📚 **Available Spaces (${spaces.length})**\n\n${spaceList}`;
          const finalAction = { type: "spaces" as const, status: "done" as const };
          
          updateLastMessage({
            content: finalContent,
            action: finalAction,
          });
          // Save to DB
          if (convId) {
            saveMessage(convId, {
              ...assistantMsg,
              content: finalContent,
              action: finalAction,
            });
          }
          break;
        }

        case "help": {
          const helpContent = `## What I can do:\n\n**Create Pages**\n• "Create a meeting notes page"\n• Upload a doc and say "Create a page from this"\n\n**Search Pages**\n• "Find pages about authentication"\n\n**Upload Documents**\n• Click 📎 to upload PDF, TXT, MD, or other text files\n• Then tell me what to do with it!\n\nJust describe what you need! 🚀`;
          addMessage("assistant", helpContent);
          // Save to DB
          if (convId) {
            saveMessage(convId, {
              id: "help",
              role: "assistant",
              content: helpContent,
            });
          }
          break;
        }

        case "chat": {
          const answer = intent.answer || "I'm not sure how to help with that. Try asking about Confluence or give me a command!";
          addMessage("assistant", answer);
          // Save to DB
          if (convId) {
            saveMessage(convId, {
              id: "chat",
              role: "assistant",
              content: answer,
            });
          }
          break;
        }

        default: {
          const fallbackAnswer = intent.answer || `I'm not sure what you mean. Try:\n• "Create a page called [title]"\n• "Find pages about [topic]"\n• Upload a document and say "Create a page from this"`;
          addMessage("assistant", fallbackAnswer);
          // Save to DB
          if (convId) {
            saveMessage(convId, {
              id: "default",
              role: "assistant",
              content: fallbackAnswer,
            });
          }
        }
      }
    } catch (error) {
      const errorContent = `❌ Error: ${error instanceof Error ? error.message : "Something went wrong"}`;
      addMessage("assistant", errorContent);
      // Save to DB
      if (convId) {
        saveMessage(convId, {
          id: "error",
          role: "assistant",
          content: errorContent,
        });
      }
    }

    setIsLoading(false);
  }, [input, uploadedFile, isLoading, isConfigured, isAIConfigured, aiSettings.apiKey, apiClient, addMessage, updateLastMessage, currentConversationId, createConversation, saveMessage]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Clear uploaded file
  const clearUploadedFile = useCallback(() => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if not logged in
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-sm font-bold text-primary-foreground">C</span>
              </div>
              <span className="font-semibold tracking-tight">Confluence GPT</span>
              {isAIConfigured && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Sparkles className="w-3 h-3" /> AI
                </span>
              )}
            </div>
          </div>

          {/* Centered Tabs */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "dashboard" | "chat")}>
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="dashboard" className="gap-2 px-4 data-[state=active]:bg-card">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-2 px-4 data-[state=active]:bg-card">
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Chat</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <SettingsDialog />
        </div>
      </header>

      {/* Content */}
      {activeTab === "dashboard" ? (
        <Dashboard />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Chat History Sidebar */}
          <ChatHistory
            currentConversationId={currentConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapsed={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="max-w-3xl mx-auto py-6 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "animate-message-in",
                      msg.role === "user" && "flex justify-end"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card"
                      )}
                    >
                      {/* Attachment preview */}
                      {msg.attachment && (
                        <div className="mb-2 p-2 rounded-lg bg-black/20 text-xs">
                          <div className="flex items-center gap-2 font-medium mb-1">
                            <FileText className="w-3 h-3" />
                            {msg.attachment.fileName}
                          </div>
                          <div className="text-primary-foreground/70 line-clamp-2">
                            {msg.attachment.preview}
                          </div>
                        </div>
                      )}

                      {/* Message content with markdown-like formatting */}
                      <div className="text-sm whitespace-pre-wrap">
                        {msg.content.split(/(\*\*.*?\*\*|\`.*?\`)/g).map((part, i) => {
                          if (part.startsWith("**") && part.endsWith("**")) {
                            return <strong key={i}>{part.slice(2, -2)}</strong>;
                          }
                          if (part.startsWith("`") && part.endsWith("`")) {
                            return <code key={i} className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{part.slice(1, -1)}</code>;
                          }
                          return part;
                        })}
                      </div>

                      {/* Action results */}
                      {msg.action?.status === "executing" && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Working...
                        </div>
                      )}

                      {/* Created page link */}
                      {msg.action?.type === "create" && msg.action.status === "done" && msg.action.data?.link && (
                        <a
                          href={msg.action.data.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open in Confluence
                        </a>
                      )}

                      {/* Search results */}
                      {msg.action?.type === "search" && msg.action.status === "done" && msg.action.data?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.action.data.map((page: any) => (
                            <a
                              key={page.id}
                              href={page.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                            >
                              <span className="text-sm truncate">{page.title}</span>
                              <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex gap-1.5 px-4 py-3 bg-card rounded-2xl w-fit animate-message-in">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground typing-dot" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground typing-dot" />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground typing-dot" />
                  </div>
                )}

                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div 
              className="sticky bottom-0 p-4 bg-gradient-to-t from-background via-background to-transparent"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="max-w-3xl mx-auto space-y-3 relative">
                {/* Suggestions */}
                {messages.length <= 1 && isConfigured && !uploadedFile && (
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="px-3 py-1.5 text-sm rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {/* Uploaded file preview */}
                {uploadedFile && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border">
                    <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{uploadedFile.fileName}</div>
                      <div className="text-xs text-muted-foreground truncate">{uploadedFile.preview}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 h-8 w-8"
                      onClick={clearUploadedFile}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Input area with drag-drop support */}
                <div 
                  className={cn(
                    "flex gap-2 p-2 rounded-2xl bg-card border border-border focus-within:ring-2 focus-within:ring-ring transition-colors",
                    isDragging && "border-primary bg-primary/5"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {/* File upload - positioned off-screen but functional */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.csv,.json,.doc,.docx"
                    onChange={handleFileUpload}
                    style={{
                      position: 'absolute',
                      width: '1px',
                      height: '1px',
                      padding: 0,
                      margin: '-1px',
                      overflow: 'hidden',
                      clip: 'rect(0, 0, 0, 0)',
                      whiteSpace: 'nowrap',
                      border: 0,
                    }}
                  />
                  {/* Upload button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''; // Reset to allow same file
                        fileInputRef.current.click();
                      }
                    }}
                    disabled={isUploading}
                    className={cn(
                      "inline-flex items-center justify-center size-9 rounded-xl transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                    )}
                    title="Upload a file (PDF, TXT, MD, etc.)"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Paperclip className="w-4 h-4" />
                    )}
                  </button>

                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      uploadedFile 
                        ? "What should I do with this file?" 
                        : isConfigured 
                          ? "What would you like to do?" 
                          : "Configure settings to get started..."
                    }
                    disabled={!isConfigured || isLoading}
                    rows={1}
                    className="flex-1 px-2 py-1.5 bg-transparent resize-none focus:outline-none text-sm placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={(!input.trim() && !uploadedFile) || !isConfigured || isLoading}
                    size="icon"
                    className="rounded-xl flex-shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* Supported formats hint */}
                {!uploadedFile && (
                  <p className="text-xs text-center text-muted-foreground">
                    📎 Drag & drop or click 📎 to upload (PDF, TXT, MD, JSON, CSV)
                  </p>
                )}
                
                {/* Drag overlay indicator */}
                {isDragging && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10 backdrop-blur-sm rounded-2xl border-2 border-dashed border-primary z-10">
                    <p className="text-primary font-medium">Drop file here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
