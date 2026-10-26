import type { Application, Decision, EngineInput, EngineResult, Status } from "../engine/types";
import { UI_META, type Desk, type ExpPerson, type Move, type UiStatus } from "./types";

// Turns engine decisions plus the owner's own moves into the rows every screen shows.

export interface Row {
  id: string;
  app: Application;
  d: Decision;
  engine: UiStatus; // what the engine recommends
  ui: UiStatus; // what the owner sees now (their move wins)
  move?: Move;
  moved: "onb" | "closed" | "exp" | null; // where they went after leaving the pipeline
  locked: boolean;
  tag?: "pin" | "dup";
  asks: string[];
  why: string;
  fit: number;
  offer?: number;
  slotPin?: string;
  slotTerr?: string;
  withdrawn: boolean;
  tier?: "A" | "B" | "C"; // rank band among everyone who passes every check
}

const has = (d: Decision, code: string) => d.issues.some((i) => i.code === code);

export function engineUi(d: Decision): UiStatus {
  const s: Status = d.status;
  if (s === "ADVANCE") return "adv";
  if (s === "REDIRECT") return "redir";
  if (s === "HOLD") return "info";
  if (s === "WAITLIST") return has(d, "PIN_OUTSIDE_TERRITORY") ? "exp" : "wait";
  if (s === "NOT_NOW") return has(d, "NO_TERRITORY_IN_CITY") || has(d, "CITY_OUTSIDE_NETWORK") ? "exp" : "no";
  return "no";
}

export function firstSentence(t: string, max = 96): string {
  const s = t.replace(/\s+/g, " ").trim();
  const cut = s.search(/[.!?](\s|$)/);
  const one = cut > 0 ? s.slice(0, cut + 1) : s;
  return one.length > max ? one.slice(0, max - 1).trimEnd() + "…" : one;
}

export function shortWhy(d: Decision, ui: UiStatus): string {
  const block = d.issues.find((i) => i.severity === "block");
  const warn = d.issues.find((i) => i.severity === "warn");
  const comp = d.competition;
  if (ui === "adv") {
    const lead = comp ? `All gates clear. #${comp.rank} of ${comp.contenders} in ${comp.territoryId}.` : "All gates clear.";
    return warn ? `${lead.replace(" All gates clear.", "")} ${firstSentence(warn.message, 70)}`.trim() : lead;
  }
  if (ui === "redir") return block ? firstSentence(block.message, 110) : d.headline;
  if (ui === "exp") return block ? firstSentence(block.message, 110) : "Valid pin, but we do not serve it yet.";
  if (block) return firstSentence(block.message, 110);
  if (ui === "wait" && comp?.beatenBy?.length) return `Slots in ${comp.territoryId} went to higher fits.`;
  return firstSentence(d.headline, 110);
}

