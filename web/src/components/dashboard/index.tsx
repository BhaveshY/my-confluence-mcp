"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatsCards } from "./stats-cards";
import { ActivityChart } from "./activity-chart";
import { SpacesGrid } from "./spaces-grid";
import { RecentPages } from "./recent-pages";
import { PageViewer } from "./page-viewer";
import { cn } from "@/lib/utils";

interface DashboardData {
  overview: {
    totalSpaces: number;
    totalPages: number;
    activeThisWeek: number;
    contributors: number;
  };
  spaces: Array<{
    key: string;
    name: string;
    id: string;
    type: string;
    pageCount: number;
    recentActivity: number;
    link: string;
  }>;
  recentPages: Array<{
    id: string;
    title: string;
    space: string;
    spaceName: string;
    version: number;
    lastUpdated: string;
    lastUpdatedBy: string;
    link: string;
  }>;
  activityTimeline: Array<{ date: string; updates: number }>;
  pagesBySpace: Array<{ name: string; value: number; key: string }>;
}

export function Dashboard() {
  const { confluenceSettings, isConfigured } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isPageViewerOpen, setIsPageViewerOpen] = useState(false);

  const apiHeaders = {
    "x-confluence-domain": confluenceSettings.domain,
    "x-confluence-email": confluenceSettings.email,
    "x-confluence-token": confluenceSettings.apiToken,
  };

  const fetchDashboardData = useCallback(async () => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analytics?type=overview", {
        headers: apiHeaders,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch dashboard data");
      }

      const dashboardData = await response.json();
      setData(dashboardData);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigured, confluenceSettings]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handlePageClick = (page: { id: string }) => {
    setSelectedPageId(page.id);
    setIsPageViewerOpen(true);
  };

  const handleSpaceClick = (space: { link: string }) => {
    window.open(space.link, "_blank");
  };

  if (!isConfigured) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Welcome to Your Dashboard</h2>
          <p className="text-muted-foreground mb-6">
            Configure your Confluence credentials in Settings to view your dashboard with spaces, pages, and activity insights.
          </p>
          <div className="p-4 rounded-xl bg-card border border-border/50">
            <p className="text-sm text-muted-foreground">
              Click the <strong>Settings</strong> icon in the top right to get started.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Unable to Load Dashboard</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchDashboardData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              {lastRefresh && (
                <p className="text-sm text-muted-foreground mt-1">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboardData}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Stats Cards */}
          <StatsCards
            stats={data?.overview || { totalSpaces: 0, totalPages: 0, activeThisWeek: 0, contributors: 0 }}
            isLoading={isLoading}
          />

          {/* Charts */}
          <ActivityChart
            activityTimeline={data?.activityTimeline || []}
            pagesBySpace={data?.pagesBySpace || []}
            isLoading={isLoading}
          />

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Spaces Grid */}
            <SpacesGrid
              spaces={data?.spaces || []}
              isLoading={isLoading}
              onSpaceClick={handleSpaceClick}
            />

            {/* Recent Pages */}
            <RecentPages
              pages={data?.recentPages || []}
              isLoading={isLoading}
              onPageClick={handlePageClick}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Page Viewer Modal */}
      <PageViewer
        pageId={selectedPageId}
        isOpen={isPageViewerOpen}
        onClose={() => setIsPageViewerOpen(false)}
        apiHeaders={apiHeaders}
      />
    </>
  );
}
