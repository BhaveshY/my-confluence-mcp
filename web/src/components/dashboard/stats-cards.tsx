"use client";

import { FileText, FolderOpen, Activity, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardsProps {
  stats: {
    totalSpaces: number;
    totalPages: number;
    activeThisWeek: number;
    contributors: number;
  };
  isLoading?: boolean;
}

const statConfig = [
  {
    key: "totalSpaces",
    label: "Spaces",
    icon: FolderOpen,
    gradient: "from-cyan-500 to-teal-500",
    bgGlow: "bg-cyan-500/20",
  },
  {
    key: "totalPages",
    label: "Pages",
    icon: FileText,
    gradient: "from-violet-500 to-purple-500",
    bgGlow: "bg-violet-500/20",
  },
  {
    key: "activeThisWeek",
    label: "Active This Week",
    icon: Activity,
    gradient: "from-amber-500 to-orange-500",
    bgGlow: "bg-amber-500/20",
  },
  {
    key: "contributors",
    label: "Contributors",
    icon: Users,
    gradient: "from-rose-500 to-pink-500",
    bgGlow: "bg-rose-500/20",
  },
];

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statConfig.map((config, index) => {
        const Icon = config.icon;
        const value = stats[config.key as keyof typeof stats] || 0;

        return (
          <div
            key={config.key}
            className={cn(
              "relative group overflow-hidden rounded-2xl p-5",
              "bg-card border border-border/50",
              "hover:border-border transition-all duration-300",
              "hover:shadow-lg hover:shadow-black/20",
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Background glow */}
            <div
              className={cn(
                "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl",
                "opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                config.bgGlow
              )}
            />

            <div className="relative z-10">
              <div
                className={cn(
                  "inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3",
                  "bg-gradient-to-br",
                  config.gradient
                )}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>

              <div className="space-y-1">
                {isLoading ? (
                  <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight">{value}</p>
                )}
                <p className="text-sm text-muted-foreground">{config.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

