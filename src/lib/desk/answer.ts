import type { Row } from "./model";
import { countBy } from "./model";
import { stageTimes } from "./metrics";
import { UI_META, UI_ORDER, type Desk, type UiStatus } from "./types";

// Answers the questions people ask most, straight from the records, with no AI.
// Returns null when the question is not one of these, so the caller can try the AI.

const CITY_WORDS: [string, RegExp][] = [
  ["Bengaluru", /bengaluru|bangalore/], ["Mysuru", /mysuru|mysore/], ["Mangaluru", /mangaluru|mangalore/], ["Hubballi-Dharwad", /hubballi|hubli|dharwad/],
  ["Belagavi", /belagavi|belgaum/], ["Tumakuru", /tumakuru|tumkur/], ["Davanagere", /davanagere|davangere/],
];
const STATUS_WORDS: [RegExp, UiStatus][] = [
  [/needs? info|on hold|hold/, "info"], [/waitlist|waiting list/, "wait"], [/expansion/, "exp"], [/not now|rejected/, "no"], [/new[- ]pin|redirect/, "redir"], [/proceed|advance|approved/, "adv"],
];

export interface Answer {
  text: string;
  ids: string[];
}

function line(r: Row) {
  return `${r.id} ${r.app.name}: ${UI_META[r.ui].label}, fit ${r.fit}. ${r.why}`;
}

export function deskAnswer(q: string, rows: Row[], desk: Desk, ids: string[], now: number): Answer | null {
  const t = q.toLowerCase();
  const known = ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Row[];
  const city = CITY_WORDS.find(([, re]) => re.test(t))?.[0];

  if (known.length >= 2 && /compare|versus| vs |instead of|rather than|over |difference|better than|beat/.test(t)) {
    const [x, y] = known;
    const hi = x.fit === y.fit ? null : x.fit > y.fit ? x : y;
    const samePin = x.slotPin && x.slotPin === y.app.pin;
    return { ids: [x.id, y.id], text: `${x.id} vs ${y.id}\n• ${line(x)}\n• ${line(y)}\n${hi ? `${hi.app.name.split(" ")[0]} has the higher fit.` : "Same fit. Row order decides."}${samePin ? ` ${x.app.name.split(" ")[0]} holds pin ${x.slotPin}, the pin ${y.app.name.split(" ")[0]} asked for.` : ""}${x.offer !== undefined || y.offer !== undefined ? " Moving to another pin lowers the offer strength." : ""}` };
  }
  if (/bottleneck|slowest|slow|delay|stuck/.test(t)) {
    const worst = stageTimes(desk, now).filter((s) => s.avg !== null && s.avg > s.target).sort((a, b) => b.avg! - b.target - (a.avg! - a.target))[0];
    return { ids: [], text: worst ? `Biggest wait: ${worst.name}, ${worst.avg} days against a ${worst.target}-day target. See Overview.` : "No bottleneck yet. Times fill in as emails go out and partners reply." };
  }
  if (/how many|count|number of/.test(t)) {
    const pool = city ? rows.filter((r) => (r.app.city ?? r.app.cityRaw) === city) : rows;
    const c = countBy(pool);
    return { ids: [], text: `${pool.length} applicants${city ? ` in ${city}` : ""}:\n${UI_ORDER.filter((s) => c[s]).map((s) => `• ${UI_META[s].label}: ${c[s]}`).join("\n")}` };
  }
  const sw = STATUS_WORDS.find(([re]) => re.test(t));
  if (/\btop\b|\bbest\b|strongest/.test(t) && !sw) {
    const n = Number((t.match(/top\s*(\d+)/) ?? [])[1] ?? 5);
    const list = rows.filter((r) => !r.moved && (r.ui === "adv" || r.ui === "redir")).sort((a, b) => b.fit - a.fit).slice(0, n);
    return { ids: list.map((r) => r.id), text: list.length ? `Top ${list.length} waiting for your yes:\n${list.map((r, i) => `${i + 1}. ${r.id} ${r.app.name} (${r.fit}) ${r.app.city ?? ""}`).join("\n")}` : "Nobody is waiting for a yes right now." };
  }
  if (sw && /who|which|list|show|what/.test(t) && !known.length) {
    const list = rows.filter((r) => r.ui === sw[1] && (!city || (r.app.city ?? r.app.cityRaw) === city));
    return { ids: list.slice(0, 8).map((r) => r.id), text: `${list.length} on ${UI_META[sw[1]].label}${city ? ` in ${city}` : ""}:\n${list.slice(0, 10).map((r) => `• ${r.id} ${r.app.name}: ${r.asks[0] ?? r.why}`).join("\n")}${list.length > 10 ? `\n…and ${list.length - 10} more` : ""}` };
  }
  return null;
}
