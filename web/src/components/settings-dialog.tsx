"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Loader2, Check, X, Sparkles, LogOut, User, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsDialog() {
  const { user, confluenceSettings, aiSettings, isConfigured, isAIConfigured, saveSettings, logout, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [saveResult, setSaveResult] = useState<"success" | "error" | null>(null);

  // Local form state
  const [localConfluence, setLocalConfluence] = useState({
    domain: "",
    email: "",
    apiToken: "",
  });

  const [localAI, setLocalAI] = useState({
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    enabled: false,
  });

  // Sync local state with context when dialog opens
  useEffect(() => {
    if (open) {
      setLocalConfluence({
        domain: confluenceSettings.domain || "",
        email: confluenceSettings.email || "",
        apiToken: confluenceSettings.apiToken || "",
      });
      setLocalAI({
        apiKey: aiSettings.apiKey || "",
        baseUrl: aiSettings.baseUrl || "https://api.deepseek.com",
        model: aiSettings.model || "deepseek-chat",
        enabled: aiSettings.enabled || false,
      });
      setTestResult(null);
      setSaveResult(null);
    }
  }, [open, confluenceSettings, aiSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveResult(null);
    
    const result = await saveSettings(localConfluence, localAI);
    
    if (result.success) {
      setSaveResult("success");
      // Refresh user data to ensure settings are loaded
      await refreshUser();
      // Keep dialog open briefly to show success
      setTimeout(() => {
        setOpen(false);
      }, 1000);
    } else {
      setSaveResult("error");
    }
    
    setIsSaving(false);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/spaces", {
        headers: {
          "x-confluence-domain": localConfluence.domain,
          "x-confluence-email": localConfluence.email,
          "x-confluence-token": localConfluence.apiToken,
        },
      });

      setTestResult(response.ok ? "success" : "error");
    } catch {
      setTestResult("error");
    }

    setIsTesting(false);
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Settings className="w-5 h-5" />
          {!isConfigured && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-destructive rounded-full" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your Confluence and AI connections. Settings are saved to your account.
          </DialogDescription>
        </DialogHeader>

        {/* Success/Error Banner */}
        {saveResult === "success" && (
          <div className="flex items-center gap-2 p-3 bg-success/10 text-success rounded-lg animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Settings saved successfully!</span>
          </div>
        )}
        {saveResult === "error" && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg animate-in fade-in">
            <X className="w-4 h-4" />
            <span className="text-sm font-medium">Failed to save settings</span>
          </div>
        )}

        {/* User info */}
        {user && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </Button>
          </div>
        )}

        <Tabs defaultValue="confluence" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="confluence" className="gap-2">
              <Settings className="w-4 h-4" />
              Confluence
              {isConfigured && (
                <Check className="w-3 h-3 text-success" />
              )}
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="w-4 h-4" />
              AI
              {isAIConfigured && (
                <Check className="w-3 h-3 text-success" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="confluence" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Confluence Domain</Label>
              <Input
                id="domain"
                placeholder="your-domain.atlassian.net"
                value={localConfluence.domain}
                onChange={(e) =>
                  setLocalConfluence({ ...localConfluence, domain: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={localConfluence.email}
                onChange={(e) =>
                  setLocalConfluence({ ...localConfluence, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="token">API Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Your Atlassian API token"
                value={localConfluence.apiToken}
                onChange={(e) =>
                  setLocalConfluence({ ...localConfluence, apiToken: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Get your token at{" "}
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  id.atlassian.com
                </a>
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting || !localConfluence.domain || !localConfluence.email || !localConfluence.apiToken}
                className="flex-1"
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : testResult === "success" ? (
                  <Check className="w-4 h-4 mr-2 text-success" />
                ) : testResult === "error" ? (
                  <X className="w-4 h-4 mr-2 text-destructive" />
                ) : null}
                Test
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : saveResult === "success" ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : null}
                Save
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Enable AI Features</p>
                <p className="text-xs text-muted-foreground">
                  Use DeepSeek for natural language
                </p>
              </div>
              <button
                onClick={() => setLocalAI({ ...localAI, enabled: !localAI.enabled })}
                className={cn(
                  "relative w-11 h-6 rounded-full transition-colors",
                  localAI.enabled ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                    localAI.enabled && "translate-x-5"
                  )}
                />
              </button>
            </div>

            {localAI.enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">DeepSeek API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk-..."
                    value={localAI.apiKey}
                    onChange={(e) =>
                      setLocalAI({ ...localAI, apiKey: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your key at{" "}
                    <a
                      href="https://platform.deepseek.com/api_keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      platform.deepseek.com
                    </a>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseUrl">API Base URL</Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://api.deepseek.com"
                    value={localAI.baseUrl}
                    onChange={(e) =>
                      setLocalAI({ ...localAI, baseUrl: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    placeholder="deepseek-chat"
                    value={localAI.model}
                    onChange={(e) =>
                      setLocalAI({ ...localAI, model: e.target.value })
                    }
                  />
                </div>
              </>
            )}

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : saveResult === "success" ? (
                <Check className="w-4 h-4 mr-2" />
              ) : null}
              Save
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
