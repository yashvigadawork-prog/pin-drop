import { DEFAULT_CONFIG, PRIORITY_SCORE } from "./config";
import { evaluate, relocationScore, type Ctx, type Evaluation } from "./evaluate";
import { buildPlan } from "./plan";
import type {
  Allocation,
  Challenge,
  Change,
  Competition,
  Decision,
  EngineConfig,
  EngineInput,
  EngineResult,
  OwnerAction,
  Signal,
  ScoreBreakdown,
  Status,
  TerritoryView,
} from "./types";

export interface RunOptions {
  today?: Date;
  owner?: OwnerAction[];
  aiSignals?: Record<string, Signal[]>;
}

const STATUS_WORD: Record<Status, string> = {
  ADVANCE: "Advance",
  HOLD: "Hold",
  WAITLIST: "Waitlist",
  REDIRECT: "Redirect",
  NOT_NOW: "Not now",
  WITHDRAWN: "Withdrawn",
};
export const statusWord = (s: Status) => STATUS_WORD[s];

interface Slot {
  view: TerritoryView;
  used: number;
}

export function runEngine(input: EngineInput, config: EngineConfig = DEFAULT_CONFIG, opts: RunOptions = {}): EngineResult {
  const today = opts.today ?? new Date();
  const duplicates = new Map<string, string>();
  const firstSeen = new Map<string, string>();
  for (const a of input.applications) {
    const key = `${a.name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")}|${a.pin ?? a.pinRaw}`;
    if (!a.name.trim()) continue;
    if (firstSeen.has(key)) duplicates.set(a.id, firstSeen.get(key)!);
    else firstSeen.set(key, a.id);
  }
  const ctx: Ctx = { territories: input.territories, stores: input.stores, config, today, aiSignals: opts.aiSignals, duplicates };
  const evals = new Map<string, Evaluation>();
  for (const app of input.applications) evals.set(app.id, evaluate(app, ctx));

  // ---- territory capacity: open slots, minus pins that already have a store ----
  const storePins = new Map(input.stores.map((s) => [s.pin, s.id]));
  const slots = new Map<string, Slot>();
  for (const t of input.territories) {
    const blockedPins = t.pins.filter((p) => storePins.has(p)).map((p) => ({ pin: p, storeId: storePins.get(p)! }));
    const freePins = t.pins.filter((p) => !storePins.has(p));
    const issues: string[] = [];
    if (blockedPins.length) issues.push(`Pin${blockedPins.length > 1 ? "s" : ""} ${blockedPins.map((b) => `${b.pin} (${b.storeId})`).join(", ")} already ha${blockedPins.length > 1 ? "ve" : "s"} a store — excluded.`);
    if (t.slots > freePins.length) issues.push(`${t.slots} open slots but only ${freePins.length} free pin${freePins.length === 1 ? "" : "s"} — real capacity is ${freePins.length}.`);
    slots.set(t.id, {
      used: 0,
      view: { territory: t, freePins, blockedPins, capacity: Math.min(t.slots, freePins.length), allocated: [], contenders: [], issues },
    });
  }
  const takenPins = new Map<string, string>(); // pin -> app id
  const relocation = new Map<string, ScoreBreakdown>(); // score for opening in a pin they did not apply for
  const result = new Map<string, { status: Status; allocation: Allocation | null; competition: Competition | null; owner?: OwnerAction; extraNotes: string[] }>();

  const take = (appId: string, territoryId: string, pin: string, kind: Allocation["kind"], locked: boolean): Allocation | null => {
    const s = slots.get(territoryId);
    if (!s || s.used >= s.view.capacity || takenPins.has(pin) || storePins.has(pin) || !s.view.freePins.includes(pin)) return null;
    s.used++;
    takenPins.set(pin, appId);
    s.view.allocated.push({ appId, pin, kind, locked });
    return { territoryId, pin, kind, locked };
  };

  // ---- 1. withdrawals and owner decisions come first: humans have the final word ----
  const lastAction = new Map<string, OwnerAction>();
  for (const a of opts.owner ?? []) lastAction.set(a.appId, a);
  for (const [id, ev] of evals) {
    if (ev.app.extra.withdrawn) {
      result.set(id, { status: "WITHDRAWN", allocation: null, competition: null, extraNotes: [] });
      continue;
    }
    const act = lastAction.get(id);
    if (!act) continue;
    if (act.action === "confirm" && act.allocation) {
      const alloc = take(id, act.allocation.territoryId, act.allocation.pin, act.allocation.kind, true);
      if (alloc) {
        if (alloc.kind === "redirect") relocation.set(id, relocationScore(ev, config));
        result.set(id, { status: alloc.kind === "redirect" ? "REDIRECT" : "ADVANCE", allocation: alloc, competition: null, owner: act, extraNotes: [] });
      }
    } else if (act.action === "confirm") {
      // Confirming a non-allocating recommendation is recorded but does not freeze it.
    } else if (act.action === "override" && act.status) {
      if (act.status === "ADVANCE") {
        let alloc: Allocation | null = null;
        if (ev.territory && ev.app.pin) alloc = take(id, ev.territory.id, ev.app.pin, "own_pin", true);
        result.set(id, { status: "ADVANCE", allocation: alloc, competition: null, owner: act, extraNotes: alloc ? [] : ["Owner advanced this applicant, but their pin has no free slot — needs a manual pin decision."] });
      } else result.set(id, { status: act.status, allocation: null, competition: null, owner: act, extraNotes: [] });
    }
  }

  // ---- 2. sort everyone else into: not now / hold / competing for own pin / needs another pin ----
  const competing: Evaluation[] = [];
  const redirectPool: { ev: Evaluation; reason: "pin_taken" | "capacity" | "place" }[] = [];
  for (const [id, ev] of evals) {
    if (result.has(id)) continue;
    if (ev.hardBlocks.length) result.set(id, { status: "NOT_NOW", allocation: null, competition: null, extraNotes: [] });
    else if (ev.holdBlocks.length) result.set(id, { status: "HOLD", allocation: null, competition: null, extraNotes: [] });
    else if (ev.place === "own_pin") competing.push(ev);
    else if (ev.place === "needs_redirect") redirectPool.push({ ev, reason: "place" });
    else result.set(id, { status: "HOLD", allocation: null, competition: null, extraNotes: [] });
  }

  // ---- 3. one queue, best score first ----
  // Slots are the scarce asset, so they go to the strongest partners. Someone who can't use
  // the pin they applied for re-enters the queue with a relocation score (needs a new site,
  // and may decline the move), so moving a partner is never "free".
  // Pins that other applicants applied for (including those on hold) are offered last,
  // so a redirect never quietly takes someone else's chosen location.
  const claimed = new Set<string>();
  for (const ev of evals.values()) if (ev.app.pin && !ev.app.extra.withdrawn && !ev.hardBlocks.length) claimed.add(ev.app.pin);
  for (const ev of competing) slots.get(ev.territory!.id)!.view.contenders.push(ev.app.id);

  type Q = { ev: Evaluation; score: number; mode: "own" | "move"; reason: "pin_taken" | "capacity" | "place" };
  const queue: Q[] = [
    ...competing.map((ev) => ({ ev, score: ev.score.total, mode: "own" as const, reason: "place" as const })),
    ...redirectPool.map(({ ev, reason }) => {
      const rs = relocationScore(ev, config);
      relocation.set(ev.app.id, rs);
      return { ev, score: rs.total, mode: "move" as const, reason };
    }),
  ];
  const order = (a: Q, b: Q) => b.score - a.score || a.ev.app.rowNumber - b.ev.app.rowNumber;
  queue.sort(order);
  while (queue.length) {
    const q = queue.shift()!;
    const { ev } = q;
    if (q.mode === "own") {
      const alloc = take(ev.app.id, ev.territory!.id, ev.app.pin!, "own_pin", false);
      if (alloc) {
        result.set(ev.app.id, { status: "ADVANCE", allocation: alloc, competition: null, extraNotes: [] });
        continue;
      }
      const rs = relocationScore(ev, config);
      relocation.set(ev.app.id, rs);
      const next: Q = { ev, score: rs.total, mode: "move", reason: takenPins.has(ev.app.pin!) ? "pin_taken" : "capacity" };
      const at = queue.findIndex((x) => order(next, x) < 0);
      queue.splice(at < 0 ? queue.length : at, 0, next);
      continue;
    }
    const options = [...slots.values()]
      .filter((s) => s.view.territory.city === ev.app.city && s.used < s.view.capacity)
      .sort(
        (a, b) =>
          Number(b.view.territory.id === ev.territory?.id) - Number(a.view.territory.id === ev.territory?.id) ||
          PRIORITY_SCORE[b.view.territory.priority ?? "Low"] - PRIORITY_SCORE[a.view.territory.priority ?? "Low"],
      );
    let alloc: Allocation | null = null;
    for (const pass of [true, false]) {
      for (const s of options) {
        const pin = s.view.freePins.find((p) => !takenPins.has(p) && (pass ? !claimed.has(p) : true));
        if (pin) alloc = take(ev.app.id, s.view.territory.id, pin, "redirect", false);
        if (alloc) break;
      }
      if (alloc) break;
    }
    result.set(ev.app.id, { status: alloc ? "REDIRECT" : "WAITLIST", allocation: alloc, competition: null, extraNotes: [q.reason] });
  }

  // ---- 5. competition context for every applicant tied to a territory ----
  const moved = (id: string) => result.get(id)?.allocation?.kind === "redirect" || (result.get(id)?.status === "WAITLIST" && relocation.has(id));
  const scoreOf = (id: string) => (moved(id) ? relocation.get(id)!.total : evals.get(id)!.score.total);
  for (const [id, r] of result) {
    const ev = evals.get(id)!;
    const t = ev.territory;
    if (!t) continue;
    const s = slots.get(t.id)!;
    const pool = s.view.contenders.slice();
    if (!pool.includes(id)) pool.push(id);
    pool.sort((a, b) => scoreOf(b) - scoreOf(a) || evals.get(a)!.app.rowNumber - evals.get(b)!.app.rowNumber);
    const rank = pool.indexOf(id) + 1;
    const comp: Competition = { territoryId: t.id, rank, contenders: pool.length, capacity: s.view.capacity };
    if (r.status === "WAITLIST" || r.status === "REDIRECT") {
      comp.beatenBy = s.view.allocated.filter((a) => a.appId !== id && scoreOf(a.appId) >= scoreOf(id)).map((a) => ({ id: a.appId, score: scoreOf(a.appId) }));
      const rival = ev.app.pin ? takenPins.get(ev.app.pin) : undefined;
      if (rival && rival !== id) comp.samePinRivals = [rival];
    }
    if (r.status === "HOLD") comp.wouldRank = rank;
    r.competition = comp;
  }

  // ---- 5b. challengers ----
  // A strong applicant who lost their own pin to someone better may also be strong enough for
  // a neighbouring pin in the same territory. If they beat that pin's holder by the margin, we
  // flag it. Nobody is moved: the owner decides.
  const margin = config.challengeMargin ?? 10;
  const challenges = new Map<string, Challenge[]>();
  for (const [id, r] of result) {
    const ev = evals.get(id)!;
    if (!ev.territory || ev.place !== "own_pin" || ev.hardBlocks.length || ev.holdBlocks.length) continue;
    if (!(r.status === "WAITLIST" || r.status === "REDIRECT") || !r.extraNotes.includes("pin_taken")) continue;
    const mine = ev.score.total;
    const list: Challenge[] = [];
    for (const a of slots.get(ev.territory.id)!.view.allocated) {
      if (a.appId === id || a.locked || a.kind !== "own_pin" || a.pin === ev.app.pin) continue;
      const theirs = evals.get(a.appId)!.score.total;
      if (mine - theirs >= margin) list.push({ pin: a.pin, territoryId: ev.territory.id, vsId: a.appId, vsName: evals.get(a.appId)!.app.name, vsScore: theirs, myScore: mine, margin: mine - theirs });
    }
    if (list.length) challenges.set(id, list.sort((x, y) => y.margin - x.margin));
  }

  // ---- 6. build decisions ----
  const decisions: Record<string, Decision> = {};
  for (const [id, ev] of evals) {
    const r = result.get(id)!;
    decisions[id] = buildDecision(ev, r.status, r.allocation, r.competition, r.owner, r.extraNotes, { today, config, input, slots, evals }, moved(id) ? relocation.get(id) : undefined);
    if (challenges.has(id)) decisions[id].challenges = challenges.get(id);
  }
  const counts = { ADVANCE: 0, HOLD: 0, WAITLIST: 0, REDIRECT: 0, NOT_NOW: 0, WITHDRAWN: 0 } as Record<Status, number>;
  for (const d of Object.values(decisions)) counts[d.status]++;
  return {
    runAt: today.toISOString(),
    config,
    decisions,
    order: input.applications.map((a) => a.id),
    territories: [...slots.values()].map((s) => s.view),
    health: input.health,
    counts,
  };
}

