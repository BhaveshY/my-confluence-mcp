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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { domain, authHeader } = getAuthHeaders(request);
    const { id } = await params;
    const body = await request.json();
    const { title, content } = body;

    // 1. Get current version
    const getResponse = await fetch(
      `https://${domain}/wiki/rest/api/content/${id}`,
      {
        headers: { Authorization: authHeader },
      }
    );
    const pageData = await getResponse.json();

    if (!getResponse.ok) {
      return NextResponse.json(pageData, { status: getResponse.status });
    }

    const nextVersion = pageData.version.number + 1;

    // 2. Update
    const response = await fetch(
      `https://${domain}/wiki/rest/api/content/${id}`,
      {
        method: "PUT",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          type: "page",
          title: title,
          version: { number: nextVersion },
          body: {
            storage: {
              value: content,
              representation: "storage",
            },
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json({
      id: data.id,
      title: data.title,
      version: nextVersion,
      link: `https://${domain}/wiki${data._links.webui}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 401 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { domain, authHeader } = getAuthHeaders(request);
    const { id } = await params;

    const response = await fetch(
      `https://${domain}/wiki/rest/api/content/${id}`,
      {
        method: "DELETE",
        headers: { Authorization: authHeader },
      }
    );

    if (!response.ok && response.status !== 204) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 401 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { domain, authHeader } = getAuthHeaders(request);
    const { id } = await params;

    const response = await fetch(
      `https://${domain}/wiki/rest/api/content/${id}?expand=body.storage,version`,
      {
        headers: { Authorization: authHeader },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json({
      id: data.id,
      title: data.title,
      content: data.body.storage.value,
      version: data.version.number,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 401 }
    );
  }
}

