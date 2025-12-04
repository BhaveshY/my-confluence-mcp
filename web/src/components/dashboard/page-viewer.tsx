"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, Clock, User, FileText, Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface PageViewerProps {
  pageId: string | null;
  isOpen: boolean;
  onClose: () => void;
  apiHeaders: Record<string, string>;
}

interface PageContent {
  id: string;
  title: string;
  space: string;
  spaceName: string;
  content: string;
  version: number;
  lastUpdated: string;
  lastUpdatedBy: string;
  link: string;
}

export function PageViewer({ pageId, isOpen, onClose, apiHeaders }: PageViewerProps) {
  const [page, setPage] = useState<PageContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pageId && isOpen) {
      fetchPageContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, isOpen]);

  const fetchPageContent = async () => {
    if (!pageId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics?type=page-content&pageId=${pageId}`, {
        headers: apiHeaders,
      });

      if (!response.ok) {
        throw new Error("Failed to load page content");
      }

      const data = await response.json();
      setPage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load page");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "fixed inset-4 md:inset-8 lg:inset-16 z-50",
          "bg-card border border-border/50 rounded-2xl",
          "shadow-2xl shadow-black/40",
          "flex flex-col overflow-hidden",
          "animate-in zoom-in-95 fade-in duration-300"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              {isLoading ? (
                <div className="h-5 w-48 bg-muted animate-pulse rounded" />
              ) : page ? (
                <>
                  <h2 className="font-semibold truncate">{page.title}</h2>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-1.5 py-0.5 bg-muted/50 rounded">{page.space}</span>
                    <span>•</span>
                    <span>v{page.version}</span>
                  </div>
                </>
              ) : (
                <h2 className="font-semibold">Page Preview</h2>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {page && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchPageContent}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                </Button>
                <a
                  href={page.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">Open in Confluence</span>
                </a>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Meta info */}
        {page && !isLoading && (
          <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 text-sm text-muted-foreground border-b border-border/30">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {page.lastUpdatedBy || "Unknown"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDistanceToNow(new Date(page.lastUpdated), { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 md:p-8">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading page content...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <X className="w-8 h-8 text-destructive" />
                </div>
                <p className="text-destructive font-medium mb-2">{error}</p>
                <Button variant="outline" onClick={fetchPageContent}>
                  Try Again
                </Button>
              </div>
            ) : page ? (
              <article
                className="confluence-content prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: page.content }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a page to preview</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

