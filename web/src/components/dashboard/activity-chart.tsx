"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";

interface ActivityChartProps {
  activityTimeline: Array<{ date: string; updates: number }>;
  pagesBySpace: Array<{ name: string; value: number; key: string }>;
  isLoading?: boolean;
}

const COLORS = [
  "oklch(0.70 0.18 180)", // cyan/teal (primary)
  "oklch(0.65 0.20 320)", // pink/magenta (accent)
  "oklch(0.70 0.18 145)", // green
  "oklch(0.65 0.18 45)",  // orange
  "oklch(0.65 0.20 280)", // purple
  "oklch(0.70 0.15 200)", // blue
  "oklch(0.65 0.18 90)",  // yellow
  "oklch(0.60 0.18 350)", // red
];

export function ActivityChart({
  activityTimeline,
  pagesBySpace,
  isLoading,
}: ActivityChartProps) {
  const formattedTimeline = useMemo(() => {
    return activityTimeline.map((item) => ({
      ...item,
      formattedDate: format(parseISO(item.date), "MMM d"),
    }));
  }, [activityTimeline]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl border border-border/50 p-6">
          <div className="h-6 w-32 bg-muted animate-pulse rounded mb-4" />
          <div className="h-64 bg-muted/50 animate-pulse rounded" />
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-6">
          <div className="h-6 w-32 bg-muted animate-pulse rounded mb-4" />
          <div className="h-64 bg-muted/50 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Activity Timeline */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 overflow-hidden">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Activity Timeline
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedTimeline}>
              <defs>
                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.70 0.18 180)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="oklch(0.70 0.18 180)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="formattedDate"
                stroke="oklch(0.65 0.02 260)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="oklch(0.65 0.02 260)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.16 0.02 260)",
                  border: "1px solid oklch(0.28 0.02 260)",
                  borderRadius: "12px",
                  padding: "12px",
                }}
                labelStyle={{ color: "oklch(0.95 0.01 260)" }}
                itemStyle={{ color: "oklch(0.70 0.18 180)" }}
                formatter={(value: number) => [`${value} updates`, "Activity"]}
              />
              <Area
                type="monotone"
                dataKey="updates"
                stroke="oklch(0.70 0.18 180)"
                strokeWidth={2}
                fill="url(#activityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pages by Space */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 overflow-hidden">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          Pages by Space
        </h3>
        <div className="h-64 flex items-center">
          {pagesBySpace.length > 0 ? (
            <div className="flex w-full items-center gap-4">
              <div className="w-1/2">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pagesBySpace}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pagesBySpace.map((entry, index) => (
                        <Cell
                          key={entry.key}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "oklch(0.16 0.02 260)",
                        border: "1px solid oklch(0.28 0.02 260)",
                        borderRadius: "12px",
                        padding: "12px",
                      }}
                      formatter={(value: number, name: string) => [`${value} pages`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-2 max-h-52 overflow-auto">
                {pagesBySpace.map((space, index) => (
                  <div
                    key={space.key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="truncate flex-1">{space.name}</span>
                    <span className="text-muted-foreground">{space.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full text-center text-muted-foreground">
              No page data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

