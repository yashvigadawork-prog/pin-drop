// Owner-side workflow that sits on top of the engine: what the owner moved, emailed, locked
// and onboarded. The engine only recommends; everything here is a decision a person made.

export type UiStatus = "adv" | "info" | "no" | "wait" | "redir" | "exp";
export const UI_ORDER: UiStatus[] = ["adv", "info", "no", "wait", "redir", "exp"];
export const UI_META: Record<UiStatus, { label: string; icon: string; hint: string }> = {
  adv: { label: "Proceed", icon: "check", hint: "Pin reserved, ready for next steps" },
  info: { label: "Needs info", icon: "help", hint: "A fixable question must be answered first" },
  no: { label: "Not now", icon: "pause", hint: "Does not fit this round" },
  wait: { label: "Waitlist", icon: "hourglass", hint: "Qualified, but every slot is taken" },
  redir: { label: "New-pin offer", icon: "repeat", hint: "Strong partner, offered a different free pin" },
  exp: { label: "Expansion list", icon: "globe", hint: "Kept for when we serve their area" },
};

export type MailType = "next" | "offer" | "info" | "pin" | "dup" | "line" | "notnow" | "keep" | "exp2" | "remind";
export const MAIL_LABEL: Record<MailType, string> = {
  next: "Next steps",
  offer: "New-pin offer",
  info: "Questions",
  pin: "Confirm pin",
  dup: "Merge duplicate",
  line: "In line",
  notnow: "Not now",
  keep: "Keep on file",
  exp2: "We're expanding",
  remind: "Reminder",
};

export type CheckState = "todo" | "asked" | "received" | "verified" | "flag";
export const CK_META: Record<CheckState, [string, string]> = {
  todo: ["clock", "Not asked"],
  asked: ["mail", "Asked"],
  received: ["file", "Received"],
  verified: ["check", "Verified"],
  flag: ["alert", "Flag"],
};
export const CHECK_GROUPS: { name: string; icon: string; mod: ModKey; items: [string, string][] }[] = [
  { name: "Documents", icon: "file", mod: "docs", items: [["pan", "PAN card"], ["kyc", "Aadhaar / KYC"], ["gst", "GST registration"], ["bank", "6-month bank statements"]] },
  { name: "Funds", icon: "wallet", mod: "funds", items: [["pof", "Proof of funds"], ["liq", "Liquid vs total funds"], ["src", "Source of funds"]] },
  { name: "Background", icon: "shield", mod: "bg", items: [["idadd", "Identity and address"], ["court", "Court and litigation search"], ["credit", "Credit report"], ["refs", "Two references"]] },
  { name: "Conflicts", icon: "alert", mod: "emp", items: [["emp", "Employment status"], ["comp", "Competitor franchise check"], ["title", "Property title or lease"]] },
  { name: "Validation", icon: "phone", mod: "val", items: [["call", "Call with an existing partner"], ["meet", "Meeting with expansion team"]] },
];
export const ALL_CHECK_KEYS = CHECK_GROUPS.flatMap((g) => g.items.map((i) => i[0]));
export const STAGES = ["Offer sent", "Documents", "Background", "Site audit", "Validation call", "Agreement", "Licences", "Fit-out", "Training", "Soft launch", "Opens", "90-day review"];

export type ModKey = "bg" | "docs" | "funds" | "emp" | "near" | "fmt" | "val" | "sup";
export const MODS: [ModKey, string, string, string][] = [
  ["bg", "shield", "Background check", "Identity, address, courts and credit before the agreement. Amazon vets every partner before enrolment."],
  ["docs", "file", "Document checklist", "PAN, KYC, GST, bank statements, tracked per partner."],
  ["funds", "wallet", "Liquid vs total funds", "Cash in hand counts. Loans and land sales count only once received."],
  ["emp", "usercheck", "Employment and conflicts", "Government job, notice period and competitor franchise questions."],
  ["near", "pin", "Nearby-store flag", "Warns when an applied pin sits next to an existing store. A proxy until real map data."],
  ["fmt", "layers", "Format fit", "Suggests a smaller format for near-miss space or capital. Lenskart and Delhivery both tier formats."],
  ["val", "phone", "Validation call", "Applicant speaks to a current partner before signing."],
  ["sup", "heart", "90-day support and NPS", "Mentor visit, helpline, day 30/60/90 reviews and an NPS survey."],
];

export interface MailRec {
  type: MailType;
  at: string;
  edited?: boolean;
}
export interface Move {
  target: UiStatus;
  reason: string;
  at: string;
  from: UiStatus;
  pin?: string;
  terr?: string;
}
export interface OnbRec {
  stage: number;
  chk: Record<string, CheckState>;
  since: string;
  holdUntil: string;
}
export interface Reply {
  id: string;
  at: string;
  text: string;
}
export interface ExpPerson {
  id: string;
  name: string;
  city: string;
  pin: string;
  reason: string;
  fit: number;
  added: string;
}

