import { CITIES, PRIORITY_SCORE, cityForPin, cityInfo } from "./config";
import { feasibleMonths } from "./plan";
import { extractSignals, festivalMonths, hasSignal } from "./signals";
import type { Application, EngineConfig, ExistingStore, Gate, GateResult, Issue, ScoreBreakdown, Signal, Territory, Tier } from "./types";

// Runs the five gates for one applicant. Nothing here looks at other applicants —
// competition is handled afterwards in allocate.ts.

export type PlaceOutcome = "own_pin" | "needs_redirect" | "no_territory";

export interface Evaluation {
  app: Application;
  issues: Issue[];
  signals: Signal[];
  gates: GateResult[];
  score: ScoreBreakdown;
  territory: Territory | null;
  place: PlaceOutcome;
  requiredCapital: number | null;
  effectiveCapital: number | null;
  feasibleMonths: number;
  holdBlocks: Issue[]; // fixable blockers -> HOLD
  hardBlocks: Issue[]; // not fixable by a quick answer -> NOT_NOW
  conditions: string[]; // must be verified during onboarding, do not block
  alternatives: string[];
}

export interface Ctx {
  territories: Territory[];
  stores: ExistingStore[];
  config: EngineConfig;
  today: Date;
  aiSignals?: Record<string, Signal[]>;
  duplicates?: Map<string, string>; // later app id -> earlier app id
}

const HARD = new Set(["CAPITAL_SHORT", "NO_TERRITORY_IN_CITY", "CITY_OUTSIDE_NETWORK"]);
const isHard = (code: string) => HARD.has(code) || code.startsWith("CUSTOM_NOTNOW_");
const PLACE_REDIRECT = new Set(["PIN_HAS_STORE", "PIN_OUTSIDE_TERRITORY", "TERRITORY_NO_CAPACITY"]);

