import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";

// Helper to get auth headers from request
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

    const response = await fetch(`https://${domain}/wiki/rest/api/space`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Simplify response for frontend
    const spaces = data.results.map((s: any) => ({
      key: s.key,
      name: s.name,
      id: s.id,
    }));

    return NextResponse.json(spaces);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 401 }
    );
  }
}

