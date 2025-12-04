"use client";

import { FolderOpen, FileText, Activity, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Space {
  key: string;
  name: string;
  id: string;
  type: string;
  pageCount: number;
  recentActivity: number;
  link: string;
}

interface SpacesGridProps {
  spaces: Space[];
  isLoading?: boolean;
  onSpaceClick?: (space: Space) => void;
}

const spaceGradients = [
  "from-cyan-500/20 to-teal-500/20",
  "from-violet-500/20 to-purple-500/20",
  "from-amber-500/20 to-orange-500/20",
  "from-rose-500/20 to-pink-500/20",
  "from-emerald-500/20 to-green-500/20",
  "from-blue-500/20 to-indigo-500/20",
  "from-fuchsia-500/20 to-purple-500/20",
  "from-lime-500/20 to-emerald-500/20",
];

const spaceAccents = [
  "border-cyan-500/30",
  "border-violet-500/30",
  "border-amber-500/30",
  "border-rose-500/30",
  "border-emerald-500/30",
  "border-blue-500/30",
  "border-fuchsia-500/30",
  "border-lime-500/30",
];

export function SpacesGrid({ spaces, isLoading, onSpaceClick }: SpacesGridProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Spaces</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-card rounded-2xl border border-border/50 p-5 animate-pulse"
            >
              <div className="h-10 w-10 bg-muted rounded-xl mb-3" />
              <div className="h-5 w-24 bg-muted rounded mb-2" />
              <div className="h-4 w-16 bg-muted/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!spaces || spaces.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-8 text-center">
        <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No spaces found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-primary" />
          Spaces
        </h3>
        <span className="text-sm text-muted-foreground">
          {spaces.length} total
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {spaces.map((space, index) => (
          <div
            key={space.key}
            onClick={() => onSpaceClick?.(space)}
            className={cn(
              "relative group rounded-2xl p-5 cursor-pointer",
              "bg-gradient-to-br bg-card",
              "border border-border/50",
              "hover:scale-[1.02] transition-all duration-300",
              "hover:shadow-xl hover:shadow-black/20",
              "overflow-hidden"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Gradient overlay on hover */}
            <div
              className={cn(
                "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                "bg-gradient-to-br",
                spaceGradients[index % spaceGradients.length]
              )}
            />

            <div className="relative z-10">
              {/* Space icon */}
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                  "bg-gradient-to-br from-primary/20 to-accent/20",
                  "border",
                  spaceAccents[index % spaceAccents.length]
                )}
              >
                <span className="text-lg font-bold text-foreground">
                  {space.name.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Space name */}
              <h4 className="font-semibold truncate mb-1">{space.name}</h4>
              <p className="text-xs text-muted-foreground mb-3">
                <code className="px-1.5 py-0.5 bg-muted/50 rounded">{space.key}</code>
              </p>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{space.pageCount}</span>
                </div>
                {space.recentActivity > 0 && (
                  <div className="flex items-center gap-1 text-primary">
                    <Activity className="w-3.5 h-3.5" />
                    <span>{space.recentActivity}</span>
                  </div>
                )}
              </div>

              {/* External link */}
              <a
                href={space.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute top-4 right-4 p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

