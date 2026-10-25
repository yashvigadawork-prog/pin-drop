import type { Update } from "./updates";

// Deterministic reader for the questions and updates people actually type.
// It runs first: when it is confident we answer straight from the engine record, so
// the same question always gets the same answer. Anything it can't read goes to Gemini.

export interface Parsed {
  kind: "explain" | "update" | "list" | "unknown";
  appIds: string[];
  updates: Update[];
  filter?: { status?: string; city?: string; territory?: string };
  confident: boolean;
}

const ID_RE = /\b(?:app)[\s-]?0*(\d{1,4})(?:-r\d+)?\b/gi;

export function findIds(text: string, known: string[]): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(ID_RE)) {
    const n = parseInt(m[1]);
    const exact = known.find((k) => k.toUpperCase() === m[0].toUpperCase().replace(/\s/, "-"));
    const byNum = known.find((k) => /^APP-0*(\d+)$/i.test(k) && parseInt(k.replace(/\D/g, "")) === n);
    const id = exact ?? byNum;
    if (id && !out.includes(id)) out.push(id);
  }
  // names: "why is Deepa on hold"
  return out;
}

export function parseMessage(text: string, known: string[], names: Record<string, string> = {}): Parsed {
  const t = text.trim();
  const lower = t.toLowerCase();
  let ids = findIds(t, known);
  if (!ids.length) {
    for (const [id, name] of Object.entries(names)) {
      const first = name.split(/\s+/)[0]?.toLowerCase();
      if (name && (lower.includes(name.toLowerCase()) || (first && first.length > 3 && new RegExp(`\\b${first}\\b`).test(lower)))) ids.push(id);
    }
    ids = ids.slice(0, 3);
  }
  const updates: Update[] = [];
  const push = (field: Update["field"], value: Update["value"]) => ids.length && updates.push({ appId: ids[0], field, value, source: "chat", text: t });

  if (ids.length) {
    // floor / new space
    if (/ground[- ]?floor|street[- ]level|road[- ]facing/.test(lower) && /(found|got|secured|moved|shifted|has|now|new|identified|signed|switch)/.test(lower)) push("floor", "Ground");
    else if (/mall/.test(lower) && /(found|got|secured|moved|shifted|has|now|new|unit)/.test(lower)) push("floor", "Mall unit");
    else if (/(upper|first|1st|second) floor/.test(lower) && /(is|now|actually|turns out|only)/.test(lower)) push("floor", "Upper");
    const sq = lower.match(/(\d{3,4})\s*(sq\.?\s?ft|sqft|square feet|sft)/);
    if (sq) push("sizeSqft", parseInt(sq[1]));
    if (/\b(bought|purchased|owns|owned)\b/.test(lower) && /(space|shop|property|unit|premises)/.test(lower)) push("space", "Owned");
    else if (/(signed (a |the )?(lease|rent)|rented|leased|took .* on rent)/.test(lower)) push("space", "Rented");
    // money
    const lakh = lower.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(lakh|lac|lakhs|l\b)/);
    if (lakh) {
      if (/(more|additional|extra|another|top[- ]?up|add|co-?invest|family|fd|fixed deposit|savings|partner)/.test(lower)) push("extraCapital", parseFloat(lakh[1]));
      else if (/(investment|invest|capital|budget|funds?)/.test(lower)) push("investment", parseFloat(lakh[1]));
    }
    if (/loan/.test(lower) && /(sanction|approv|disburs|cleared|granted)/.test(lower)) push("financing", "sanctioned");
    else if (/(applied|applying) for (a |the )?loan/.test(lower)) push("financing", "applied");
    // people
    if (/(withdr[ae]w|dropped out|backed out|no longer interested|pulled out|not interested anymore|cancel)/.test(lower)) push("withdrawn", true);
    if (/(will run|run it|run the store|manage it|be in the store).*(himself|herself|themself|themselves|personally|full[- ]time)|full[- ]time (owner|operator)|quit (his|her|their) job/.test(lower)) push("ownerOperatorConfirmed", true);
    const exp = lower.match(/(\d+(?:\.\d+)?)\s*(years?|yrs)\s*(of\s*)?(retail\s*)?experience/);
    if (exp) push("experience", parseFloat(exp[1]));
    const pin = lower.match(/\b(5\d{5})\b/);
    if (pin && /pin/.test(lower)) push("pin", pin[1]);
    const months = lower.match(/(?:open|launch)\w*\s*(?:in|within|after)\s*(\d+)\s*months?/);
    if (months) push("targetMonths", parseInt(months[1]));
    const lang = lower.match(/(prefers?|training in|wants?)\s*(kannada|english|hindi)/);
    if (lang) push("language", lang[2]);
  }

  if (updates.length) return { kind: "update", appIds: ids, updates, confident: true };
  if (ids.length && /\b(why|explain|reason|what|status|tell me|how|which|when|where|next|plan|train|score|happen|decision|about)\b|\?$/.test(lower))
    return { kind: "explain", appIds: ids, updates: [], confident: ids.length === 1 && /^(why|explain|what|tell me|show|status|how)/.test(lower) };
  if (ids.length === 1 && t.length < 25) return { kind: "explain", appIds: ids, updates: [], confident: true };
  const status = lower.match(/\b(hold|on hold|advance|advanced|waitlist|waitlisted|redirect|not now|withdrawn)\b/);
  if (/\b(list|show|who|which|how many)\b/.test(lower) && status)
    return { kind: "list", appIds: [], updates: [], filter: { status: status[1] }, confident: !/\b(and|but|compare|best|why)\b/.test(lower) };
  return { kind: "unknown", appIds: ids, updates: [], confident: false };
}

export function statusFromWord(w: string) {
  w = w.toLowerCase();
  if (w.includes("hold")) return "HOLD";
  if (w.startsWith("advance")) return "ADVANCE";
  if (w.startsWith("wait")) return "WAITLIST";
  if (w.startsWith("redirect")) return "REDIRECT";
  if (w.includes("not now")) return "NOT_NOW";
  if (w.startsWith("withdr")) return "WITHDRAWN";
  return null;
}
