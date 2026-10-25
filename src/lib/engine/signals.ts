import { FESTIVALS } from "./config";
import type { Application, Signal } from "./types";

// Reads the two free-text columns ("Current / past business", "Notes from applicant")
// for facts that matter to a franchisor. Signals can only raise questions or nudge a
// score — they never reject anyone on their own. Each signal keeps the applicant's
// exact words so the owner can judge the reading.

function snippet(text: string, index: number, len: number): string {
  const start = Math.max(0, text.lastIndexOf(".", index) + 1);
  let end = text.indexOf(".", index + len);
  if (end < 0) end = text.length;
  const s = text.slice(start, end).trim();
  return s.length > 140 ? s.slice(0, 137) + "…" : s;
}

const RULES: { kind: Signal["kind"]; re: RegExp; field: "business" | "notes" | "both" }[] = [
  {
    kind: "owner_not_operator",
    re: /hire (a |an )?(store |shop )?manager|manager will (run|handle|manage)|will not be (present|involved|available)|not be (at|in) the (store|shop)|passive|investor only|only invest|sleeping partner|\bnri\b|abroad|overseas|(son|daughter|brother|sister|wife|husband|nephew|cousin|relative|father|mother) will (run|manage|handle|look after)|someone else will (run|manage)|part[- ]time|on weekends|alongside my (job|work)|keep my (job|day job)/i,
    field: "both",
  },
  {
    kind: "funding_conditional",
    re: /\bloans?\b|bank financ|financ(e|ing) (needed|required|from|via|through|pending)|need(s)? (funding|financing|money|an investor|investor)|\bemi\b|depends on|subject to|awaiting|pending (approval|sanction)|borrow|mortgage|once (i|we) (sell|get)/i,
    field: "both",
  },
  {
    kind: "other_funds",
    re: /(fixed deposit|\bfds?\b|savings|family (will )?(support|help|contribute)|co-?invest|partner (will )?(invest|contribute)|additional|another|extra) ?(₹|rs\.?|inr)? ?\d+(\.\d+)? ?(lakh|lac|l\b)/i,
    field: "both",
  },
  { kind: "relevant_retail", re: /optic|optical|eyewear|eye ?wear|spectacle|optometr|sunglass|lens/i, field: "business" },
  {
    kind: "adjacent_retail",
    re: /store|shop|retail|boutique|showroom|outlet|footwear|apparel|garment|mobile|electronics|pharmacy|chemist|medical|kirana|supermarket|bakery|jewell?er|watch|franchise/i,
    field: "business",
  },
  { kind: "multi_unit_operator", re: /franchisee (of|for)|run(s|ning)? (a |an |two |three |\d+ )?franchise|multiple (stores|outlets|shops)|(two|three|\d+) (stores|outlets|shops)|chain of/i, field: "both" },
  { kind: "floor_mentioned_upper", re: /first floor|1st floor|upper floor|second floor|2nd floor|above (a|the)|basement|mezzanine/i, field: "notes" },
  { kind: "floor_mentioned_ground", re: /ground floor|road.?facing|main road|street.?facing|high street/i, field: "notes" },
];

export function extractSignals(app: Application, today: Date): Signal[] {
  const out: Signal[] = [];
  const fields = { business: app.business || "", notes: app.notes || "" };
  for (const rule of RULES) {
    const targets = rule.field === "both" ? [fields.business, fields.notes] : [fields[rule.field]];
    for (const t of targets) {
      const m = t.match(rule.re);
      const negated = (rule.kind === "adjacent_retail" || rule.kind === "relevant_retail") && /\b(no|never|not|zero)\b[^.]{0,25}(shop|store|retail|business|experience)/i.test(t);
      if (m && m.index !== undefined && !negated) {
        const sig: Signal = { kind: rule.kind, quote: snippet(t, m.index, m[0].length), source: "rules" };
        if (rule.kind === "other_funds") {
          const n = m[0].match(/\d+(\.\d+)?/);
          if (n) sig.value = parseFloat(n[0]);
        }
        out.push(sig);
        break;
      }
    }
  }
  // Relevant beats adjacent: keep only the stronger retail signal.
  if (out.some((s) => s.kind === "relevant_retail")) {
    const i = out.findIndex((s) => s.kind === "adjacent_retail");
    if (i >= 0) out.splice(i, 1);
  }
  // Years of experience written in free text (to cross-check the number column).
  const yrs = fields.business.match(/(\d+)\s*\+?\s*(yrs|years|year)/i);
  if (yrs && yrs.index !== undefined) out.push({ kind: "experience_in_text", quote: snippet(fields.business, yrs.index, yrs[0].length), value: parseInt(yrs[1]), source: "rules" });
  const sq = fields.notes.match(/(\d{3,4})\s*(sq\.? ?ft|sqft|square feet)/i);
  if (sq && sq.index !== undefined) out.push({ kind: "space_in_text", quote: snippet(fields.notes, sq.index, sq[0].length), value: parseInt(sq[1]), source: "rules" });

  for (const f of FESTIVALS) {
    const m = (fields.notes + " " + fields.business).match(f.match);
    if (m && m.index !== undefined) {
      const next = f.dates.map((d) => new Date(d + "T00:00:00")).find((d) => d.getTime() > today.getTime());
      if (next) {
        const months = (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
        out.push({
          kind: "festival_deadline",
          quote: snippet(fields.notes + " " + fields.business, m.index, m[0].length),
          value: `${f.name} ${next.toISOString().slice(0, 10)} (${months.toFixed(1)} months away)`,
          source: "rules",
        });
      }
    }
  }
  return out;
}

export function hasSignal(signals: Signal[], kind: Signal["kind"]) {
  return signals.find((s) => s.kind === kind);
}

export function festivalMonths(sig: Signal | undefined): number | null {
  if (!sig || typeof sig.value !== "string") return null;
  const m = sig.value.match(/\(([\d.]+) months away\)/);
  return m ? parseFloat(m[1]) : null;
}
