"use client";

import { useState } from "react";
import { FileText, ExternalLink, Eye, Clock, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Page {
  id: string;
  title: string;
  space: string;
  spaceName: string;
  version: number;
  lastUpdated: string;
  lastUpdatedBy: string;
  link: string;
}

interface RecentPagesProps {
  pages: Page[];
  isLoading?: boolean;
  onPageClick?: (page: Page) => void;
}

export function RecentPages({ pages, isLoading, onPageClick }: RecentPagesProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Recent Pages</h3>
        <div className="bg-card rounded-2xl border border-border/50 divide-y divide-border/50">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-muted rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-48 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted/50 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-8 text-center">
        <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No recent pages found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-accent" />
          Recent Activity
        </h3>
        <span className="text-sm text-muted-foreground">
          {pages.length} pages
        </span>
      </div>
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="divide-y divide-border/30">
          {pages.map((page, index) => (
            <div
              key={page.id}
              className={cn(
                "group relative p-4 transition-all duration-200 cursor-pointer",
                "hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent",
                hoveredId === page.id && "bg-primary/5"
              )}
              onMouseEnter={() => setHoveredId(page.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onPageClick?.(page)}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="flex items-start gap-4">
                {/* Page icon */}
                <div className="relative flex-shrink-0">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      "bg-gradient-to-br from-accent/20 to-primary/20",
                      "border border-accent/30"
                    )}
                  >
                    <FileText className="w-5 h-5 text-accent" />
                  </div>
                  {/* Version badge */}
                  <span className="absolute -bottom-1 -right-1 text-[10px] font-medium px-1.5 py-0.5 bg-muted rounded-full">
                    v{page.version}
                  </span>
                </div>

                {/* Page info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate group-hover:text-primary transition-colors">
                    {page.title}
                  </h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="px-1.5 py-0.5 bg-muted/50 rounded">
                      {page.space}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {page.lastUpdatedBy || "Unknown"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(page.lastUpdated), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPageClick?.(page);
                    }}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href={page.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    title="Open in Confluence"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Animated underline */}
              <div
                className={cn(
                  "absolute bottom-0 left-4 right-4 h-0.5 rounded-full",
                  "bg-gradient-to-r from-primary to-accent",
                  "transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"
                )}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

