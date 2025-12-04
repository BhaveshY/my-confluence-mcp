"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  confluenceSettings: ConfluenceSettings;
  aiSettings: AISettings;
  isConfigured: boolean;
  isAIConfigured: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  saveSettings: (confluence: ConfluenceSettings, ai: AISettings) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const defaultConfluenceSettings: ConfluenceSettings = {
  domain: "",
  email: "",
  apiToken: "",
};

const defaultAISettings: AISettings = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  enabled: false,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confluenceSettings, setConfluenceSettings] = useState<ConfluenceSettings>(defaultConfluenceSettings);
  const [aiSettings, setAISettings] = useState<AISettings>(defaultAISettings);

  const isAuthenticated = !!user;
  const isConfigured = !!(confluenceSettings.domain && confluenceSettings.email && confluenceSettings.apiToken);
  const isAIConfigured = aiSettings.enabled && !!aiSettings.apiKey;

  // Fetch current user on mount
  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();

      if (response.ok && data.user) {
        setUser(data.user);
        if (data.settings) {
          setConfluenceSettings(data.settings.confluence || defaultConfluenceSettings);
          setAISettings(data.settings.ai || defaultAISettings);
        }
      } else {
        setUser(null);
        setConfluenceSettings(defaultConfluenceSettings);
        setAISettings(defaultAISettings);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      setUser(data.user);
      if (data.settings) {
        setConfluenceSettings(data.settings.confluence || defaultConfluenceSettings);
        setAISettings(data.settings.ai || defaultAISettings);
      }

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Network error" };
    }
  };

  const register = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Registration failed" };
      }

      setUser(data.user);
      return { success: true };
    } catch (error) {
      console.error("Registration error:", error);
      return { success: false, error: "Network error" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setConfluenceSettings(defaultConfluenceSettings);
      setAISettings(defaultAISettings);
    }
  };

  const saveSettings = async (
    confluence: ConfluenceSettings,
    ai: AISettings
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/auth/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confluence, ai }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Failed to save settings" };
      }

      if (data.settings) {
        setConfluenceSettings(data.settings.confluence);
        setAISettings(data.settings.ai);
      }

      return { success: true };
    } catch (error) {
      console.error("Save settings error:", error);
      return { success: false, error: "Network error" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        confluenceSettings,
        aiSettings,
        isConfigured,
        isAIConfigured,
        login,
        register,
        logout,
        saveSettings,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

