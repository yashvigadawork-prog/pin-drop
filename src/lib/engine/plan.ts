import { DEFAULT_STORES, roadKm } from "./config";
import { festivalMonths, hasSignal } from "./signals";
import type { Application, City, ExistingStore, Language, OnboardingPlan, PlanStep, Signal, TrainingPlan } from "./types";

// The opening timeline is built from the actual steps a store goes through, so
// "earliest realistic opening" is the length of this critical path, not a guess.

export const WEEKS_PER_MONTH = 4.33;

export interface PathInput {
  siteReady: boolean; // has an identified space we can audit now
  financingInProgress: boolean;
}

export function criticalPathWeeks({ siteReady, financingInProgress }: PathInput) {
  const loi = 1;
  const docs = 2; // KYC + proof of funds, runs from week 0
  const siteEnd = siteReady ? loi + 1 : loi + 8 + 1; // audit only, or search + audit
  const loanEnd = financingInProgress ? 6 : 0;
  const agreementStart = Math.max(docs, siteEnd, loanEnd);
  const fitoutStart = agreementStart + 1;
  const fitout = 6;
  const prep = 1;
  const buffer = 2; // contingency: franchisors routinely under-estimate opening time
  return { agreementStart, fitoutStart, fitout, openWeek: fitoutStart + fitout + prep + buffer, siteEnd };
}

export function feasibleMonths(p: PathInput) {
  return Math.ceil(criticalPathWeeks(p).openWeek / WEEKS_PER_MONTH);
}

export function pickMentorStore(city: City, stores: ExistingStore[] = DEFAULT_STORES): TrainingPlan["mentorStore"] {
  const inCity = stores.filter((s) => s.city === city).sort((a, b) => a.opened - b.opened);
  if (inCity.length) {
    const s = inCity[0];
    return { ...s, distanceKm: 0, why: `Oldest store in ${city} (open since ${s.opened}) — most experienced team to shadow.` };
  }
  const ranked = [...stores].sort((a, b) => roadKm(city, a.city) - roadKm(city, b.city) || a.opened - b.opened);
  const s = ranked[0];
  return { ...s, distanceKm: roadKm(city, s.city), why: `${city} has no store yet; ${s.city} is the nearest city with one (~${roadKm(city, s.city)} km by road).` };
}

