"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface ConfluenceSettings {
  domain: string;
  email: string;
  apiToken: string;
}

interface AISettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

interface Settings {
  confluence: ConfluenceSettings;
  ai: AISettings;
}

interface SettingsContextType {
  settings: ConfluenceSettings;
  aiSettings: AISettings;
  saveSettings: (settings: ConfluenceSettings) => void;
  saveAISettings: (settings: AISettings) => void;
  isConfigured: boolean;
  isAIConfigured: boolean;
}

const defaultAISettings: AISettings = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  enabled: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ConfluenceSettings>({
    domain: "",
    email: "",
    apiToken: "",
  });
  const [aiSettings, setAISettings] = useState<AISettings>(defaultAISettings);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isAIConfigured, setIsAIConfigured] = useState(false);

  useEffect(() => {
    // Load Confluence settings
    const storedSettings = localStorage.getItem("confluence-settings");
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings);
        if (parsed.domain && parsed.email && parsed.apiToken) {
          setSettings(parsed);
          setIsConfigured(true);
        }
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }

    // Load AI settings
    const storedAISettings = localStorage.getItem("ai-settings");
    if (storedAISettings) {
      try {
        const parsed = JSON.parse(storedAISettings);
        setAISettings({ ...defaultAISettings, ...parsed });
        setIsAIConfigured(parsed.enabled && !!parsed.apiKey);
      } catch (e) {
        console.error("Failed to parse AI settings", e);
      }
    }
  }, []);

  const saveSettings = (newSettings: ConfluenceSettings) => {
    setSettings(newSettings);
    localStorage.setItem("confluence-settings", JSON.stringify(newSettings));
    setIsConfigured(!!(newSettings.domain && newSettings.email && newSettings.apiToken));
  };

  const saveAISettings = (newSettings: AISettings) => {
    setAISettings(newSettings);
    localStorage.setItem("ai-settings", JSON.stringify(newSettings));
    setIsAIConfigured(newSettings.enabled && !!newSettings.apiKey);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        aiSettings,
        saveSettings,
        saveAISettings,
        isConfigured,
        isAIConfigured,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