export function evaluate(app: Application, ctx: Ctx): Evaluation {
  const { config, today } = ctx;
  const issues: Issue[] = [];
  const conditions: string[] = [];
  const alternatives: string[] = [];
  const add = (i: Issue) => issues.push(i);

  const signals = [...extractSignals(app, today), ...(ctx.aiSignals?.[app.id] ?? [])];
  const sig = (k: Signal["kind"]) => hasSignal(signals, k);

  // ---------------- Gate 0: is the form trustworthy? ----------------
  const dupOf = ctx.duplicates?.get(app.id);
  if (dupOf) add({ code: "DUPLICATE_SUBMISSION", gate: "data", severity: "block", message: `Looks like a second submission of ${dupOf} (same name and pin).`, fix: `Merge with ${dupOf} and keep the latest details; this copy does not compete for a slot.`, ruleId: "data-integrity" });
  if (!app.city) {
    if (!app.cityRaw) add({ code: "CITY_MISSING", gate: "data", severity: "block", message: "City is blank.", fix: "Confirm which city the store is for.", ruleId: "data-integrity" });
    else add({ code: "CITY_OUTSIDE_NETWORK", gate: "data", severity: "block", message: `"${app.cityRaw}" is not one of the seven cities in this expansion plan.`, fix: "Keep in the pipeline for a future city launch.", ruleId: "territory-plan" });
  }
  if (!app.pin) add({ code: "PIN_INVALID", gate: "data", severity: "block", message: app.pinRaw ? `Pin code "${app.pinRaw}" is not a valid 6-digit pin.` : "Pin code is blank.", fix: "Get the correct 6-digit pin code of the proposed site.", ruleId: "data-integrity" });
  if (app.city && app.pin) {
    const pinCity = cityForPin(app.pin);
    if (pinCity !== app.city)
      add({
        code: "PIN_CITY_MISMATCH",
        gate: "data",
        severity: "block",
        message: `Pin ${app.pin} ${pinCity ? `is a ${pinCity} pin` : "does not belong to any city in the plan"}, but the application says ${app.city}.`,
        fix: `Confirm whether the store is in ${app.city} (correct the pin) or in ${pinCity ?? "another city"}.`,
        ruleId: "data-integrity",
      });
  }
  if (app.state && app.state.toLowerCase() !== "karnataka")
    add({ code: "STATE_MISMATCH", gate: "data", severity: "warn", message: `State says "${app.state}", but every city in the plan is in Karnataka.`, fix: "Treated as Karnataka based on the city; confirm.", ruleId: "data-integrity" });
  // Numbers that cannot be right become a question, never a silent pass or a hard no.
  const badBits: string[] = [];
  const invInvalid = app.investment !== null && app.investment < 0;
  const sizeInvalid = app.sizeSqft !== null && app.sizeSqft < 0;
  if (invInvalid) badBits.push(`investment of ₹${app.investment}L`);
  if (app.experience !== null && (app.experience < 0 || app.experience > 60)) badBits.push(`${app.experience} years of experience`);
  if (sizeInvalid) badBits.push(`a space of ${app.sizeSqft} sq ft`);
  if (app.targetMonths !== null && app.targetMonths < 0) badBits.push(`a target of ${app.targetMonths} months`);
  if (badBits.length)
    add({ code: "VALUE_INVALID", gate: "data", severity: "block", message: `The form shows ${badBits.join(", ")}. That cannot be right.`, fix: "Ask the applicant to confirm these numbers before we judge the application.", ruleId: "data-integrity" });
  if (app.investment === null)
    add({ code: "INVESTMENT_MISSING", gate: "data", severity: "block", message: app.investmentRaw ? `Could not read investment "${app.investmentRaw}".` : "Investment capacity is blank.", fix: "Ask how much the applicant can invest (₹ lakh), with proof of funds.", ruleId: "capital" });
  if (app.experience === null)
    add({ code: "EXPERIENCE_MISSING", gate: "data", severity: "warn", message: "Retail experience is blank — scored as 0 years.", fix: "Confirm years of shop experience.", ruleId: "experience" });
  const expText = sig("experience_in_text");
  if (expText && app.experience !== null && Math.abs(Number(expText.value) - app.experience) >= 3)
    add({ code: "EXPERIENCE_CONTRADICTION", gate: "data", severity: "warn", message: `Experience column says ${app.experience} years, but their description mentions ${expText.value} years.`, evidence: expText.quote, fix: "Confirm on the discovery call; scored on the column value.", ruleId: "data-integrity" });
  if (!app.space)
    add({ code: "SPACE_MISSING", gate: "data", severity: "block", message: app.spaceRaw ? `Could not read space status "${app.spaceRaw}".` : "Space status is blank.", fix: "Ask whether they own, rent, or still need to find a space.", ruleId: "data-integrity" });

  let size = sizeInvalid ? null : app.sizeSqft;
  if ((app.space === "Owned" || app.space === "Rented") && size === null && !sizeInvalid && !app.extra.sizePendingAudit) {
    const fromNotes = sig("space_in_text");
    if (fromNotes) {
      size = Number(fromNotes.value);
      add({ code: "SIZE_FROM_NOTES", gate: "data", severity: "warn", message: `Space size column is blank; used ${size} sq ft from their notes.`, evidence: fromNotes.quote, fix: "Confirm at site audit.", ruleId: "data-integrity" });
    } else add({ code: "SIZE_MISSING", gate: "data", severity: "block", message: `Says the space is ${app.space.toLowerCase()} but gives no size.`, fix: "Get the carpet area in sq ft (we need at least 250).", ruleId: "space" });
  }
  if (app.space === "Not yet identified" && (app.sizeSqft !== null || (app.floor && app.floor !== "Not known")))
    add({ code: "SPACE_CONTRADICTION", gate: "data", severity: "warn", message: `Says no space identified yet, but also gives ${[app.sizeSqft !== null ? app.sizeSqft + " sq ft" : "", app.floor && app.floor !== "Not known" ? app.floor.toLowerCase() + " floor" : ""].filter(Boolean).join(", ")}.`, fix: "Probably a shortlisted site — treated as not yet secured; ask on the call.", ruleId: "data-integrity" });
  const upperInNotes = sig("floor_mentioned_upper");
  const groundInNotes = sig("floor_mentioned_ground");
  if (app.floor === "Ground" && upperInNotes)
    add({ code: "FLOOR_CONTRADICTION", gate: "data", severity: "block", message: "Floor column says Ground, but their notes describe an upper-floor space.", evidence: upperInNotes.quote, fix: "Confirm the floor — our format needs ground-floor or mall frontage.", ruleId: "floor" });
  if (app.floor === "Upper" && groundInNotes)
    add({ code: "FLOOR_CONTRADICTION_SOFT", gate: "data", severity: "warn", message: "Floor column says Upper, but notes mention a ground-floor / road-facing space.", evidence: groundInNotes.quote, fix: "Confirm — if ground floor, this hold clears.", ruleId: "floor" });
  if (!app.languages.length)
    add({ code: "LANGUAGE_DEFAULT", gate: "data", severity: "info", message: app.languageRaw ? `Could not read language "${app.languageRaw}" — planning Kannada + English.` : "No training language given — planning Kannada + English.", ruleId: "training" });

  // ---------------- Gate 1: Place ----------------
  let territory: Territory | null = null;
  let place: PlaceOutcome = "no_territory";
  if (app.pin && app.city && !issues.some((i) => i.code === "PIN_CITY_MISMATCH")) {
    const matches = ctx.territories.filter((t) => t.pins.includes(app.pin!));
    if (matches.length > 1) {
      matches.sort((a, b) => PRIORITY_SCORE[b.priority ?? "Low"] - PRIORITY_SCORE[a.priority ?? "Low"] || b.slots - a.slots);
      add({ code: "TERRITORY_OVERLAP", gate: "place", severity: "warn", message: `Pin ${app.pin} is listed in ${matches.map((m) => m.id).join(" and ")}; used ${matches[0].id} (higher priority).`, ruleId: "territory-plan" });
    }
    territory = matches[0] ?? null;
    const store = ctx.stores.find((s) => s.pin === app.pin);
    const cityTerritories = ctx.territories.filter((t) => t.city === app.city);
    if (store) {
      place = "needs_redirect";
      add({ code: "PIN_HAS_STORE", gate: "place", severity: "block", message: `Pin ${app.pin} already has our store ${store.id} (open since ${store.opened}). The brand never opens two stores in one pin.`, fix: "Offer a free pin nearby instead.", ruleId: "one-store-per-pin" });
    } else if (!territory) {
      if (cityTerritories.length) {
        place = "needs_redirect";
        add({ code: "PIN_OUTSIDE_TERRITORY", gate: "place", severity: "block", message: `Pin ${app.pin} is not inside any territory the brand is growing in (${app.city} territories: ${cityTerritories.map((t) => t.id).join(", ")}).`, fix: "Offer a pin inside a target territory.", ruleId: "territory-plan" });
      } else {
        add({ code: "NO_TERRITORY_IN_CITY", gate: "place", severity: "block", message: `The brand has no open territory in ${app.city} this round.`, fix: "Keep warm for the next expansion wave in this city.", ruleId: "territory-plan" });
      }
    } else if (territory.slots === 0 || territory.pins.every((p) => ctx.stores.some((s) => s.pin === p))) {
      place = "needs_redirect";
      add({ code: "TERRITORY_NO_CAPACITY", gate: "place", severity: "block", message: `${territory.id} has no open slots right now.`, fix: "Offer another territory in the city, or waitlist.", ruleId: "territory-plan" });
    } else place = "own_pin";
  }
  const tier: Tier | null = territory?.tier ?? (app.city ? cityInfo(app.city).tier : null);

  // ---------------- Gate 2: Partner ----------------
  let requiredCapital: number | null = null;
  let effectiveCapital: number | null = null;
  if (tier) requiredCapital = config.minCapital[tier];
  if (app.investment !== null && !invInvalid) effectiveCapital = app.investment + (app.extra.extraCapital ?? 0);
  if (requiredCapital !== null && effectiveCapital !== null) {
    const ratio = effectiveCapital / requiredCapital;
    const gap = Math.round((requiredCapital - effectiveCapital) * 10) / 10;
    if (ratio < 1) {
      if (app.extra.financing === "sanctioned") {
        add({ code: "FINANCING_SANCTIONED", gate: "partner", severity: "info", message: `Own funds ₹${effectiveCapital}L are ₹${gap}L short of the ₹${requiredCapital}L ${tier} minimum, but a loan is sanctioned to cover the gap.`, ruleId: "financing" });
      } else if (ratio >= 1 - config.nearMissBand) {
        add({
          code: "FINANCING_PROBABLE",
          gate: "partner",
          severity: "block",
          message: `₹${effectiveCapital}L is ₹${gap}L (${Math.round((1 - ratio) * 100)}%) short of the ₹${requiredCapital}L needed in a ${tier} city — within our ${Math.round(config.nearMissBand * 100)}% "financing probable" band.`,
          fix: `Ask: (1) any other funds they can commit and show proof of (FDs, family co-investor)? (2) would they take a business loan for ₹${gap}L — e.g. PM Mudra (Tarun / TarunPlus) or a CGTMSE-backed bank loan?`,
          ruleId: "financing",
        });
      } else {
        add({ code: "CAPITAL_SHORT", gate: "partner", severity: "block", message: `₹${effectiveCapital}L is ${Math.round((1 - ratio) * 100)}% below the ₹${requiredCapital}L a ${tier} store needs — too far to bridge safely with a loan.`, fix: `Would need about ₹${gap}L more committed funds.`, ruleId: "capital" });
        const fits = (Object.entries(config.minCapital) as [Tier, number][]).filter(([, v]) => effectiveCapital! >= v * (1 - config.nearMissBand) && v < requiredCapital!);
        if (fits.length) {
          const t = fits.sort((a, b) => b[1] - a[1])[0];
          alternatives.push(`Their budget fits a ${t[0]} store (₹${t[1]}L) — e.g. ${CITIES.filter((c) => c.tier === t[0]).map((c) => c.city).join(" / ")}, if they are open to it.`);
        }
      }
    }
  }
  const others = sig("other_funds");
  if (others && !app.extra.extraCapital)
    add({ code: "OTHER_FUNDS_MENTIONED", gate: "partner", severity: "info", message: `Mentions more funds${others.value ? ` (~₹${others.value}L)` : ""} — not counted until proof is shared.`, evidence: others.quote, ruleId: "capital" });
  const cond = sig("funding_conditional");
  if (cond && app.extra.financing !== "sanctioned")
    add({ code: "FUNDING_CONDITIONAL", gate: "partner", severity: "warn", message: "Their funding seems to depend on a loan or another event.", evidence: cond.quote, fix: "Sanction letter / proof of funds before the agreement is signed.", ruleId: "capital" });
  const passive = sig("owner_not_operator");
  if (passive && !app.extra.ownerOperatorConfirmed)
    add({ code: "OWNER_OPERATOR_QUESTION", gate: "partner", severity: "warn", message: "Reads like the applicant may not run the store day-to-day.", evidence: passive.quote, fix: "Ask who will run the store full-time; that person must complete the full training.", ruleId: "owner-operator" });
  const comp = sig("competitor_franchise");
  if (comp)
    add({ code: "COMPETITOR_CONFLICT", gate: "partner", severity: "warn", message: "Mentions another brand's franchise or a competitor.", evidence: comp.quote, fix: "Ask whether they hold a competing franchise and whether that agreement allows ours.", ruleId: "data-integrity" });
  const legal = sig("legal_issue");
  if (legal)
    add({ code: "LEGAL_DISPUTE", gate: "premises", severity: "warn", message: "Mentions a legal dispute.", evidence: legal.quote, fix: "Ask for the property title copy and the current status of the case before any agreement.", ruleId: "data-integrity" });
  if ((app.experience ?? 0) === 0)
    add({ code: "NO_EXPERIENCE", gate: "partner", severity: "info", message: "No retail experience — not a blocker; gets the extended training track.", ruleId: "experience" });

  // ---------------- Gate 3: Premises ----------------
  if (app.space === "Owned" || app.space === "Rented") {
    if (size !== null && app.extra.sizePendingAudit) conditions.push(`Space changed since the application — re-measure at site audit (earlier space was ${size} sq ft; need ≥${config.minSqft}).`);
    if (size !== null) {
      if (size < config.minSqft) add({ code: "SPACE_TOO_SMALL", gate: "premises", severity: "block", message: `${size} sq ft is below the ${config.minSqft} sq ft minimum for the store format.`, fix: `Find a space of at least ${config.minSqft} sq ft (ideal 300–500).`, ruleId: "space" });
      else if (size < config.tightSqft) add({ code: "SPACE_TIGHT", gate: "premises", severity: "warn", message: `${size} sq ft works but is tight (ideal 300–500).`, ruleId: "space" });
      else if (size > config.maxSqft) add({ code: "SPACE_LARGE", gate: "premises", severity: "warn", message: `${size} sq ft is much larger than the format needs — rent may hurt payback.`, fix: "Consider using only part of it.", ruleId: "space" });
    } else if (app.extra.sizePendingAudit) conditions.push("Measure the new space at site audit — must be at least " + config.minSqft + " sq ft.");
    if (app.floor === "Upper") add({ code: "FLOOR_UPPER", gate: "premises", severity: "block", message: "The space is on an upper floor. Our format depends on walk-in customers, so it needs ground-floor street frontage or a mall unit.", fix: "Find a ground-floor or mall space in the same pin.", ruleId: "floor" });
    if (!app.floor || app.floor === "Not known") conditions.push("Site audit must confirm a ground-floor or mall unit.");
  }
  if (app.space === "Not yet identified") conditions.push("Partner must secure a ground-floor/mall site of 250–500 sq ft; expansion team approves it at audit.");

  // ---------------- Gate 4: Pace ----------------
  const siteReady = app.space === "Owned" || app.space === "Rented";
  const feasible = feasibleMonths({ siteReady, financingInProgress: app.extra.financing === "applied" });
  if (app.targetMonths === null) add({ code: "TARGET_MISSING", gate: "pace", severity: "info", message: `No target launch given — planned for the earliest realistic date (${feasible} months).`, ruleId: "timeline" });
  else if (app.targetMonths < feasible)
    add({ code: "TIMELINE_TIGHT", gate: "pace", severity: "warn", message: `Wants to open in ${app.targetMonths} month${app.targetMonths === 1 ? "" : "s"}; the realistic earliest is ${feasible} months (site, agreement, 6-week fit-out, training).`, fix: `Reset expectations to ${feasible} months on the first call.`, ruleId: "timeline" });
  else if (app.targetMonths > 12)
    add({ code: "LATE_START", gate: "pace", severity: "warn", message: `Wants to open in ${app.targetMonths} months — a slot held that long blocks other partners.`, fix: "Reserve only if no ready partner competes for this territory.", ruleId: "timeline" });
  const fest = sig("festival_deadline");
  const fm = festivalMonths(fest);
  if (fest && fm !== null && fm < feasible)
    add({ code: "FESTIVAL_MISS", gate: "pace", severity: "warn", message: `Wants to open before ${String(fest.value).split(" (")[0]}, which is ${fm.toFixed(1)} months away — not achievable (earliest is ${feasible} months).`, evidence: fest.quote, fix: "Plan a post-festival opening, or target the next festive season.", ruleId: "timeline" });

  // ---------------- Owner-added assumptions ----------------
  for (const cr of config.custom ?? []) {
    const v = cr.field === "investment" ? (effectiveCapital ?? app.investment) : cr.field === "experience" ? app.experience : cr.field === "sizeSqft" ? size : app.targetMonths;
    if (v === null || v === undefined) continue;
    const fails = cr.op === "min" ? v < cr.value : v > cr.value;
    if (!fails) continue;
    const gate: Gate = cr.field === "sizeSqft" ? "premises" : cr.field === "targetMonths" ? "pace" : "partner";
    const code = `CUSTOM_${cr.effect === "notnow" ? "NOTNOW" : cr.effect === "hold" ? "HOLD" : "FLAG"}_${cr.id}`;
    add({ code, gate, severity: cr.effect === "flag" ? "warn" : "block", message: `${cr.label}: ${v} is ${cr.op === "min" ? "below the minimum" : "above the maximum"} of ${cr.value}.`, fix: cr.effect === "flag" ? undefined : "Ask the applicant to confirm or update this.", ruleId: "custom" });
  }

  // ---------------- Score ----------------
  const score = scoreOf(app, size, signals, territory, place, requiredCapital, effectiveCapital, feasible, config);

  const holdBlocks = issues.filter((i) => i.severity === "block" && !isHard(i.code) && !PLACE_REDIRECT.has(i.code));
  const hardBlocks = issues.filter((i) => i.severity === "block" && isHard(i.code));
  return {
    app,
    issues,
    signals,
    gates: gateStates(issues),
    score,
    territory,
    place,
    requiredCapital,
    effectiveCapital,
    feasibleMonths: feasible,
    holdBlocks,
    hardBlocks,
    conditions,
    alternatives,
  };
}