export function buildRows(input: EngineInput, result: EngineResult, desk: Desk): Row[] {
  const rows: Row[] = result.order.map((id) => {
    const d = result.decisions[id];
    const app = input.applications.find((a) => a.id === id)!;
    const engine = engineUi(d);
    const move = desk.moves[id];
    const withdrawn = d.status === "WITHDRAWN";
    const ui = move ? move.target : engine;
    const moved: Row["moved"] = desk.onb[id] ? "onb" : desk.closed[id] || withdrawn ? "closed" : ui === "exp" ? "exp" : null;
    const rel = d.ownPinScore !== undefined;
    const fit = Math.round(rel ? d.ownPinScore! : d.score?.total ?? 0);
    const asks = d.issues.filter((i) => i.severity === "block" && i.fix).map((i) => i.fix!);
    const tag: Row["tag"] = d.issues.some((i) => i.code === "PIN_INVALID" || i.code === "PIN_CITY_MISMATCH") ? "pin" : has(d, "DUPLICATE_SUBMISSION") ? "dup" : undefined;
    return {
      id,
      app,
      d,
      engine,
      ui,
      move,
      moved,
      locked: !!d.allocation?.locked,
      tag,
      asks,
      why: move ? `You moved this: ${move.reason}` : shortWhy(d, engine),
      fit,
      offer: rel && d.score ? Math.round(d.score.total) : undefined,
      slotPin: d.allocation?.pin,
      slotTerr: d.allocation?.territoryId,
      withdrawn,
    };
  });
  // Tiers: the top slice of everyone who passes every check is A, the next slice B, the rest C.
  // Scores bunch near the top when most applicants are good, so rank says more than the raw number.
  const pool = rows.filter((r) => !r.withdrawn && (r.engine === "adv" || r.engine === "redir" || r.engine === "wait")).sort((a, b) => b.fit - a.fit || a.id.localeCompare(b.id));
  const aCut = Math.ceil((pool.length * (result.config.tierA ?? 10)) / 100);
  const bCut = Math.ceil((pool.length * (result.config.tierB ?? 40)) / 100);
  pool.forEach((r, i) => {
    r.tier = i < aCut ? "A" : i < bCut ? "B" : "C";
  });
  return rows;
}

export function active(rows: Row[]): Row[] {
  return rows.filter((r) => !r.moved);
}

export function countBy(rows: Row[]): Record<UiStatus, number> {
  const o = { adv: 0, info: 0, no: 0, wait: 0, redir: 0, exp: 0 } as Record<UiStatus, number>;
  for (const r of rows) o[r.ui]++;
  return o;
}

export function expAll(rows: Row[], desk: Desk): ExpPerson[] {
  const fromRows = rows
    .filter((r) => r.ui === "exp" && !r.withdrawn && !desk.onb[r.id])
    .map((r) => ({
      id: r.id,
      name: r.app.name,
      city: r.app.city ?? (r.app.cityRaw || "Unknown"),
      pin: r.app.pin ?? r.app.pinRaw,
      reason: r.move ? "Moved here by you" : has(r.d, "CITY_OUTSIDE_NETWORK") ? "City not served" : has(r.d, "NO_TERRITORY_IN_CITY") ? "No open territory in this city" : "Pin is outside every territory",
      fit: r.fit,
      added: "Today",
    }));
  return [...fromRows, ...desk.expExtra];
}

export function byCity(list: ExpPerson[]): [string, number][] {
  const m: Record<string, number> = {};
  for (const e of list) m[e.city] = (m[e.city] ?? 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

export interface FreePin {
  pin: string;
  terr: string;
  city: string;
}
/** Pins that can still be given to someone: in a territory with open capacity, not a store, not already taken. */
export function freePins(result: EngineResult, city?: string): FreePin[] {
  const out: FreePin[] = [];
  for (const t of result.territories) {
    if (city && t.territory.city !== city) continue;
    if (t.allocated.length >= t.capacity) continue;
    const taken = new Set(t.allocated.map((a) => a.pin));
    for (const p of t.freePins) if (!taken.has(p)) out.push({ pin: p, terr: t.territory.id, city: t.territory.city as string });
  }
  return out;
}

export function terrOf(result: EngineResult, pin: string | null): string | null {
  if (!pin) return null;
  return result.territories.find((t) => t.territory.pins.includes(pin))?.territory.id ?? null;
}

export function spotIds(rows: Row[], ratePct: number): string[] {
  const pool = rows.filter((r) => !r.moved && (r.ui === "no" || r.ui === "wait" || r.ui === "info" || r.ui === "exp")).sort((a, b) => a.id.localeCompare(b.id));
  const n = Math.min(pool.length, Math.max(1, Math.round((rows.length * ratePct) / 100)));
  if (!pool.length) return [];
  const step = pool.length / n;
  return Array.from({ length: n }, (_, i) => pool[Math.floor(i * step)].id);
}

export function uiLabel(s: UiStatus) {
  return UI_META[s].label;
}
