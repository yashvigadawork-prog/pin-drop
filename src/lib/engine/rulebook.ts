import evidence from "@/data/evidence.json";

// Every rule the engine applies, the first-principles reason for it, and the real
// companies / regulators whose practice it mirrors. Shown in the app's Rulebook tab and
// linked from every issue, so any decision can be traced to a source.

export interface EvidenceCard {
  id: string;
  topic: string;
  company_or_body: string;
  claim: string;
  figure: string | null;
  source_title: string;
  url: string;
  confidence: "high" | "medium" | "low";
  how_we_use: string;
}

export const EVIDENCE = evidence as EvidenceCard[];
export const evidenceById = (id: string) => EVIDENCE.find((e) => e.id === id);

// Two or three lines at most. The full rule, the reason and the evidence sit behind "Details".
export const BRIEF: Record<string, string> = {
  "owner-decides": "The engine recommends. You decide. A pin you confirm is never taken away by a later re-run.",
  "data-integrity": "Missing or conflicting facts never cause a rejection. They become a question for the applicant.",
  "one-store-per-pin": "One store per pin code. If two people want one pin, the stronger one gets it. The other is offered a free pin or waitlisted.",
  "territory-plan": "We only open in planned territories. The free pins in a territory are the real limit on its slots.",
  capital: "Each city tier has a minimum investment. More headroom scores higher.",
  financing: "Up to 15% short counts as financing probable. We ask how they will cover the gap. A sanctioned loan clears it.",
  "owner-operator": "Someone named must run the store full-time. If it sounds like they will not, we flag it and ask who will.",
  experience: "More retail experience scores higher. No experience is fine, but adds extra training.",
  space: "Space must be at least 250 sq ft, ideally 300 to 500. Smaller goes on hold until they find a bigger site.",
  floor: "Ground floor or mall unit only. An upper floor goes on hold until they find a better space.",
  timeline: "We plan the real earliest opening, not the hoped-for date. Faster targets are flagged.",
  training: "Training is in the partner's language, at a real store. First-time operators get extra training.",
  payback: "Payback is shown for information only. It never changes the ranking.",
  tiers: "Qualified applicants are ranked by score. The top 10% are Tier A, the next 30% Tier B, the rest Tier C.",
  challenger: "If someone loses their pin but beats a neighbouring pin's holder by 10+ points, we flag that pin as an extra offer. You decide.",
  custom: "Assumptions you add apply on the next re-decide. A miss can ask a question, flag, or stop the application. Your choice.",
};

export interface Rule {
  id: string;
  gate: "Application" | "Place" | "Partner" | "Premises" | "Pace" | "Readiness" | "Governance";
  title: string;
  rule: string;
  why: string; // first principles
  assumption?: string; // what we assumed and how we'd check it
  evidence: string[];
}