export function buildPlan(opts: {
  app: Application;
  city: City;
  pin: string;
  redirected: boolean;
  signals: Signal[];
  today: Date;
  stores: ExistingStore[];
  conditions: string[];
}): OnboardingPlan {
  const { app, signals, today } = opts;
  const siteReady = !opts.redirected && (app.space === "Owned" || app.space === "Rented");
  const financingInProgress = app.extra.financing === "applied";
  const path = criticalPathWeeks({ siteReady, financingInProgress });
  const feasible = Math.ceil(path.openWeek / WEEKS_PER_MONTH);

  let openWeek = path.openWeek;
  if (app.targetMonths && app.targetMonths > feasible) openWeek = Math.round(app.targetMonths * WEEKS_PER_MONTH);
  const fest = hasSignal(signals, "festival_deadline");
  const fm = festivalMonths(fest);
  const conditions = [...opts.conditions];
  if (fm !== null) {
    const festWeek = Math.floor(fm * WEEKS_PER_MONTH) - 2;
    if (festWeek >= path.openWeek) {
      openWeek = Math.min(openWeek, festWeek);
      conditions.push(`Timed to open ~2 weeks before ${String(fest!.value).split(" (")[0]}, as the applicant asked.`);
    }
  }
  const slack = openWeek - path.openWeek; // extra weeks we can spread work across
  const fitoutStart = path.fitoutStart + slack;

  const steps: PlanStep[] = [
    { week: 0, weeks: 1, title: "Owner sign-off & Letter of Intent", owner: "Owner", detail: "Expansion head reviews this recommendation and issues an LOI reserving the pin for 30 days." },
    { week: 0, weeks: 2, title: "Documents & proof of funds", owner: "Partner", detail: "PAN, Aadhaar, 6-month bank statements or FD certificates covering the investment, GST registration (or application)." },
  ];
  if (financingInProgress) steps.push({ week: 0, weeks: 6, title: "Loan sanction", owner: "Partner", detail: "Complete the bank loan (e.g. PM Mudra / CGTMSE-backed). Agreement is signed only after the sanction letter." });
  if (siteReady) {
    steps.push({ week: 1, weeks: 1, title: "Site audit", owner: "Expansion team", detail: `Visit pin ${opts.pin}: confirm floor, measure carpet area (≥250 sq ft), frontage, signage visibility, footfall count at peak hours.` });
  } else {
    steps.push({
      week: 1,
      weeks: 8,
      title: opts.redirected ? `Find a site in pin ${opts.pin}` : "Site search",
      owner: "Partner",
      detail: "Shortlist 2–3 ground-floor or mall units of 250–500 sq ft on a high-footfall road; expansion team shares the site checklist and approves the final pick.",
    });
    steps.push({ week: 9, weeks: 1, title: "Site audit", owner: "Expansion team", detail: "Audit the chosen site against the checklist before any rent is committed." });
  }
  steps.push(
    { week: Math.max(1, path.agreementStart + slack - 1), weeks: 1, title: "Talk to an existing partner", owner: "Partner", detail: "Validation call/visit with the mentor store partner before signing — the IFA advises every prospective franchisee to speak to current partners." },
    { week: path.agreementStart + slack, weeks: 1, title: "Franchise agreement & fee", owner: "Partner", detail: "Sign the agreement, pay the franchise fee, lock the pin in the network map." },
    { week: path.agreementStart + slack, weeks: 3, title: "Licences", owner: "Partner", detail: "Karnataka Shops & Commercial Establishments registration, trade licence from the city corporation, signage permission (name board at least 60% Kannada, per the 2024 Karnataka amendment)." },
    { week: fitoutStart, weeks: 6, title: "Fit-out to brand design", owner: "Expansion team", detail: "Brand-approved contractor builds the store to the standard layout; weekly photo check-ins." },
    { week: fitoutStart + 2, weeks: 3, title: "Hire store staff", owner: "Partner", detail: "2–3 staff, at least one fluent in Kannada for walk-in customers." },
    { week: Math.max(fitoutStart + 2, openWeek - 4), weeks: 3, title: "Training", owner: "Training team", detail: "Classroom modules + shadowing at the mentor store (see training plan)." },
    { week: openWeek - 1, weeks: 1, title: "Stock, POS & soft launch", owner: "Expansion team", detail: "Opening inventory, POS and online-order integration, 2-day soft launch with friends & family." },
    { week: openWeek, weeks: 1, title: "Store opens", owner: "Partner", detail: "Launch with local-language marketing in the catchment." },
    { week: openWeek + 4, weeks: 9, title: "30 / 60 / 90-day reviews", owner: "Expansion team", detail: "Sales vs plan, customer ratings, stock health; extra coaching if below plan." },
  );
  steps.sort((a, b) => a.week - b.week);

  const opened = new Date(today.getTime() + openWeek * 7 * 24 * 3600 * 1000);
  return {
    feasibleMonths: feasible,
    targetMonths: app.targetMonths,
    plannedOpen: opened.toISOString().slice(0, 10),
    steps,
    training: buildTraining(app, opts.city, signals, opts.stores),
    conditions,
    payback: null,
  };
}

export function buildTraining(app: Application, city: City, signals: Signal[], stores: ExistingStore[]): TrainingPlan {
  const exp = app.experience ?? 0;
  const retailInText = hasSignal(signals, "relevant_retail") || hasSignal(signals, "adjacent_retail");
  const extended = exp < 2 && !retailInText;
  let languages: Language[] = app.languages.length ? app.languages : ["Kannada", "English"];
  let languageNote: string | undefined;
  if (!app.languages.length) languageNote = "No language given — planned bilingual Kannada + English; confirm with the partner.";
  if (languages.length > 1 && !languageNote) languageNote = `Partner asked for ${languages.join(" + ")} — material in the first, trainer fluent in both.`;
  languages = languages.slice(0, 2);
  const modules = [
    { name: "Brand, products & customer journey", days: 2, mode: "Classroom / live virtual" },
    { name: "Consultative selling & after-sales service", days: 2, mode: "Classroom + role-play" },
    { name: "POS, inventory & online-order fulfilment", days: 2, mode: "Hands-on, on the POS" },
    { name: "Visual merchandising & store standards", days: 1, mode: "At mentor store" },
    { name: "Local marketing & opening plan", days: 1, mode: "Workshop with expansion manager" },
    { name: "Compliance, cash handling & safety", days: 1, mode: "Classroom" },
  ];
  if (extended) modules.unshift({ name: "Retail fundamentals: store P&L, staffing, shrinkage", days: 3, mode: "Classroom" });
  if (hasSignal(signals, "owner_not_operator") && !app.extra.ownerOperatorConfirmed)
    modules.push({ name: "Owner track: reading the store P&L, weekly review with manager", days: 1, mode: "Virtual" });
  return {
    languages,
    languageNote,
    mentorStore: pickMentorStore(city, stores),
    modules,
    shadowDays: extended ? 10 : 5,
    extended,
  };
}
