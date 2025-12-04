import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";

const getAuthHeaders = (req: NextRequest) => {
  const domain = req.headers.get("x-confluence-domain");
  const email = req.headers.get("x-confluence-email");
  const token = req.headers.get("x-confluence-token");

  if (!domain || !email || !token) {
    throw new Error("Missing Confluence credentials");
  }

  return {
    domain,
    authHeader: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
  };
};

export async function GET(request: NextRequest) {
  try {
    const { domain, authHeader } = getAuthHeaders(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "overview";

    const headers = {
      Authorization: authHeader,
      "Content-Type": "application/json",
    };

    switch (type) {
      case "overview": {
        // Fetch spaces with their homepage to get more info
        const spacesRes = await fetch(
          `https://${domain}/wiki/rest/api/space?limit=100&expand=description.plain,homepage`,
          { headers }
        );
        const spacesData = await spacesRes.json();
        const spaces = spacesData.results || [];

        // Use CQL search to get all pages with proper sorting
        const cqlQuery = encodeURIComponent("type=page ORDER BY lastmodified DESC");
        const pagesRes = await fetch(
          `https://${domain}/wiki/rest/api/content/search?cql=${cqlQuery}&limit=100&expand=version,space,history.lastUpdated,history.createdBy`,
          { headers }
        );
        const pagesData = await pagesRes.json();
        const pages = pagesData.results || [];

        // Also get total page count using a separate query
        const countRes = await fetch(
          `https://${domain}/wiki/rest/api/content/search?cql=${encodeURIComponent("type=page")}&limit=0`,
          { headers }
        );
        const countData = await countRes.json();
        const totalPageCount = countData.totalSize || pages.length;

        // Calculate stats per space
        const spaceStats: Record<string, { pageCount: number; recentActivity: number }> = {};
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const contributors = new Set<string>();

        for (const page of pages) {
          const spaceKey = page.space?.key;
          if (!spaceKey) continue;
          
          if (!spaceStats[spaceKey]) {
            spaceStats[spaceKey] = { pageCount: 0, recentActivity: 0 };
          }
          spaceStats[spaceKey].pageCount++;
          
          // Track contributors
          const author = page.history?.lastUpdated?.by?.displayName || 
                        page.history?.createdBy?.displayName ||
                        page.version?.by?.displayName;
          if (author) {
            contributors.add(author);
          }
          
          const lastUpdated = new Date(page.history?.lastUpdated?.when || page.version?.when || 0);
          if (lastUpdated > weekAgo) {
            spaceStats[spaceKey].recentActivity++;
          }
        }

        // Get page counts per space using space content API
        const spacePageCounts: Record<string, number> = {};
        await Promise.all(
          spaces.slice(0, 10).map(async (space: any) => {
            try {
              const spaceContentRes = await fetch(
                `https://${domain}/wiki/rest/api/space/${space.key}/content/page?limit=0`,
                { headers }
              );
              const spaceContentData = await spaceContentRes.json();
              spacePageCounts[space.key] = spaceContentData.size || spaceStats[space.key]?.pageCount || 0;
            } catch {
              spacePageCounts[space.key] = spaceStats[space.key]?.pageCount || 0;
            }
          })
        );

        // Format spaces with stats
        const spacesWithStats = spaces.map((s: any) => ({
          key: s.key,
          name: s.name,
          id: s.id,
          type: s.type,
          pageCount: spacePageCounts[s.key] || spaceStats[s.key]?.pageCount || 0,
          recentActivity: spaceStats[s.key]?.recentActivity || 0,
          link: `https://${domain}/wiki/spaces/${s.key}`,
        }));

        // Calculate total pages from space counts
        const calculatedTotalPages = Object.values(spacePageCounts).reduce((sum, count) => sum + count, 0) || totalPageCount;

        // Format recent pages
        const recentPages = pages.slice(0, 20).map((p: any) => ({
          id: p.id,
          title: p.title,
          space: p.space?.key,
          spaceName: p.space?.name,
          version: p.version?.number || 1,
          lastUpdated: p.history?.lastUpdated?.when || p.version?.when || new Date().toISOString(),
          lastUpdatedBy: p.history?.lastUpdated?.by?.displayName || 
                        p.history?.createdBy?.displayName ||
                        p.version?.by?.displayName || "Unknown",
          link: `https://${domain}/wiki${p._links?.webui || `/pages/${p.id}`}`,
        }));

        // Activity by day (last 14 days)
        const activityByDay: Record<string, number> = {};
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        
        for (let i = 0; i < 14; i++) {
          const date = new Date(twoWeeksAgo.getTime() + i * 24 * 60 * 60 * 1000);
          const key = date.toISOString().split("T")[0];
          activityByDay[key] = 0;
        }

        for (const page of pages) {
          const lastUpdated = new Date(page.history?.lastUpdated?.when || page.version?.when || 0);
          if (lastUpdated > twoWeeksAgo && lastUpdated <= now) {
            const key = lastUpdated.toISOString().split("T")[0];
            if (activityByDay[key] !== undefined) {
              activityByDay[key]++;
            }
          }
        }

        const activityTimeline = Object.entries(activityByDay)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({
            date,
            updates: count,
          }));

        // Count active this week
        const activeThisWeek = pages.filter((p: any) => {
          const updated = new Date(p.history?.lastUpdated?.when || p.version?.when || 0);
          return updated > weekAgo;
        }).length;

        // Pages by space for pie chart
        const pagesBySpace = spacesWithStats
          .filter((s: any) => s.pageCount > 0)
          .sort((a: any, b: any) => b.pageCount - a.pageCount)
          .slice(0, 8)
          .map((s: any) => ({
            name: s.name,
            value: s.pageCount,
            key: s.key,
          }));

        return NextResponse.json({
          overview: {
            totalSpaces: spaces.length,
            totalPages: calculatedTotalPages,
            activeThisWeek: activeThisWeek,
            contributors: contributors.size,
          },
          spaces: spacesWithStats,
          recentPages,
          activityTimeline,
          pagesBySpace,
        });
      }

      case "page-content": {
        const pageId = searchParams.get("pageId");
        if (!pageId) {
          return NextResponse.json({ error: "pageId required" }, { status: 400 });
        }

        const pageRes = await fetch(
          `https://${domain}/wiki/rest/api/content/${pageId}?expand=body.view,version,space,history.lastUpdated`,
          { headers }
        );
        const page = await pageRes.json();

        if (!pageRes.ok) {
          return NextResponse.json(page, { status: pageRes.status });
        }

        return NextResponse.json({
          id: page.id,
          title: page.title,
          space: page.space?.key,
          spaceName: page.space?.name,
          content: page.body?.view?.value || "<p>No content</p>",
          version: page.version?.number,
          lastUpdated: page.history?.lastUpdated?.when || page.version?.when,
          lastUpdatedBy: page.history?.lastUpdated?.by?.displayName || page.version?.by?.displayName,
          link: `https://${domain}/wiki${page._links?.webui}`,
        });
      }

      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 401 }
    );
  }
}