export const RULES: Rule[] = [
  {
    id: "tiers",
    gate: "Governance",
    title: "Tiers A, B and C show who stands out",
    rule: "Everyone who passes every check is ranked by score. The top share (default 10%) is Tier A, the next share (default up to 40%) is Tier B, and the rest are Tier C. Tiers only label. They never change a decision or a slot.",
    why: "When most applicants are good, scores bunch together and the raw number stops separating people. Rank does. A short tier label tells the owner where to look first, at any pool size.",
    assumption: "The 10% and 40% cut-offs are assumptions. Change them in Assumptions.",
    evidence: [],
  },
  {
    id: "challenger",
    gate: "Place",
    title: "A strong loser may also be offered a neighbouring pin",
    rule: "When an applicant loses their own pin to a stronger applicant, we compare their score with the holders of the other pins in the same territory. If they beat a holder by the challenger margin (default 10 points), that pin is flagged as an extra offer. Nobody is moved until the owner confirms.",
    why: "Slots are scarce and strong partners are rarer than slots. A partner who narrowly lost one pin should not be lost altogether when a neighbouring pin is held by someone clearly weaker.",
    assumption: "The 10-point margin is an assumption. Change it in Assumptions.",
    evidence: [],
  },
  {
    id: "custom",
    gate: "Governance",
    title: "Assumptions you add",
    rule: "Owner-added assumptions test one number from the application (investment, experience, space size or target months). A miss either asks a question, adds a flag, or stops the application, as you choose.",
    why: "Every threshold is a judgment. The owner should be able to test a different one without waiting for a software change.",
    evidence: [],
  },
  {
    id: "owner-decides",
    gate: "Governance",
    title: "The engine recommends; the owner decides",
    rule: "Every outcome is a recommendation. The expansion owner confirms or overrides it with a written reason, and confirmed slots are never displaced by later reruns.",
    why: "Selecting a partner is a multi-year relationship and a large investment for the partner. Accountability has to sit with a person; the engine's job is to read, check, rank and explain consistently.",
    evidence: ["india-no-franchise-disclosure-law", "lenskart-franchisee-encroachment-allegations"],
  },
  {
    id: "data-integrity",
    gate: "Application",
    title: "Contradictions become questions, never silent rejections",
    rule: "Missing or contradictory facts (pin vs city, space vs size, floor vs notes) put the applicant on Hold with the exact question to ask.",
    why: "You can't judge a partner on facts you can't trust, and a typo shouldn't cost a good partner their slot. India has no franchise disclosure law, so the brand has to run its own diligence.",
    evidence: ["india-no-franchise-disclosure-law", "ifa-diligence-validation-calls", "ftc-item20-outlets-contacts"],
  },
  {
    id: "one-store-per-pin",
    gate: "Place",
    title: "Never two stores in one pin code",
    rule: "A pin that already has a store (Sheet 3) or that has been allocated in this run is closed. Competing applicants for the same pin are ranked; the others are offered a free pin or waitlisted.",
    why: "A new store that eats an existing partner's sales destroys trust in the whole network. Postal codes give a precise, auditable boundary.",
    evidence: ["dominos-exclusive-area-fortressing", "ifa-encroachment-radius", "azoulay-shane-exclusive-territories", "lenskart-franchisee-encroachment-allegations"],
  },
  {
    id: "territory-plan",
    gate: "Place",
    title: "Grow only where the brand has planned to grow",
    rule: "Applicants are matched to territories by pin. Real capacity = the lower of open slots and free pins. Pins outside every territory get a redirect offer if the city has one; cities with no territory are kept in the pipeline.",
    why: "Slots and priorities encode the brand's supply chain, marketing and supervision plans; opening outside them spreads support thin.",
    evidence: ["ftc-item12-territory", "ifa-encroachment-radius"],
  },
  {
    id: "capital",
    gate: "Partner",
    title: "Enough capital for the city tier, with headroom",
    rule: "Minimum investment by tier (default Tier 1 ₹35L, Tier 2 ₹25L, Tier 3 ₹15L). More headroom scores higher. Funds that depend on a loan or a future event are flagged, and other funds count only once proof is shared.",
    why: "Running out of cash is how small stores die: the median US retailer holds only 19 days of cash, and only ~60% of retail outlets survive five years. Disclosure rules require a working-capital buffer for the first months.",
    assumption: "Tier 2 = ₹25L because the template's own example applicant invests ₹25L in a Tier 2 city. Tier 3 follows Lenskart's own ratio (₹35L tier-2 store vs ₹20L 'Lite' tier-3/4 ≈ 0.57×), and Tier 1 is higher for metro rent and deposits. Check: compare against actual fit-out + deposit + 3 months' opex of the last 10 stores.",
    evidence: ["lenskart-tier-investment", "titan-eyeplus-investment", "ftc-item7-additional-funds", "jpmc-cash-buffer-days", "bls-retail-survival", "mcdonalds-nonborrowed-750k"],
  },
  {
    id: "financing",
    gate: "Partner",
    title: "Within 15% short = financing probable, not rejected",
    rule: "Applicants up to 15% below the tier minimum go on Hold as 'financing probable'. We ask for other committed funds (FDs, a co-investor) or a loan for the gap. A sanctioned loan or proven extra funds clears the hold automatically.",
    why: "A small gap is bridgeable through government-backed schemes, but a loan is not cash in hand. Strong franchisors count only non-borrowed funds, so the gap must be closed before the agreement, not assumed.",
    assumption: "The 15% band roughly matches what a Mudra Tarun/Tarun Plus or CGTMSE-backed loan covers on a ₹15–35L store. Check: track how many 'financing probable' partners actually close their gap within 6 weeks.",
    evidence: ["pmmy-mudra-categories", "cgtmse-ceiling", "standup-india", "chickfila-nonborrowed-fee", "mcdonalds-nonborrowed-750k"],
  },
  {
    id: "owner-operator",
    gate: "Partner",
    title: "Someone named must run the store full-time",
    rule: "When the applicant's own words suggest they won't run the store (NRI, 'my son will run it', 'will hire a manager'), we don't reject. We flag it, lower the partner score and require a named full-time operator who completes the full training.",
    why: "A store whose owner is not there every day is harder to hold to standards, and the strongest franchise systems refuse passive investors outright.",
    evidence: ["chickfila-full-time-operator", "apollo-clinic-full-time", "mcdonalds-nonborrowed-750k"],
  },
  {
    id: "experience",
    gate: "Partner",
    title: "Experience raises the score; lack of it adds training",
    rule: "Years running a shop score up to 8 years. Same-category retail (optical/eyewear) and multi-outlet operators get a bonus. Zero experience is not a blocker: it triggers the extended training track and double shadowing.",
    why: "Operators who have run a shop ramp up faster, but a franchise system exists to teach the model. Excluding first-timers would shrink the funnel in Tier 2/3 cities.",
    evidence: ["dominos-one-year-store-management", "chickfila-experience-leadership", "titan-eyeplus-investment"],
  },
  {
    id: "space",
    gate: "Premises",
    title: "At least 250 sq ft, ideally 300–500",
    rule: "Spaces under 250 sq ft go on Hold (find a bigger site). 250–300 is accepted but flagged as tight. Very large spaces are flagged for rent burden. With no space yet, a site search is built into the plan.",
    why: "The format needs room for display, a consultation area and stock. Too big and rent eats the payback.",
    assumption: "Our 250–500 sq ft band is an assumption for a compact eyewear-style format (third-party Lenskart figures conflict). Check: the floor area of the brand's 10 existing stores vs their sales per sq ft.",
    evidence: ["wellness-forever-site-criteria", "lenskart-space-unofficial"],
  },
  {
    id: "floor",
    gate: "Premises",
    title: "Ground floor or mall unit only",
    rule: "Upper-floor spaces go on Hold until the partner finds a ground-floor or mall space. An unknown floor becomes a site-audit condition. A floor contradicted by the applicant's own notes is a question.",
    why: "Walk-in retail lives on street visibility. Property valuers treat the front, street-level zone as the most valuable and upstairs space separately, and shopper visits fall with every floor.",
    evidence: ["apollo-clinic-ground-floor", "voa-zoning-zone-a", "mall-floor-visits-study"],
  },
  {
    id: "timeline",
    gate: "Pace",
    title: "Plan the real critical path, not the hoped-for date",
    rule: "Earliest opening = LOI → documents → site audit (or 8-week site search) → agreement → 6-week fit-out → stock → 2-week buffer. A target faster than this is flagged and the plan uses the realistic date. Festival deadlines (e.g. Diwali) are checked against the calendar.",
    why: "Over-promised opening dates are a known failure: one fitness franchisor disclosed 3–6 months while franchisees averaged 13+, and paid a settlement.",
    evidence: ["xponential-ny-ag-timeline", "apollo-clinic-launch-timeline"],
  },
  {
    id: "training",
    gate: "Readiness",
    title: "Train in the partner's language, at a real store",
    rule: "Training runs in the preferred language (default Kannada + English), with shadowing at the oldest store in the same city, or the nearest city that has one. Extended track for first-time operators. Signboards follow Karnataka's 60% Kannada rule.",
    why: "People learn operations fastest in their own language, at a working store. Large systems teach in dozens of languages, and Karnataka-focused programmes use Kannada.",
    evidence: ["mcdonalds-training-languages", "amazon-kannada-seller-support", "karnataka-kannada-signboards", "apollo-clinic-launch-timeline"],
  },
  {
    id: "payback",
    gate: "Readiness",
    title: "Indicative payback shown, never used to rank",
    rule: "Payback ≈ tier investment ÷ (indicative monthly sales × 16% net). It's for the partner conversation only.",
    why: "Partners decide on payback, but a single store's sales depend on site factors we don't have in this file.",
    assumption: "Monthly sales of ₹12L / ₹9L / ₹5L by tier with a 16% net margin backed out of Lenskart's own tier-2 figures (₹35L store, ₹8–10L monthly sales, about 2-year breakeven). Check: the last 10 stores' monthly P&L.",
    evidence: ["lenskart-tier-investment", "lenskart-coco-payback"],
  },
];

export const ruleById = (id?: string) => RULES.find((r) => r.id === id);
