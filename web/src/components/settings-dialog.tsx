"use client";

import { useState } from "react";
import { useSettings } from "@/contexts/settings-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, CheckCircle2, AlertCircle, Loader2, ExternalLink, Sparkles } from "lucide-react";
import { getApiClient } from "@/lib/confluence-client";
import { cn } from "@/lib/utils";

export function SettingsDialog() {
  const { settings, aiSettings, saveSettings, saveAISettings, isConfigured, isAIConfigured } = useSettings();
  const [open, setOpen] = useState(false);
  
  // Confluence form state
  const [domain, setDomain] = useState(settings.domain);
  const [email, setEmail] = useState(settings.email);
  const [apiToken, setApiToken] = useState(settings.apiToken);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  // AI form state
  const [aiApiKey, setAiApiKey] = useState(aiSettings.apiKey);
  const [aiTestStatus, setAiTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  // Sync state when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setDomain(settings.domain);
      setEmail(settings.email);
      setApiToken(settings.apiToken);
      setAiApiKey(aiSettings.apiKey);
      setTestStatus("idle");
      setAiTestStatus("idle");
    }
    setOpen(newOpen);
  };

  const testConnection = async () => {
    setTestStatus("testing");
    try {
      const client = getApiClient({
        domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
        email,
        apiToken,
      });
      const spaces = await client.getSpaces();
      setTestStatus("success");
      setTestMessage(`Connected! Found ${spaces.length} space(s).`);
    } catch (error) {
      setTestStatus("error");
      setTestMessage(error instanceof Error ? error.message : "Connection failed");
    }
  };

  const saveConfluence = () => {
    saveSettings({
      domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      email,
      apiToken,
    });
    setTestStatus("success");
    setTestMessage("Settings saved!");
    setTimeout(() => setTestStatus("idle"), 2000);
  };

  const [aiTestMessage, setAiTestMessage] = useState("");
  
  const testAI = async () => {
    setAiTestStatus("testing");
    setAiTestMessage("Testing connection...");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Say hello in one word",
          apiKey: aiApiKey.trim(),
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Invalid API key");
      }
      
      setAiTestStatus("success");
      setAiTestMessage("Connected successfully!");
    } catch (err) {
      setAiTestStatus("error");
      setAiTestMessage(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const saveAI = () => {
    // Trim the API key to remove any whitespace
    const cleanedKey = aiApiKey.trim();
    saveAISettings({
      ...aiSettings,
      apiKey: cleanedKey,
      enabled: !!cleanedKey,
    });
    setAiApiKey(cleanedKey);
    setAiTestStatus("success");
    setTimeout(() => setAiTestStatus("idle"), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Settings className="h-5 w-5" />
          {!isConfigured && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-destructive rounded-full" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] glass">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your Confluence and AI connections.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="confluence" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="confluence" className="gap-2">
              <Settings className="h-4 w-4" />
              Confluence
              {isConfigured && <CheckCircle2 className="h-3 w-3 text-success" />}
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI
              {isAIConfigured && <CheckCircle2 className="h-3 w-3 text-success" />}
            </TabsTrigger>
          </TabsList>

          {/* Confluence Tab */}
          <TabsContent value="confluence" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Confluence Domain</Label>
              <Input
                id="domain"
                placeholder="your-company.atlassian.net"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiToken">API Token</Label>
              <Input
                id="apiToken"
                type="password"
                placeholder="Your Atlassian API token"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your token at{" "}
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  id.atlassian.com <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            {/* Status */}
            {testStatus !== "idle" && (
              <div
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg text-sm",
                  testStatus === "success" && "bg-success/10 text-success",
                  testStatus === "error" && "bg-destructive/10 text-destructive",
                  testStatus === "testing" && "bg-muted text-muted-foreground"
                )}
              >
                {testStatus === "testing" && <Loader2 className="h-4 w-4 animate-spin" />}
                {testStatus === "success" && <CheckCircle2 className="h-4 w-4" />}
                {testStatus === "error" && <AlertCircle className="h-4 w-4" />}
                {testMessage}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={testStatus === "testing" || !domain || !email || !apiToken}
                className="flex-1"
              >
                {testStatus === "testing" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Test
              </Button>
              <Button onClick={saveConfluence} disabled={!domain || !email || !apiToken} className="flex-1">
                Save
              </Button>
            </div>
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-4 mt-4">
            <div className="p-3 rounded-lg bg-secondary/50 text-sm">
              <p className="font-medium mb-1">DeepSeek AI</p>
              <p className="text-muted-foreground text-xs">
                Enable AI for smarter command understanding and content generation.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aiApiKey">DeepSeek API Key</Label>
              <Input
                id="aiApiKey"
                type="password"
                placeholder="sk-..."
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your key at{" "}
                <a
                  href="https://platform.deepseek.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  platform.deepseek.com <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            {/* Status */}
            {aiTestStatus !== "idle" && (
              <div
                className={cn(
                  "flex items-start gap-2 p-3 rounded-lg text-sm",
                  aiTestStatus === "success" && "bg-success/10 text-success",
                  aiTestStatus === "error" && "bg-destructive/10 text-destructive",
                  aiTestStatus === "testing" && "bg-muted text-muted-foreground"
                )}
              >
                {aiTestStatus === "testing" && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 mt-0.5" />}
                {aiTestStatus === "success" && <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                {aiTestStatus === "error" && <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                <span className="break-words">{aiTestMessage}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={testAI}
                disabled={aiTestStatus === "testing" || !aiApiKey}
                className="flex-1"
              >
                {aiTestStatus === "testing" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Test
              </Button>
              <Button onClick={saveAI} className="flex-1">
                {aiApiKey ? "Save" : "Skip (use basic mode)"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

