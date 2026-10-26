import { CITIES, DEFAULT_STORES, LANGUAGES, cityForPin, cityInfo } from "./config";
import type {
  Application,
  City,
  DataHealth,
  EngineInput,
  ExistingStore,
  Floor,
  Language,
  Priority,
  SpaceStatus,
  Territory,
  Tier,
} from "./types";

// The judges' file is read by header name, never by column position, so an extra
// or reordered column does not break anything.

type Cell = string | number | boolean | null | undefined | Date;
export type SheetRows = Cell[][];

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const str = (v: Cell) => (v === null || v === undefined ? "" : String(v).trim());

const APP_HEADERS: Record<string, string[]> = {
  id: ["applicationid", "appid", "id"],
  name: ["applicantname", "name"],
  city: ["city"],
  state: ["state"],
  pin: ["pincode", "pin", "pincodes"],
  investment: ["investmentcapacitylakh", "investmentcapacity", "investment"],
  experience: ["retailexperienceyears", "retailexperience", "experience"],
  business: ["currentpastbusiness", "currentbusiness", "business"],
  space: ["spaceavailable", "space"],
  size: ["spacesizesqft", "spacesize", "size"],
  floor: ["floor"],
  target: ["targetlaunchmonths", "targetlaunch"],
  language: ["preferredlanguage", "language"],
  notes: ["notesfromapplicant", "notes"],
};

const TER_HEADERS: Record<string, string[]> = {
  id: ["territoryid", "id"],
  city: ["city"],
  state: ["state"],
  pins: ["pincodescovered", "pincodes", "pins"],
  tier: ["citytier", "tier"],
  slots: ["openslots", "slots"],
  priority: ["priority"],
};

const STORE_HEADERS: Record<string, string[]> = {
  id: ["storeid", "id"],
  city: ["city"],
  pin: ["pincode", "pin"],
  opened: ["openedyear", "opened", "year"],
};

function findHeader(rows: SheetRows, mustHave: string): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if ((rows[i] || []).some((c) => norm(c) === mustHave)) return i;
  }
  return -1;
}

function mapColumns(header: Cell[], spec: Record<string, string[]>): Record<string, number> {
  const cols: Record<string, number> = {};
  const normalized = header.map(norm);
  for (const [key, names] of Object.entries(spec)) {
    // exact match first, then prefix match (handles "Investment capacity (₹ lakh)" variants)
    let idx = normalized.findIndex((h) => names.includes(h));
    if (idx < 0) idx = normalized.findIndex((h) => names.some((n) => n.length > 3 && h.startsWith(n)));
    cols[key] = idx;
  }
  return cols;
}

const get = (row: Cell[], idx: number): Cell => (idx >= 0 ? row[idx] : "");

// ---- value normalisers ------------------------------------------------------

export function normCity(raw: string): City | null {
  const n = raw.toLowerCase().trim().replace(/\s+/g, " ");
  if (!n) return null;
  for (const c of CITIES) if (c.aliases.includes(n) || c.city.toLowerCase() === n) return c.city;
  const loose = n.replace(/[^a-z]/g, "");
  for (const c of CITIES) if (c.aliases.some((a) => a.replace(/[^a-z]/g, "") === loose)) return c.city;
  return null;
}

export function normPin(v: Cell): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = typeof v === "number" ? String(Math.round(v)) : String(v).replace(/\s|-/g, "").replace(/\.0+$/, "");
  return /^\d{6}$/.test(s) ? s : null;
}

const WORD_NUM: Record<string, number> = {
  zero: 0, none: 0, nil: 0, no: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
};

export interface NumParse {
  value: number | null;
  note?: string;
}

