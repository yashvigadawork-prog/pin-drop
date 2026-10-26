// Core data shapes for the franchise partner engine.
// Everything the engine decides is derived from these inputs plus EngineConfig,
// so the same inputs always produce the same recommendations.

export type City =
  | "Bengaluru"
  | "Mysuru"
  | "Mangaluru"
  | "Hubballi-Dharwad"
  | "Belagavi"
  | "Tumakuru"
  | "Davanagere";

export type Tier = "Tier 1" | "Tier 2" | "Tier 3";
export type Priority = "High" | "Medium" | "Low";
export type SpaceStatus = "Owned" | "Rented" | "Not yet identified";
export type Floor = "Ground" | "Upper" | "Mall unit" | "Not known";
export type Language = "Kannada" | "English" | "Hindi";

export interface Application {
  id: string;
  rowNumber: number;
  name: string;
  city: City | null;
  cityRaw: string;
  state: string;
  pin: string | null;
  pinRaw: string;
  investment: number | null; // ₹ lakh
  investmentRaw: string;
  experience: number | null; // years
  experienceRaw: string;
  business: string;
  space: SpaceStatus | null;
  spaceRaw: string;
  sizeSqft: number | null;
  sizeRaw: string;
  floor: Floor | null;
  floorRaw: string;
  targetMonths: number | null;
  targetRaw: string;
  languages: Language[];
  languageRaw: string;
  notes: string;
  // Facts that arrive after upload (chat updates / owner input). Never in the sheet.
  extra: ApplicationExtra;
}

export interface ApplicationExtra {
  extraCapital?: number; // ₹ lakh of additional committed funds
  financing?: "applied" | "sanctioned";
  ownerOperatorConfirmed?: boolean;
  sizePendingAudit?: boolean; // space changed but size not yet measured
  withdrawn?: boolean;
  infoNotes?: string[]; // free-text facts the owner/chat added
}

export interface Territory {
  id: string;
  rowNumber: number;
  city: City | null;
  cityRaw: string;
  state: string;
  pins: string[];
  tier: Tier | null;
  slots: number;
  priority: Priority | null;
}

export interface ExistingStore {
  id: string;
  city: City;
  pin: string;
  opened: number;
}

export type Gate = "data" | "place" | "partner" | "premises" | "pace";
export type Severity = "block" | "warn" | "info";

export interface Issue {
  code: string;
  gate: Gate;
  severity: Severity;
  message: string; // what we observed, plain language
  fix?: string; // what would resolve it
  ruleId?: string; // links to the rulebook entry that justifies this
  evidence?: string; // the applicant's own words we based this on
}

export type GateState = "pass" | "attention" | "fail";

export interface GateResult {
  gate: Gate;
  state: GateState;
  summary: string;
}

export type Status = "ADVANCE" | "HOLD" | "WAITLIST" | "REDIRECT" | "NOT_NOW" | "WITHDRAWN";

export interface ScoreBreakdown {
  partner: number; // 0..1
  premises: number;
  place: number;
  pace: number;
  total: number; // 0..100 after weights
  notes: Record<"partner" | "premises" | "place" | "pace", string[]>;
}

export interface Signal {
  kind:
    | "owner_not_operator"
    | "funding_conditional"
    | "competitor_franchise"
    | "legal_issue"
    | "relevant_retail"
    | "adjacent_retail"
    | "multi_unit_operator"
    | "festival_deadline"
    | "floor_mentioned_upper"
    | "floor_mentioned_ground"
    | "experience_in_text"
    | "space_in_text"
    | "other_funds";
  quote: string;
  value?: number | string;
  source: "rules" | "ai";
}

export interface Allocation {
  territoryId: string;
  pin: string;
  kind: "own_pin" | "redirect";
  locked: boolean;
}

export interface Competition {
  territoryId: string;
  rank: number; // among eligible contenders in the territory
  contenders: number;
  capacity: number;
  beatenBy?: { id: string; score: number }[];
  samePinRivals?: string[];
  wouldRank?: number; // for HOLD: rank if their block were resolved
}

export interface PlanStep {
  week: number; // start week from today
  weeks: number; // duration
  title: string;
  owner: "Partner" | "Expansion team" | "Training team" | "Owner";
  detail: string;
}