export interface Desk {
  moves: Record<string, Move>;
  mail: Record<string, MailRec>; // key: app id, "exp:<id>" keep-on-file, "exp2:<id>" expansion email
  mailLog: Record<string, MailRec[]>;
  closed: Record<string, boolean>;
  onb: Record<string, OnbRec>;
  spot: Record<string, "agree" | "moved">;
  replies: Reply[];
  notes: Record<string, string>;
  expExtra: ExpPerson[];
  servedOn: Record<string, boolean>;
  mods: Record<ModKey, boolean>;
  guard: { spot: number; kill: boolean; hold: number };
  emailMode: "demo" | "real";
  expThreshold: number;
  extras: Record<string, Record<string, CheckState>>; // checks pre-filled from optional upload columns
  uploadedAt: string;
  sample: boolean;
}

export function emptyDesk(): Desk {
  return {
    moves: {},
    mail: {},
    mailLog: {},
    closed: {},
    onb: {},
    spot: {},
    replies: [],
    notes: {},
    expExtra: [],
    servedOn: {},
    mods: { bg: true, docs: true, funds: true, emp: true, near: true, fmt: true, val: true, sup: true },
    guard: { spot: 10, kill: true, hold: 30 },
    emailMode: "demo",
    expThreshold: 2,
    extras: {},
    uploadedAt: "",
    sample: false,
  };
}

// Places we can draw on the stylised map (longitude, latitude).
export const MAP_CITIES: { n: string; lon: number; lat: number; served: boolean }[] = [
  { n: "Bengaluru", lon: 77.59, lat: 12.97, served: true },
  { n: "Mysuru", lon: 76.64, lat: 12.3, served: true },
  { n: "Mangaluru", lon: 74.86, lat: 12.91, served: true },
  { n: "Hubballi-Dharwad", lon: 75.12, lat: 15.36, served: true },
  { n: "Belagavi", lon: 74.5, lat: 15.85, served: true },
  { n: "Tumakuru", lon: 77.1, lat: 13.34, served: true },
  { n: "Davanagere", lon: 75.92, lat: 14.47, served: true },
  { n: "Hassan", lon: 76.1, lat: 13.0, served: false },
  { n: "Udupi", lon: 74.75, lat: 13.34, served: false },
  { n: "Shivamogga", lon: 75.57, lat: 13.93, served: false },
  { n: "Ballari", lon: 76.92, lat: 15.14, served: false },
  { n: "Kalaburagi", lon: 76.83, lat: 17.33, served: false },
];
export const PIN_PREFIX: Record<string, string> = { Bengaluru: "560", Mysuru: "570", Mangaluru: "575", "Hubballi-Dharwad": "580", Belagavi: "590", Tumakuru: "572", Davanagere: "577", Hassan: "573", Udupi: "576", Shivamogga: "577", Ballari: "583", Kalaburagi: "585" };
export const KARNATAKA_OUTLINE: [number, number][] = [[74.1, 15.75], [74.35, 15.85], [74.3, 16.3], [74.55, 17.05], [74.75, 17.35], [75.4, 17.55], [75.9, 17.9], [76.35, 17.95], [77.1, 18.4], [77.6, 18.0], [77.95, 17.35], [77.45, 16.6], [77.35, 16.1], [77.75, 15.75], [77.5, 15.3], [77.55, 14.55], [77.8, 14.1], [78.3, 13.85], [78.3, 13.35], [78.25, 12.85], [78.0, 12.4], [77.75, 12.0], [77.55, 11.75], [77.2, 11.65], [76.55, 11.65], [76.05, 11.85], [75.75, 12.1], [75.5, 12.4], [75.0, 12.5], [74.78, 12.8], [74.68, 13.4], [74.45, 14.2], [74.1, 14.85]];

export const PLAN_STEPS: [string, number, number, "P" | "E" | "T" | "O"][] = [
  ["Owner sign-off and LOI", 0, 1, "O"], ["Documents and funds", 0, 2, "P"], ["Background check", 0, 3, "E"], ["Site audit", 1, 1, "E"], ["Talk to an existing partner", 1, 1, "P"],
  ["Agreement and fee", 2, 1, "P"], ["Licences", 2, 3, "P"], ["Fit-out", 3, 6, "E"], ["Hire staff", 5, 3, "P"], ["Training", 8, 3, "T"], ["Soft launch", 11, 1, "E"], ["Store opens", 12, 1, "P"], ["30 / 60 / 90-day reviews", 16, 9, "E"],
];

export const SIGNAL_LABEL: Record<string, string> = {
  relevant_retail: "Same-category experience", adjacent_retail: "Runs or ran a shop", multi_unit_operator: "Runs several outlets", owner_not_operator: "May not run the store",
  funding_conditional: "Funding depends on an event", other_funds: "Mentions extra funds", experience_in_text: "Experience in their words", space_in_text: "Space in their words",
  festival_deadline: "Festival deadline", competitor_franchise: "Another brand or competitor", legal_issue: "Legal dispute mentioned", floor_mentioned_upper: "Upper floor mentioned", floor_mentioned_ground: "Ground floor mentioned",
};
