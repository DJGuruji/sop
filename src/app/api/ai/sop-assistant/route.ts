import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/apiResponse";
import { requireActor, SOP_LIBRARY_UPLOAD_ROLES } from "@/lib/authz";

// Gemini API endpoint - updated to v1 for stable release models
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

type SopContext = {
  title?: string;
  department?: string;
  purpose?: string;
};

type Body = {
  message: string;
  context?: SopContext;
  history?: { role: "user" | "model"; parts: { text: string }[] }[];
};

export async function POST(req: Request) {
  const auth = await requireActor(SOP_LIBRARY_UPLOAD_ROLES);
  if (!auth.ok) {
    return NextResponse.json(fail("UNAUTHORIZED", "Access denied"), { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(fail("NOT_CONFIGURED", "Gemini API key not found in environment"), { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !body.message) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Message is required"), { status: 400 });
  }

  const { message, context, history = [] } = body;

  const systemPrompt = `
You are an expert Standard Operating Procedure (SOP) Assistant. 
Your goal is to help users write professional, clear, and compliant SOPs.

Current context of the SOP user is working on:
- Title: ${context?.title || "Untitled"}
- Department: ${context?.department || "Unassigned"}
- Current Purpose: ${context?.purpose || "Not yet written"}

Mode: AUTO-FILL SUPPORT
If you have enough information from the user's message (or if they ask to "write the whole SOP"), you can provide a structured JSON payload at the end of your message encapsulated in triple backticks with "json" label. 
The JSON must follow this exact format:
{
  "type": "sop_autofill",
  "data": {
    "title": "optional string",
    "purpose": "optional string",
    "scope": "optional string",
    "procedure": [{"step": 1, "text": "optional string"}],
    "dataSecurity": ["optional string"],
    "complianceRequirements": ["optional string"],
    "auditAndMonitoring": ["optional string"]
  }
}

Guidelines:
1. Suggest clear, actionable content for specific sections.
2. Provide professional "Purpose" and "Scope" descriptions.
3. Keep the tone professional, objective, and authoritative.
4. CRITICAL: Whenever you suggest content for a specific field (like Purpose, Scope, or Procedures), you MUST include the JSON block at the end with that field populated. This enables the "AUTO-FILL" feature.
5. If the user asks for a simple question, answer with text. If you provide any text that belongs in the SOP, use the JSON block.
    `.trim();

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          ...history,
          { role: "user", parts: [{ text: `System context: ${systemPrompt}\n\nUser Question: ${message}` }] }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Gemini API Error:", data);
      return NextResponse.json(fail("AI_ERROR", data?.error?.message || "Failed to call Gemini"), { status: res.status });
    }

    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

    return NextResponse.json(ok({ text: aiText }));
  } catch (err: any) {
    console.error("AI Proxy Error:", err);
    return NextResponse.json(fail("SERVER_ERROR", "Failed to connect to AI assistant"), { status: 500 });
  }
}