export interface TrainingPlan {
  languages: Language[];
  languageNote?: string;
  mentorStore: { id: string; city: City; pin: string; distanceKm: number; why: string };
  modules: { name: string; days: number; mode: string }[];
  shadowDays: number;
  extended: boolean;
}

export interface OnboardingPlan {
  feasibleMonths: number;
  targetMonths: number | null;
  plannedOpen: string; // ISO date
  steps: PlanStep[];
  training: TrainingPlan;
  conditions: string[];
  payback: { months: number; investment: number; monthlyNet: number; tier: Tier } | null;
}

export interface Decision {
  id: string;
  status: Status;
  headline: string; // one line
  explanation: string; // short paragraph, plain language
  nextSteps: string[];
  gates: GateResult[];
  issues: Issue[];
  signals: Signal[];
  score: ScoreBreakdown | null;
  ownPinScore?: number; // when score shown is the relocation score
  territoryId: string | null;
  appliedTerritoryId: string | null; // territory of the pin they applied for
  allocation: Allocation | null;
  competition: Competition | null;
  plan: OnboardingPlan | null;
  ownerOverride?: OwnerAction;
  requiredCapital: number | null;
  effectiveCapital: number | null;
  alternatives: string[];
  challenges?: Challenge[]; // neighbouring pins this applicant is strong enough to be offered too
}

export interface OwnerAction {
  appId: string;
  action: "confirm" | "override";
  status?: Status; // for override
  allocation?: { territoryId: string; pin: string; kind: "own_pin" | "redirect" }; // for confirm
  reason: string;
  at: string;
  by?: string;
}

export interface Weights {
  partner: number;
  premises: number;
  place: number;
  pace: number;
}

export interface EngineConfig {
  minCapital: Record<Tier, number>; // ₹ lakh
  nearMissBand: number; // 0.15 = within 15% short counts as "financing probable"
  minSqft: number;
  tightSqft: number;
  maxSqft: number;
  weights: Weights;
  phaseName: string;
  monthlyRevenue: Record<Tier, number>; // ₹ lakh / month, indicative store sales
  netMargin: number; // partner net margin on sales, used only for indicative payback
  tierA?: number; // share of qualified applicants (by score) labelled Tier A, in percent. Default 10
  tierB?: number; // cumulative share labelled Tier A or B, in percent. Default 40
  challengeMargin?: number; // points a stronger loser must beat a neighbouring pin's holder by, to be offered that pin too
  custom?: CustomRule[]; // assumptions the owner adds in the app, applied without a redeploy
}

// An owner-added assumption: "experience must be at least 2 years", effect = what happens when it fails.
export interface CustomRule {
  id: string;
  label: string;
  field: "investment" | "experience" | "sizeSqft" | "targetMonths";
  op: "min" | "max";
  value: number;
  effect: "hold" | "flag" | "notnow";
}

export interface Challenge {
  pin: string;
  territoryId: string;
  vsId: string;
  vsName: string;
  vsScore: number;
  myScore: number;
  margin: number;
}

export interface TerritoryView {
  territory: Territory;
  freePins: string[];
  blockedPins: { pin: string; storeId: string }[];
  capacity: number; // min(slots, free pins)
  allocated: { appId: string; pin: string; kind: Allocation["kind"]; locked: boolean }[];
  contenders: string[];
  issues: string[];
}

export interface DataHealth {
  applicationsRead: number;
  territoriesRead: number;
  skippedRows: { sheet: string; row: number; reason: string }[];
  exampleRowSkipped: { sheet: string; row: number }[];
  warnings: string[];
}

export interface EngineInput {
  applications: Application[];
  territories: Territory[];
  stores: ExistingStore[];
  health: DataHealth;
}

export interface EngineResult {
  runAt: string;
  config: EngineConfig;
  decisions: Record<string, Decision>;
  order: string[]; // application ids in sheet order
  territories: TerritoryView[];
  health: DataHealth;
  counts: Record<Status, number>;
}

export interface Change {
  id: string;
  from: Status | null;
  to: Status | null;
  fromAlloc?: string | null;
  toAlloc?: string | null;
  fromScore?: number | null;
  toScore?: number | null;
  why: string;
}
