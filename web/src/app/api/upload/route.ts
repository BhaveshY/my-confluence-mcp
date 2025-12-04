import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name;
    const fileType = file.type;
    let content = "";

    // Handle different file types
    if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const result = await extractText(buffer);
        
        console.log("PDF parse result type:", typeof result);
        console.log("PDF parse result:", JSON.stringify(result).slice(0, 500));
        
        // Handle all possible return types from unpdf
        if (typeof result === "string") {
          content = result;
        } else if (result && typeof result === "object") {
          if (typeof result.text === "string") {
            content = result.text;
          } else if (Array.isArray(result.text)) {
            content = result.text.join("\n\n");
          } else if ("totalPages" in result) {
            // Try to get text from pages
            content = String(result.text || "");
          }
        }
        
        if (!content) {
          content = "";
        }
        
        const trimmed = content.trim();
        if (!trimmed || trimmed.length === 0) {
          return NextResponse.json(
            { error: "PDF appears to be empty or contains only images." },
            { status: 400 }
          );
        }
        content = trimmed;
      } catch (pdfError) {
        console.error("PDF parsing error:", pdfError);
        return NextResponse.json(
          { error: "Failed to parse PDF. Try a different file." },
          { status: 400 }
        );
      }
    } else if (
      fileType === "text/plain" ||
      fileType === "text/markdown" ||
      fileType === "text/csv" ||
      fileType === "text/html" ||
      fileName.endsWith(".md") ||
      fileName.endsWith(".txt") ||
      fileName.endsWith(".csv") ||
      fileName.endsWith(".html")
    ) {
      content = await file.text();
    } else if (
      fileType === "application/json" ||
      fileName.endsWith(".json")
    ) {
      const jsonText = await file.text();
      try {
        content = JSON.stringify(JSON.parse(jsonText), null, 2);
      } catch {
        content = jsonText;
      }
    } else {
      try {
        content = await file.text();
        if (content.includes('\0') || content.includes('\uFFFD')) {
          return NextResponse.json(
            { error: "Binary file detected. Use PDF, TXT, MD, JSON, or CSV." },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: `Unsupported file type. Try PDF, TXT, MD, JSON, or CSV.` },
          { status: 400 }
        );
      }
    }

    // Clean up content
    content = content
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Limit length
    const maxLength = 15000;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + "\n\n[Truncated...]";
    }

    if (!content || content.length === 0) {
      return NextResponse.json(
        { error: "File appears to be empty." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      fileName,
      fileType,
      content,
      length: content.length,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
