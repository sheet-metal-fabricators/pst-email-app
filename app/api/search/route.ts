import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

interface Email {
  subject?: string;
  sender?: string;
  recipients?: string[];
  date?: string;
  body?: string;
  folder?: string;
}

interface SearchPayload {
  query: string;
  emails: Email[];
  provider: "claude" | "chatgpt" | "gemini";
}

const SYSTEM_PROMPT = `You are an email search assistant. Analyze the provided emails and answer the user's query by finding and extracting relevant information.

RULES:
- Return ONLY valid JSON. No markdown fences. No preamble. No text outside the JSON.
- Identify all emails relevant to the query.
- Extract specific information the user asked about.
- Synthesize a clear, comprehensive answer.

JSON schema:
{
  "answer": "Clear answer synthesizing info from relevant emails",
  "relevant_emails": [
    {
      "index": <int>,
      "subject": "<email subject>",
      "relevance": "<why relevant>",
      "extracted_info": "<specific extracted data>"
    }
  ],
  "summary_table": [
    {"label": "<data point>", "value": "<value>"}
  ]
}

If nothing relevant: {"answer": "No relevant information found in the loaded emails.", "relevant_emails": [], "summary_table": []}`;

function buildEmailBlock(emails: Email[]): string {
  const max = Math.min(emails.length, 200);
  const parts: string[] = [];
  for (let i = 0; i < max; i++) {
    const e = emails[i];
    const body = (e.body || "").substring(0, 600);
    parts.push(
      `[${i}] From: ${e.sender || "?"} | To: ${(e.recipients || []).slice(0, 3).join(", ")} | ` +
        `Date: ${(e.date || "").substring(0, 10)} | Subject: ${e.subject || "?"}\n${body}`
    );
  }
  return parts.join("\n---\n");
}

function cleanJsonResponse(text: string): any {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

// ── Claude ──────────────────────────────────────────────────────────

async function searchWithClaude(apiKey: string, query: string, emailBlock: string) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Emails:\n\n${emailBlock}\n\n---\nQuery: ${query}` }],
  });

  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  return cleanJsonResponse(text);
}

// ── ChatGPT ─────────────────────────────────────────────────────────

async function searchWithChatGPT(apiKey: string, query: string, emailBlock: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 2048,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Emails:\n\n${emailBlock}\n\n---\nQuery: ${query}` },
      ],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "OpenAI API error");

  const text = data.choices?.[0]?.message?.content || "";
  return cleanJsonResponse(text);
}

// ── Gemini ──────────────────────────────────────────────────────────

async function searchWithGemini(apiKey: string, query: string, emailBlock: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          { role: "user", parts: [{ text: `Emails:\n\n${emailBlock}\n\n---\nQuery: ${query}` }] },
        ],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    }
  );

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Gemini API error");

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return cleanJsonResponse(text);
}

// ── Route Handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key") || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key provided. Please add your API key in Settings." },
        { status: 401 }
      );
    }

    const { query, emails, provider = "claude" }: SearchPayload = await req.json();

    if (!query?.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }
    if (!emails?.length) {
      return NextResponse.json({ error: "No emails provided" }, { status: 400 });
    }

    const emailBlock = buildEmailBlock(emails);

    let result;
    switch (provider) {
      case "chatgpt":
        result = await searchWithChatGPT(apiKey, query, emailBlock);
        break;
      case "gemini":
        result = await searchWithGemini(apiKey, query, emailBlock);
        break;
      case "claude":
      default:
        result = await searchWithClaude(apiKey, query, emailBlock);
        break;
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Search error:", err);

    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "AI returned an unparseable response. Please try again." },
        { status: 502 }
      );
    }

    const msg = err.message || "Search failed";
    const status = msg.includes("401") || msg.includes("invalid") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
