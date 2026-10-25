import type { City, EngineConfig, ExistingStore, Language, Tier, Weights } from "./types";

// ---- Fixed facts from the brief / template ---------------------------------

export const CITIES: { city: City; prefix: string; tier: Tier; aliases: string[] }[] = [
  { city: "Bengaluru", prefix: "560", tier: "Tier 1", aliases: ["bengaluru", "bangalore", "blr", "bengalooru"] },
  { city: "Mysuru", prefix: "570", tier: "Tier 2", aliases: ["mysuru", "mysore"] },
  { city: "Mangaluru", prefix: "575", tier: "Tier 2", aliases: ["mangaluru", "mangalore", "mangalooru"] },
  {
    city: "Hubballi-Dharwad",
    prefix: "580",
    tier: "Tier 2",
    aliases: ["hubballi-dharwad", "hubballi dharwad", "hubli-dharwad", "hubli dharwad", "hubballi", "hubli", "dharwad"],
  },
  { city: "Belagavi", prefix: "590", tier: "Tier 2", aliases: ["belagavi", "belgaum", "belgavi"] },
  { city: "Tumakuru", prefix: "572", tier: "Tier 3", aliases: ["tumakuru", "tumkur"] },
  { city: "Davanagere", prefix: "577", tier: "Tier 3", aliases: ["davanagere", "davangere", "davanagere city"] },
];

export const LANGUAGES: Language[] = ["Kannada", "English", "Hindi"];

// Sheet 3 is fixed in the template; we still read it from the upload when present,
// and fall back to this copy if the sheet is missing.
export const DEFAULT_STORES: ExistingStore[] = [
  { id: "ST-01", city: "Bengaluru", pin: "560001", opened: 2019 },
  { id: "ST-02", city: "Bengaluru", pin: "560034", opened: 2020 },
  { id: "ST-03", city: "Bengaluru", pin: "560038", opened: 2021 },
  { id: "ST-04", city: "Bengaluru", pin: "560066", opened: 2022 },
  { id: "ST-05", city: "Bengaluru", pin: "560076", opened: 2023 },
  { id: "ST-06", city: "Mysuru", pin: "570009", opened: 2021 },
  { id: "ST-07", city: "Mysuru", pin: "570017", opened: 2024 },
  { id: "ST-08", city: "Mangaluru", pin: "575001", opened: 2022 },
  { id: "ST-09", city: "Hubballi-Dharwad", pin: "580020", opened: 2023 },
  { id: "ST-10", city: "Belagavi", pin: "590001", opened: 2024 },
];

// Approximate road distances (km) used only to pick a mentor store for
// cities that have no store of their own yet.
export const ROAD_KM: Record<string, number> = {
  "Tumakuru|Bengaluru": 70,
  "Tumakuru|Mysuru": 150,
  "Davanagere|Hubballi-Dharwad": 145,
  "Davanagere|Bengaluru": 265,
  "Davanagere|Belagavi": 230,
  "Davanagere|Mangaluru": 250,
};

export function roadKm(a: City, b: City): number {
  if (a === b) return 0;
  return ROAD_KM[`${a}|${b}`] ?? ROAD_KM[`${b}|${a}`] ?? 999;
}

export function cityInfo(city: City) {
  return CITIES.find((c) => c.city === city)!;
}

export function cityForPin(pin: string): City | null {
  return CITIES.find((c) => pin.startsWith(c.prefix))?.city ?? null;
}

// ---- Assumptions (editable in the app) -------------------------------------

export const DEFAULT_WEIGHTS: Weights = { partner: 40, premises: 25, place: 20, pace: 15 };

export const DEFAULT_CONFIG: EngineConfig = {
  minCapital: { "Tier 1": 35, "Tier 2": 25, "Tier 3": 15 },
  nearMissBand: 0.15,
  minSqft: 250,
  tightSqft: 300,
  maxSqft: 1200,
  weights: DEFAULT_WEIGHTS,
  phaseName: "Balanced",
  monthlyRevenue: { "Tier 1": 12, "Tier 2": 9, "Tier 3": 5 },
  netMargin: 0.16,
};

export interface PhasePreset {
  name: string;
  weights: Weights;
  when: string;
}

// Weight presets for different expansion phases. They only change how competing
// applicants are ranked; the hard rules (pin rule, capital floor, site standards) never move.
export const PHASE_PRESETS: PhasePreset[] = [
  {
    name: "Balanced",
    weights: DEFAULT_WEIGHTS,
    when: "Default. Partner strength matters most because a failed store costs the brand more than an unopened one.",
  },
  {
    name: "Festive speed push",
    weights: { partner: 30, premises: 30, place: 10, pace: 30 },
    when: "When the brand needs stores open before a peak season: ready sites and realistic fast timelines rank higher.",
  },
  {
    name: "Quality first",
    weights: { partner: 55, premises: 25, place: 10, pace: 10 },
    when: "Entering a new city or after a weak cohort: back the strongest operators even if they open later.",
  },
  {
    name: "Priority territory blitz",
    weights: { partner: 30, premises: 20, place: 40, pace: 10 },
    when: "Leadership has marked specific territories as must-win this quarter.",
  },
];

export const PRIORITY_SCORE = { High: 1, Medium: 0.65, Low: 0.35 } as const;

// Real festival dates the engine can reason about when applicants mention them.
export const FESTIVALS: { name: string; match: RegExp; dates: string[] }[] = [
  { name: "Diwali", match: /\b(diwali|deepavali|deepawali)\b/i, dates: ["2026-11-08", "2027-10-29", "2028-10-17"] },
];
