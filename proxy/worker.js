// Cloudflare Worker: AI proxy for FB-experiment.
// API keys and invitation codes MUST be configured as Cloudflare secrets, never committed.
// Required secrets: OPENAI_API_KEY, ACCESS_CODES (comma-separated random participant codes).
// Required text variables: ALLOWED_ORIGIN (exact https://<task>.cognition.run), OPENAI_MODEL.
// Required KV binding: USAGE (per-code usage records; KV quotas are not atomic).
// Set OpenAI project spending and rate limits independently. Do not deploy before testing.

const STUDY_INSTRUCTIONS = [
  "あなたは教員の文章指導を支援するAIです。",
  "【1回目の応答】",
  "提示された学習者の文章を原文とし、日本語で【フィードバック案】の見出しを使って回答してください。",
  "初期フィードバックでは文法・語彙・スペリングなど表層的な誤りを優先し、改善点と具体的な改善案（書き換え例を含む）を簡潔に提示してください。",
  "内容・構成についても必要に応じて指摘して構いません。学習者の意図を根拠なく断定しないでください。",
  "【2回目以降の応答】",
  "最初に提示された学習者の文章を原文として参照し、これまでのやり取りと教員からの最新の追質問・修正指示を踏まえて、日本語で簡潔に応答してください。",
  "教員の指示に応じて内容・構成・文脈に関する改善にも対応してください。"
].join("\n");

const INPUT_CHAR_LIMIT = 16000;
const REQUEST_BYTES_LIMIT = 50000;
const DEFAULT_MAX_CALLS = 40;
const HARD_MAX_CALLS = 100;

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "vary": "Origin",
    "cache-control": "no-store"
  };
}
function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8" }, headers)
  });
}
function error(message, status, headers) {
  return json({ error: message }, status, headers);
}
function codeFromRequest(request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const code = auth.substring(7).trim();
  return /^[A-Za-z0-9_-]{16,128}$/.test(code) ? code : null;
}
async function hashCode(code) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
function getMaxCalls(env) {
  const n = Number(env.MAX_CALLS_PER_CODE || DEFAULT_MAX_CALLS);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, HARD_MAX_CALLS) : DEFAULT_MAX_CALLS;
}
function extractResponseText(body) {
  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text.trim();
  }
  const chunks = [];
  for (const item of body.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) {
      if (part.type === "output_text" && typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const allowedOrigin = (env.ALLOWED_ORIGIN || "").trim();
    if (!allowedOrigin || origin !== allowedOrigin) {
      return error("Origin is not allowed.", 403, { "cache-control": "no-store" });
    }
    const headers = corsHeaders(allowedOrigin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers });

    const path = new URL(request.url).pathname;
    if (request.method !== "POST" || (path !== "/auth" && path !== "/generate")) {
      return error("Not found.", 404, headers);
    }
    if (!env.ACCESS_CODES || !env.OPENAI_API_KEY || !env.OPENAI_MODEL || !env.USAGE) {
      return error("Server is not configured.", 503, headers);
    }

    const code = codeFromRequest(request);
    if (!code) return error("Invalid access code.", 401, headers);
    const validCodes = env.ACCESS_CODES.split(",").map(s => s.trim()).filter(Boolean);
    if (!validCodes.includes(code)) return error("Invalid access code.", 401, headers);

    const usageKey = "quota:" + await hashCode(code);
    if (path === "/auth") return json({ authenticated: true }, 200, headers);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return error("Expected JSON.", 415, headers);
    }
    const declaredSize = Number(request.headers.get("content-length") || 0);
    if (declaredSize > REQUEST_BYTES_LIMIT) return error("Request too large.", 413, headers);

    let raw;
    try {
      raw = await request.text();
      if (new TextEncoder().encode(raw).length > REQUEST_BYTES_LIMIT) return error("Request too large.", 413, headers);
    } catch (_) {
      return error("Invalid request body.", 400, headers);
    }
    let body;
    try { body = JSON.parse(raw); } catch (_) { return error("Invalid JSON.", 400, headers); }
    const input = typeof body.text === "string" ? body.text.trim() : "";
    if (!input || input.length > INPUT_CHAR_LIMIT) return error("Text length is invalid.", 400, headers);

    const current = Number((await env.USAGE.get(usageKey)) || 0);
    if (!Number.isFinite(current) || current >= getMaxCalls(env)) {
      return error("This access code has reached its AI usage limit.", 429, headers);
    }

    // Reserve one request before sending to OpenAI. KV operations are eventually consistent:
    // quotas reduce accidental overuse but are NOT a strict concurrent spending cap.
    try {
      await env.USAGE.put(usageKey, String(current + 1));
    } catch (_) {
      return error("Usage counter is unavailable.", 503, headers);
    }

    let response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "authorization": "Bearer " + env.OPENAI_API_KEY,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          instructions: STUDY_INSTRUCTIONS,
          input: input,
          max_output_tokens: 3000,
          store: false
        }),
        signal: AbortSignal.timeout(80000)
      });
    } catch (_) {
      return error("AI service temporarily unavailable.", 502, headers);
    }
    if (!response.ok) {
      // Do not return provider response body; it may contain sensitive diagnostics.
      return error("AI service returned HTTP " + response.status + ".", 502, headers);
    }
    let result;
    try { result = await response.json(); } catch (_) {
      return error("Invalid AI response.", 502, headers);
    }
    const output = extractResponseText(result);
    if (!output) return error("AI did not return usable feedback.", 502, headers);
    return json({
      ai_feedback: output,
      generation_attempt: 1,
      model: result.model || env.OPENAI_MODEL,
      max_output_tokens: 3000,
      reasoning_effort: null,
      temperature: null
    }, 200, headers);
  }
};