/** Parses numbers written the way people actually write them: "25", "25 lakh", "₹25,00,000", "1.2 cr", "20-25". */
export function parseNumber(v: Cell, kind: "lakh" | "years" | "sqft" | "months"): NumParse {
  if (typeof v === "number") return { value: kind === "lakh" && v >= 1000 ? v / 1e5 : v, note: kind === "lakh" && v >= 1000 ? `read ${v} as rupees = ₹${(v / 1e5).toFixed(1)} lakh` : undefined };
  const s = str(v).toLowerCase();
  if (!s) return { value: null };
  const word = s.match(/\b(zero|none|nil|no|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b/);
  const cleaned = s.replace(/,/g, "");
  const nums = [...cleaned.matchAll(/\d+(\.\d+)?/g)].map((m) => parseFloat(m[0]));
  let note: string | undefined;
  let value: number | null = null;
  if (nums.length === 0) {
    if (word) value = WORD_NUM[word[1]];
    else if (kind === "months" && /asap|immediate|urgent|soon/.test(s)) {
      value = 1;
      note = `read "${str(v)}" as 1 month`;
    } else return { value: null, note: `could not read "${str(v)}" as a number` };
  } else {
    value = nums[0];
    if (nums.length > 1 && /-|to/.test(cleaned)) note = `range given ("${str(v)}"); used the lower figure to stay conservative`;
  }
  if (value === null) return { value: null };
  if (kind === "lakh") {
    if (/cr|crore/.test(s)) {
      value = value * 100;
      note = `read "${str(v)}" as ₹${value} lakh`;
    } else if (value >= 1000) {
      value = value / 1e5;
      note = `read "${str(v)}" as rupees = ₹${value.toFixed(1)} lakh`;
    }
  }
  if (kind === "months" && /year|yr/.test(s)) {
    value = value * 12;
    note = `read "${str(v)}" as ${value} months`;
  }
  if (kind === "years" && /month/.test(s) && !/year|yr/.test(s)) {
    value = Math.round((value / 12) * 10) / 10;
    note = `read "${str(v)}" as ${value} years`;
  }
  if (value < 0) return { value: null, note: `negative value "${str(v)}" ignored` };
  return { value, note };
}

export function normSpace(raw: string): SpaceStatus | null {
  const s = raw.toLowerCase();
  if (!s) return null;
  if (/not yet|not identified|none|no space|looking|searching|^no$/.test(s)) return "Not yet identified";
  if (/\bown(ed|s)?\b|self.?owned|family.?owned/.test(s)) return "Owned";
  if (/rent|lease/.test(s)) return "Rented";
  return null;
}

export function normFloor(raw: string): Floor | null {
  const s = raw.toLowerCase();
  if (!s) return null;
  if (/mall/.test(s)) return "Mall unit";
  if (/ground|^gf$|street|road.?facing/.test(s)) return "Ground";
  if (/upper|first|1st|second|2nd|third|basement|mezz/.test(s)) return "Upper";
  if (/not known|unknown|tbd|not sure|na|n\/a/.test(s)) return "Not known";
  return null;
}

export function normLanguages(raw: string): Language[] {
  const s = raw.toLowerCase();
  const out: Language[] = [];
  if (/kannad/.test(s)) out.push("Kannada");
  if (/english|eng\b/.test(s)) out.push("English");
  if (/hindi/.test(s)) out.push("Hindi");
  return out.filter((l) => LANGUAGES.includes(l));
}

function normTier(raw: string): Tier | null {
  const m = raw.match(/[123]/);
  return m ? (`Tier ${m[0]}` as Tier) : null;
}

function normPriority(raw: string): Priority | null {
  const s = raw.toLowerCase();
  if (s.startsWith("h")) return "High";
  if (s.startsWith("m")) return "Medium";
  if (s.startsWith("l")) return "Low";
  return null;
}

// The template ships with one grey example row directly under the header.
const EXAMPLE_APP = { id: "APP-001", name: "ravikumar", pin: "570001" };
const EXAMPLE_TER = { id: "TER-01", pins: "570001,570002,570008" };

// ---- sheet readers ----------------------------------------------------------

export function readApplications(rows: SheetRows, health: DataHealth): Application[] {
  const h = findHeader(rows, "applicationid");
  if (h < 0) {
    health.warnings.push("Applications sheet: could not find the 'Application ID' header row.");
    return [];
  }
  const cols = mapColumns(rows[h], APP_HEADERS);
  for (const [k, i] of Object.entries(cols)) if (i < 0 && ["id", "city", "pin", "investment"].includes(k)) health.warnings.push(`Applications sheet: column for "${k}" not found.`);

  const apps: Application[] = [];
  const seen = new Map<string, number>();
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const rowNumber = r + 1;
    if (!row.some((c) => str(c) !== "")) continue;
    let id = str(get(row, cols.id)).toUpperCase();
    const name = str(get(row, cols.name));
    const pinRaw = str(get(row, cols.pin));
    if (r === h + 1 && id === EXAMPLE_APP.id && norm(name) === EXAMPLE_APP.name && normPin(get(row, cols.pin)) === EXAMPLE_APP.pin) {
      health.exampleRowSkipped.push({ sheet: "Applications", row: rowNumber });
      continue;
    }
    if (!id) {
      id = `ROW-${rowNumber}`;
      health.warnings.push(`Applications row ${rowNumber} has no Application ID — labelled it ${id}.`);
    }
    if (seen.has(id)) {
      const newId = `${id}-R${rowNumber}`;
      health.warnings.push(`Application ID ${id} appears twice (rows ${seen.get(id)} and ${rowNumber}) — second one labelled ${newId}.`);
      id = newId;
    }
    seen.set(id, rowNumber);

    const cityRaw = str(get(row, cols.city));
    const inv = parseNumber(get(row, cols.investment), "lakh");
    const exp = parseNumber(get(row, cols.experience), "years");
    const size = parseNumber(get(row, cols.size), "sqft");
    const tgt = parseNumber(get(row, cols.target), "months");
    const app: Application = {
      id,
      rowNumber,
      name,
      city: normCity(cityRaw),
      cityRaw,
      state: str(get(row, cols.state)),
      pin: normPin(get(row, cols.pin)),
      pinRaw,
      investment: inv.value,
      investmentRaw: str(get(row, cols.investment)),
      experience: exp.value,
      experienceRaw: str(get(row, cols.experience)),
      business: str(get(row, cols.business)),
      space: normSpace(str(get(row, cols.space))),
      spaceRaw: str(get(row, cols.space)),
      sizeSqft: size.value,
      sizeRaw: str(get(row, cols.size)),
      floor: normFloor(str(get(row, cols.floor))),
      floorRaw: str(get(row, cols.floor)),
      targetMonths: tgt.value,
      targetRaw: str(get(row, cols.target)),
      languages: normLanguages(str(get(row, cols.language))),
      languageRaw: str(get(row, cols.language)),
      notes: str(get(row, cols.notes)),
      extra: {},
    };
    const parseNotes = [inv.note && `investment ${inv.note}`, exp.note && `experience ${exp.note}`, size.note && `space size ${size.note}`, tgt.note && `target launch ${tgt.note}`].filter(Boolean) as string[];
    if (parseNotes.length) app.extra.infoNotes = parseNotes.map((n) => `Read from sheet: ${n}.`);
    apps.push(app);
  }
  return apps;
}