// ---------------------------------------------------------------------------

interface BuildCtx {
  today: Date;
  config: EngineConfig;
  input: EngineInput;
  slots: Map<string, Slot>;
  evals: Map<string, Evaluation>;
}

function buildDecision(
  ev: Evaluation,
  status: Status,
  allocation: Allocation | null,
  competition: Competition | null,
  owner: OwnerAction | undefined,
  extraNotes: string[],
  b: BuildCtx,
  relocated?: ScoreBreakdown,
): Decision {
  const app = ev.app;
  const warns = ev.issues.filter((i) => i.severity === "warn");
  const conditions = [...ev.conditions, ...warns.filter((w) => w.fix).map((w) => w.fix!)];
  let plan = null;
  if ((status === "ADVANCE" || status === "REDIRECT") && allocation && app.city) {
    plan = buildPlan({ app, city: app.city, pin: allocation.pin, redirected: allocation.kind === "redirect", signals: ev.signals, today: b.today, stores: b.input.stores, conditions });
    const tier = b.slots.get(allocation.territoryId)?.view.territory.tier;
    if (tier) {
      const cfg = b.config;
      const inv = cfg.minCapital[tier];
      const monthlyNet = Math.round(cfg.monthlyRevenue[tier] * cfg.netMargin * 100) / 100;
      plan.payback = { months: Math.round(inv / monthlyNet), investment: inv, monthlyNet, tier };
    }
  }
  const name = app.name || app.id;
  const score = relocated ?? ev.score;
  const sc = score.total.toFixed(0);
  const ownSc = ev.score.total.toFixed(0);
  let headline = "";
  let explanation = "";
  const nextSteps: string[] = [];
  const t = allocation ? b.slots.get(allocation.territoryId)!.view.territory : ev.territory;
  const reasonLines = (list: typeof ev.issues) => list.map((i) => i.message).join(" ");

  switch (status) {
    case "WITHDRAWN":
      headline = `${name} has withdrawn.`;
      explanation = `${name} is no longer in the running, so any slot they held has been released to the next applicant.`;
      break;
    case "ADVANCE": {
      headline = `Recommend advancing ${name} for pin ${allocation?.pin ?? app.pin} in ${t?.id ?? "their territory"}.`;
      const comp = competition && competition.contenders > 1 ? ` They rank #${competition.rank} of ${competition.contenders} applicants for ${competition.territoryId} (${competition.capacity} slot${competition.capacity === 1 ? "" : "s"}).` : "";
      explanation = `${name} clears all five checks: the pin is inside ${t?.id} (${t?.priority} priority) with no existing store in that pin, ₹${ev.effectiveCapital}L covers the ₹${ev.requiredCapital}L needed for a ${t?.tier} city, and the space ${app.space === "Not yet identified" ? "still has to be found, which is built into the plan" : "meets the format"}. Fit score ${sc}/100.${comp}${plan ? ` Earliest realistic opening: ${plan.feasibleMonths} months; planned for ${fmtDate(plan.plannedOpen)}.${plan.payback ? ` Indicative payback ~${plan.payback.months} months.` : ""}` : ""}`;
      if (owner?.action === "override") explanation = `Owner override: ${owner.reason}. ` + explanation;
      nextSteps.push(...(plan?.steps.slice(0, 3).map((s) => `${s.title} — ${s.detail}`) ?? []));
      nextSteps.push(...conditions.map((c) => `Condition: ${c}`));
      break;
    }
    case "REDIRECT": {
      const why =
        extraNotes[0] === "pin_taken"
          ? `${competition?.samePinRivals?.[0] ?? "A stronger applicant"} scored higher for the same pin ${app.pin}, and the brand opens only one store per pin`
          : extraNotes[0] === "capacity"
            ? `${ev.territory?.id}'s slots went to higher-scoring applicants`
            : reasonLines(ev.issues.filter((i) => i.gate === "place" && i.severity === "block"));
      headline = `Recommend offering ${name} pin ${allocation!.pin} (${allocation!.territoryId}) instead of ${app.pin}.`;
      explanation = `${name} is a qualified partner (fit score ${ownSc}/100 at their chosen pin), but ${why.replace(/\.$/, "")}. Pin ${allocation!.pin} in ${allocation!.territoryId} (${t?.priority} priority) is still free, so we propose they open there. Because they would need a new site and may decline the move, we score them ${sc}/100 for this offer — still the strongest claim on this slot.`;
      nextSteps.push(`Call ${name}: offer pin ${allocation!.pin}. If they decline, move them to the waitlist for ${ev.territory?.id ?? "their city"}.`);
      nextSteps.push(...(plan?.steps.slice(0, 3).map((s) => `${s.title} — ${s.detail}`) ?? []));
      break;
    }
    case "WAITLIST": {
      const why =
        extraNotes[0] === "pin_taken"
          ? `${competition?.samePinRivals?.[0]} scored higher for the same pin ${app.pin} (one store per pin)`
          : extraNotes[0] === "capacity"
            ? `all ${competition?.capacity ?? 0} slot(s) in ${ev.territory?.id} went to higher scorers${competition?.beatenBy?.length ? ` (${competition.beatenBy.map((x) => `${x.id} ${x.score.toFixed(0)}`).join(", ")})` : ""}`
            : reasonLines(ev.issues.filter((i) => i.gate === "place" && i.severity === "block")).replace(/\.$/, "");
      headline = `Qualified, but no free slot — recommend waitlisting ${name}.`;
      explanation = `${name} passes every check (fit score ${ownSc}/100${relocated ? `; ${sc} if moved to another pin` : ""}), but ${why}, and no other pin in ${app.city} has a free slot. They should be first in line when a slot opens or a reserved partner drops out.`;
      nextSteps.push(`Tell ${name} they are qualified and waitlisted for ${ev.territory?.id ?? app.city}; re-check monthly.`);
      nextSteps.push("If any reserved partner misses their LOI deadline, offer the slot to the top of this waitlist.");
      break;
    }
    case "HOLD": {
      const blocks = owner?.action === "override" ? [] : ev.holdBlocks;
      headline = `On hold — ${blocks.length ? blocks.map((x) => shortCode(x.code)).join(", ") : owner?.reason ?? "needs review"}.`;
      explanation = `${name} cannot be judged fairly yet: ${reasonLines(blocks) || owner?.reason || ""}`;
      if (competition?.wouldRank && competition.capacity > 0) {
        const fits = competition.wouldRank <= competition.capacity;
        explanation += ` If this is resolved, they would rank #${competition.wouldRank} of ${competition.contenders} for ${competition.territoryId} (${competition.capacity} slot${competition.capacity === 1 ? "" : "s"}) — ${fits ? "enough to win a slot" : "likely waitlist"}.`;
      }
      nextSteps.push(...blocks.filter((x) => x.fix).map((x) => `Ask: ${x.fix}`));
      break;
    }
    case "NOT_NOW": {
      headline = `Not now — ${ev.hardBlocks.map((x) => shortCode(x.code)).join(", ")}.`;
      explanation = `${reasonLines(ev.hardBlocks)} This is a recommendation for the owner, not a rejection: ${ev.hardBlocks.map((x) => x.fix).filter(Boolean).join(" ")}`;
      nextSteps.push(...ev.hardBlocks.map((x) => x.fix!).filter(Boolean));
      nextSteps.push(...ev.alternatives);
      nextSteps.push("Keep in the CRM pipeline and contact them again at the next expansion wave.");
      break;
    }
  }
  if (owner?.action === "override" && status !== "ADVANCE") explanation = `Owner set this to ${statusWord(status)}: ${owner.reason}. Engine view: ${explanation}`;

  return {
    id: app.id,
    status,
    headline,
    explanation,
    nextSteps,
    gates: ev.gates,
    issues: ev.issues,
    signals: ev.signals,
    score,
    ownPinScore: relocated ? ev.score.total : undefined,
    territoryId: allocation?.territoryId ?? ev.territory?.id ?? null,
    appliedTerritoryId: ev.territory?.id ?? null,
    allocation,
    competition,
    plan,
    ownerOverride: owner,
    requiredCapital: ev.requiredCapital,
    effectiveCapital: ev.effectiveCapital,
    alternatives: ev.alternatives,
  };
}

