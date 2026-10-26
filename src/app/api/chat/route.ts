import { UPDATE_FIELDS } from "@/lib/engine/updates";

// Gemini is used only as a translator: it turns free-form messages into either
// structured updates (which the rules engine then re-decides on) or an answer grounded
// in the engine's own records. It never sets a status itself.

export const maxDuration = 60;

const MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.8-flash"];

const SYSTEM = `You are the assistant inside a franchise expansion tool used by a retail brand's expansion team in Karnataka.
A deterministic rules engine has already produced a recommendation for every applicant (ADVANCE, HOLD, WAITLIST, REDIRECT, NOT_NOW, WITHDRAWN) with reasons. The expansion owner makes the final call; you never approve, reject or change a status yourself.

Your job:
1. If the user gives NEW INFORMATION about an applicant, return intent "update" and one or more updates using ONLY these fields:
   investment (total ₹ lakh they can invest, number), extraCapital (ADDITIONAL ₹ lakh newly committed, number), experience (years, number),
   space ("Owned" | "Rented" | "Not yet identified"), sizeSqft (number), floor ("Ground" | "Upper" | "Mall unit" | "Not known"),
   targetMonths (number), language ("Kannada" | "English" | "Hindi"), pin (6 digits), city, financing ("applied" | "sanctioned"),
   ownerOperatorConfirmed (true when they confirm they will run the store full-time themselves), withdrawn (true), note (any other fact, as text).
   "Found a ground-floor space" => floor "Ground". Keep "answer" to one short sentence acknowledging the update.
2. If the user asks a question, return intent "explain", "list", "compare" or "general" and answer ONLY from DATA below. Quote the engine's reasons; do not invent facts, numbers or rules. If DATA does not contain the answer, say so.
3. Answers: plain English, at most 120 words, mention application IDs, no markdown tables.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: ["update", "explain", "list", "compare", "general"] },
    appIds: { type: "ARRAY", items: { type: "STRING" } },
    updates: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { appId: { type: "STRING" }, field: { type: "STRING", enum: UPDATE_FIELDS }, value: { type: "STRING" } },
        required: ["appId", "field", "value"],
      },
    },
    answer: { type: "STRING" },
  },
  required: ["intent", "appIds", "updates", "answer"],
};

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 30;
}

export async function POST(req: Request) {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3].filter((k): k is string => !!k);
  if (!keys.length) return Response.json({ error: "AI not configured" }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (limited(ip)) return Response.json({ error: "Too many requests — try again in a minute." }, { status: 429 });

  let body: { message?: string; data?: string; history?: { role: string; text: string }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const message = String(body.message ?? "").slice(0, 2000);
  const data = String(body.data ?? "").slice(0, 90_000);
  if (!message) return Response.json({ error: "empty message" }, { status: 400 });
  const history = (body.history ?? []).slice(-6).map((h) => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: String(h.text).slice(0, 1500) }] }));

  const payload = {
    systemInstruction: { parts: [{ text: `${SYSTEM}\n\nDATA (engine records, JSON):\n${data}` }] },
    contents: [...history, { role: "user", parts: [{ text: message }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.1, maxOutputTokens: 1024 },
  };

  // Try every key, and every model on each key, so one exhausted key or one busy model does not break the chat.
  const errors: string[] = [];
  for (const [ki, key] of keys.entries()) {
    for (const model of MODELS) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(14_000),
        });
        const j = await r.json();
        if (!r.ok) {
          errors.push(`key${ki + 1}/${model}: ${j?.error?.message?.slice(0, 100) ?? r.status}`);
          if (r.status === 429 || r.status === 403) break; // this key is out of quota: move to the next key
          continue;
        }
        const text: string | undefined = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
        if (!text) {
          errors.push(`key${ki + 1}/${model}: empty`);
          continue;
        }
        return Response.json({ ...JSON.parse(text), model });
      } catch (e) {
        errors.push(`key${ki + 1}/${model}: ${(e as Error).name === "TimeoutError" ? "timeout" : (e as Error).message.slice(0, 80)}`);
      }
    }
  }
  return Response.json({ error: "AI unavailable", details: errors }, { status: 502 });
}