export function readTerritories(rows: SheetRows, health: DataHealth): Territory[] {
  const h = findHeader(rows, "territoryid");
  if (h < 0) {
    health.warnings.push("Territories sheet: could not find the 'Territory ID' header row.");
    return [];
  }
  const cols = mapColumns(rows[h], TER_HEADERS);
  const out: Territory[] = [];
  const seen = new Set<string>();
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const rowNumber = r + 1;
    if (!row.some((c) => str(c) !== "")) continue;
    let id = str(get(row, cols.id)).toUpperCase();
    const pinsRaw = str(get(row, cols.pins));
    if (r === h + 1 && id === EXAMPLE_TER.id && pinsRaw.replace(/\s/g, "") === EXAMPLE_TER.pins && normCity(str(get(row, cols.city))) === "Mysuru") {
      health.exampleRowSkipped.push({ sheet: "Territories", row: rowNumber });
      continue;
    }
    if (!id) id = `TER-ROW-${rowNumber}`;
    if (seen.has(id)) {
      health.warnings.push(`Territory ID ${id} appears twice — second one labelled ${id}-R${rowNumber}.`);
      id = `${id}-R${rowNumber}`;
    }
    seen.add(id);
    const cityRaw = str(get(row, cols.city));
    const city = normCity(cityRaw);
    const pins: string[] = [];
    for (const p of pinsRaw.split(/[,;\s/]+/).filter(Boolean)) {
      const pin = normPin(p);
      if (!pin) {
        health.warnings.push(`Territory ${id}: "${p}" is not a valid 6-digit pin — ignored.`);
        continue;
      }
      if (city && cityForPin(pin) !== city) {
        health.warnings.push(`Territory ${id} (${city}) lists pin ${pin}, which belongs to ${cityForPin(pin) ?? "no listed city"} — ignored.`);
        continue;
      }
      if (!pins.includes(pin)) pins.push(pin);
    }
    let tier = normTier(str(get(row, cols.tier)));
    if (city) {
      const official = cityInfo(city).tier;
      if (tier && tier !== official) health.warnings.push(`Territory ${id}: tier "${tier}" differs from ${city}'s official ${official} — used ${official}.`);
      tier = official;
    }
    const slots = parseNumber(get(row, cols.slots), "years").value ?? 0;
    out.push({
      id,
      rowNumber,
      city,
      cityRaw,
      state: str(get(row, cols.state)),
      pins,
      tier,
      slots: Math.max(0, Math.floor(slots)),
      priority: normPriority(str(get(row, cols.priority))),
    });
  }
  return out;
}