/**
 * Score for opening in a pin other than the one applied for: their current site can't be
 * used (so premises = needs a new site) and the move itself is uncertain (place discount).
 */
export function relocationScore(ev: Evaluation, config: EngineConfig): ScoreBreakdown {
  const moved: Application = { ...ev.app, space: "Not yet identified", sizeSqft: null, floor: null };
  const feasible = feasibleMonths({ siteReady: false, financingInProgress: ev.app.extra.financing === "applied" });
  const s = scoreOf(moved, null, ev.signals, null, "needs_redirect", ev.requiredCapital, ev.effectiveCapital, feasible, config);
  s.notes.premises = ["Needs a new site in the offered pin (current site can't be used)."];
  s.notes.place = ["Relocating to a pin they didn't choose — discounted because they may decline."];
  return s;
}

const GATE_LABEL: Record<Gate, string> = { data: "Application", place: "Place", partner: "Partner", premises: "Premises", pace: "Pace" };

function gateStates(issues: Issue[]): GateResult[] {
  return (Object.keys(GATE_LABEL) as Gate[]).map((g) => {
    const mine = issues.filter((i) => i.gate === g);
    const state = mine.some((i) => i.severity === "block") ? "fail" : mine.some((i) => i.severity === "warn") ? "attention" : "pass";
    const top = mine.find((i) => i.severity === "block") ?? mine.find((i) => i.severity === "warn");
    return { gate: g, state, summary: top ? top.message : passText(g) };
  });
}

