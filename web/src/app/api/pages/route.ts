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
    const title = searchParams.get("title");
    const spaceKey = searchParams.get("spaceKey");

    let cql = "type=page";
    if (title) cql += ` AND title ~ "${title}"`;
    if (spaceKey) cql += ` AND space = "${spaceKey}"`;

    const response = await fetch(
      `https://${domain}/wiki/rest/api/content?cql=${encodeURIComponent(
        cql
      )}&expand=version,space`,
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