export function readStores(rows: SheetRows | null, health: DataHealth): ExistingStore[] {
  if (!rows) {
    health.warnings.push("Existing stores sheet not found — used the fixed list from the brief.");
    return DEFAULT_STORES;
  }
  const h = findHeader(rows, "storeid");
  if (h < 0) return DEFAULT_STORES;
  const cols = mapColumns(rows[h], STORE_HEADERS);
  const out: ExistingStore[] = [];
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const pin = normPin(get(row, cols.pin));
    const city = normCity(str(get(row, cols.city)));
    if (!pin || !city) continue;
    out.push({ id: str(get(row, cols.id)), city, pin, opened: Number(str(get(row, cols.opened))) || 0 });
  }
  return out.length ? out : DEFAULT_STORES;
}

export function emptyHealth(): DataHealth {
  return { applicationsRead: 0, territoriesRead: 0, skippedRows: [], exampleRowSkipped: [], warnings: [] };
}

/** sheets: map of sheet name -> rows (array of arrays). Sheet names are matched loosely. */
export function buildInput(sheets: Record<string, SheetRows>): EngineInput {
  const health = emptyHealth();
  const find = (want: string) => {
    const key = Object.keys(sheets).find((k) => norm(k) === norm(want)) ?? Object.keys(sheets).find((k) => norm(k).includes(norm(want)));
    return key ? sheets[key] : null;
  };
  // Fall back to header sniffing if sheet names were changed.
  const byHeader = (must: string) => Object.values(sheets).find((rows) => findHeader(rows, must) >= 0) ?? null;
  const appRows = find("Applications") ?? byHeader("applicationid");
  const terRows = find("Territories") ?? byHeader("territoryid");
  const storeRows = find("Existing stores") ?? byHeader("storeid");
  if (!appRows) health.warnings.push("No Applications sheet found.");
  if (!terRows) health.warnings.push("No Territories sheet found.");
  const applications = appRows ? readApplications(appRows, health) : [];
  const territories = terRows ? readTerritories(terRows, health) : [];
  const stores = readStores(storeRows, health);
  const owner = new Map<string, string>();
  for (const t of territories) for (const pin of t.pins) {
    const o = owner.get(pin);
    if (o && o !== t.id) health.warnings.push(`Pin ${pin} is listed in both ${o} and ${t.id}. The first listed territory is used.`);
    else owner.set(pin, t.id);
  }
  health.applicationsRead = applications.length;
  health.territoriesRead = territories.length;
  return { applications, territories, stores, health };
}