function passText(g: Gate) {
  return {
    data: "Application is complete and consistent.",
    place: "Pin is inside a target territory and free of existing stores.",
    partner: "Has the capital for this city tier.",
    premises: "Space meets the format, or will be found and audited.",
    pace: "Timeline is realistic.",
  }[g];
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));

function scoreOf(
  app: Application,
  size: number | null,
  signals: Signal[],
  territory: Territory | null,
  place: PlaceOutcome,
  required: number | null,
  effective: number | null,
  feasible: number,
  config: EngineConfig,
): ScoreBreakdown {
  const notes: ScoreBreakdown["notes"] = { partner: [], premises: [], place: [], pace: [] };
  // Partner: capital headroom (60%) + experience (40%) +/- what their own words tell us.
  let cap = 0;
  if (required && effective !== null) {
    const r = effective / required;
    cap = r >= 1 ? 0.7 + 0.3 * Math.min((r - 1) / 0.5, 1) : r >= 1 - config.nearMissBand ? 0.45 : 0.1;
    notes.partner.push(`Capital ₹${effective}L vs ₹${required}L needed (${Math.round(r * 100)}%).`);
  }
  const yrs = Math.max(0, Math.min(app.experience ?? 0, 60));
  const expScore = 0.15 + 0.85 * Math.min(yrs / 8, 1);
  notes.partner.push(`${yrs} yrs retail experience.`);
  let partner = 0.6 * cap + 0.4 * expScore;
  const s = (k: Signal["kind"]) => hasSignal(signals, k);
  if (s("relevant_retail")) { partner += 0.12; notes.partner.push("+ Already in the same category."); }
  else if (s("adjacent_retail")) { partner += 0.05; notes.partner.push("+ Runs/ran a shop."); }
  if (s("multi_unit_operator")) { partner += 0.08; notes.partner.push("+ Has run franchise/multiple outlets."); }
  if (s("owner_not_operator") && !app.extra.ownerOperatorConfirmed) { partner -= 0.15; notes.partner.push("− May not run the store personally."); }
  if (s("funding_conditional") && app.extra.financing !== "sanctioned") { partner -= 0.08; notes.partner.push("− Funding depends on a loan/event."); }
  partner = clamp(partner);

  // Premises: readiness of the site.
  let premises = { Owned: 1, Rented: 0.85, "Not yet identified": 0.4 }[app.space ?? "Not yet identified"] ?? 0.3;
  if (app.space) notes.premises.push(`${app.space} space.`);
  if (app.space === "Owned" || app.space === "Rented") {
    const fl = app.floor ?? "Not known";
    premises *= { Ground: 1, "Mall unit": 0.95, "Not known": 0.8, Upper: 0.3 }[fl];
    notes.premises.push(`Floor: ${fl}.`);
    if (size !== null) {
      premises *= size < config.minSqft ? 0.4 : size < config.tightSqft ? 0.85 : size > config.maxSqft ? 0.85 : 1;
      notes.premises.push(`${size} sq ft.`);
    } else premises *= 0.8;
  }
  premises = clamp(premises);

  // Place: how much the brand wants this territory now.
  let placeS = 0;
  if (territory && place === "own_pin") {
    placeS = PRIORITY_SCORE[territory.priority ?? "Low"];
    notes.place.push(`${territory.id} is ${territory.priority ?? "unrated"} priority.`);
  } else if (place === "needs_redirect") {
    placeS = 0.3;
    notes.place.push("Wanted pin is not available — would need a different pin.");
  } else notes.place.push("No open territory for this pin.");

  // Pace: realistic and committed timeline.
  let pace = 0.7;
  const t = app.targetMonths;
  if (t === null) notes.pace.push("No target given.");
  else if (t < feasible) { pace = 0.6; notes.pace.push(`Target ${t} mo is faster than possible (${feasible} mo).`); }
  else if (t <= feasible + 3) { pace = 1; notes.pace.push(`Target ${t} mo is realistic.`); }
  else if (t <= 12) { pace = 0.8; notes.pace.push(`Target ${t} mo — slower than needed.`); }
  else { pace = 0.5; notes.pace.push(`Target ${t} mo — long wait.`); }

  const w = config.weights;
  const sum = w.partner + w.premises + w.place + w.pace || 1;
  const total = Math.round(((w.partner * partner + w.premises * premises + w.place * placeS + w.pace * pace) / sum) * 1000) / 10;
  return { partner, premises, place: placeS, pace, total, notes };
}