const SHORT: Record<string, string> = {
  CITY_MISSING: "city missing",
  CITY_OUTSIDE_NETWORK: "city outside plan",
  PIN_INVALID: "invalid pin",
  PIN_CITY_MISMATCH: "pin doesn't match city",
  INVESTMENT_MISSING: "investment missing",
  DUPLICATE_SUBMISSION: "duplicate submission",
  SPACE_MISSING: "space status missing",
  SIZE_MISSING: "space size missing",
  FLOOR_CONTRADICTION: "floor contradicts notes",
  FINANCING_PROBABLE: "financing probable (small capital gap)",
  CAPITAL_SHORT: "capital well below requirement",
  SPACE_TOO_SMALL: "space too small",
  FLOOR_UPPER: "upper-floor space",
  NO_TERRITORY_IN_CITY: "no territory in this city",
};
const shortCode = (c: string) => SHORT[c] ?? c.toLowerCase().replace(/_/g, " ");

export function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function allocLabel(d: Decision | undefined) {
  return d?.allocation ? `${d.allocation.territoryId}·${d.allocation.pin}` : null;
}

/** What changed between two runs — used after every update so the effect is visible. */
export function diffResults(before: EngineResult, after: EngineResult): Change[] {
  const out: Change[] = [];
  const ids = new Set([...Object.keys(before.decisions), ...Object.keys(after.decisions)]);
  for (const id of ids) {
    const a = before.decisions[id];
    const b = after.decisions[id];
    const sa = a?.score?.total ?? null;
    const sb = b?.score?.total ?? null;
    if (a?.status !== b?.status || allocLabel(a) !== allocLabel(b) || Math.abs((sa ?? 0) - (sb ?? 0)) >= 0.5) {
      out.push({ id, from: a?.status ?? null, to: b?.status ?? null, fromAlloc: allocLabel(a), toAlloc: allocLabel(b), fromScore: sa, toScore: sb, why: b?.headline ?? "Removed" });
    }
  }
  const rank = (c: Change) => (c.from !== c.to ? 0 : c.fromAlloc !== c.toAlloc ? 1 : 2);
  return out.sort((x, y) => rank(x) - rank(y));
}
