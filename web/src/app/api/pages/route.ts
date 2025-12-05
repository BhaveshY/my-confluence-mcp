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

const escapeCqlValue = (value: string) => value.replace(/["\\]/g, "\\$&").trim();

export async function GET(request: NextRequest) {
  try {
    const { domain, authHeader } = getAuthHeaders(request);
    const { searchParams } = new URL(request.url);
    // Support both legacy "title" and new "query" params; prefer the more flexible query.
    const query = searchParams.get("query") || searchParams.get("title");
    const spaceKey = searchParams.get("spaceKey");

    const cqlParts = ["type=page"];

    if (spaceKey) {
      cqlParts.push(`space = "${escapeCqlValue(spaceKey)}"`);
    }

    if (query) {
      const escapedQuery = escapeCqlValue(query);
      const tokens = escapedQuery.split(/\s+/).filter(Boolean);

      // Require all words to appear in the title (prefix match) and also search for the full phrase in text/title.
      const titleClause = tokens.length
        ? tokens.map((token) => `title ~ "${token}*"`).join(" AND ")
        : `title ~ "${escapedQuery}"`;

      const phraseClause = [
        `text ~ "\\"${escapedQuery}\\""`, // exact phrase anywhere in the page
        `text ~ "${escapedQuery}"`,       // loose match across text
        `title ~ "\\"${escapedQuery}\\""`,// exact phrase in title
      ].join(" OR ");

      cqlParts.push(`(${phraseClause} OR (${titleClause}) OR title ~ "${escapedQuery}")`);
    }

    const cql = `${cqlParts.join(" AND ")} order by score desc`;

    const response = await fetch(
      `https://${domain}/wiki/rest/api/content?cql=${encodeURIComponent(
        cql
      )}&expand=version,space&limit=50`,
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(
      data.results.map((page: any) => ({
        id: page.id,
        title: page.title,
        space: page.space?.key,
        version: page.version?.number,
        link: `https://${domain}/wiki${page._links.webui}`,
      }))
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { domain, authHeader } = getAuthHeaders(request);
    const body = await request.json();
    const { title, spaceKey, content } = body;

    const response = await fetch(`https://${domain}/wiki/rest/api/content`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        type: "page",
        space: { key: spaceKey },
        body: {
          storage: {
            value: content,
            representation: "storage",
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json({
      id: data.id,
      title: data.title,
      link: `https://${domain}/wiki${data._links.webui}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 401 }
    );
  }
}

