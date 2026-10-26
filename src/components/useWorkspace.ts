"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CONFIG } from "@/lib/engine/config";
import { diffResults, runEngine } from "@/lib/engine/engine";
import { applyUpdates, type AppliedUpdate, type Update } from "@/lib/engine/updates";
import { readWorkbook } from "@/lib/engine/workbook";
import type { Change, EngineConfig, EngineInput, EngineResult, OwnerAction } from "@/lib/engine/types";
import { buildRows, expAll as expAllFn, type Row } from "@/lib/desk/model";
import { ctxFromExp, ctxFromRow, mailFor, toText } from "@/lib/desk/mail";
import { readPaste } from "@/lib/desk/paste";
import { readExtras } from "@/lib/desk/extras";
import { addDays } from "@/lib/desk/time";
import { ALL_CHECK_KEYS, MAIL_LABEL, UI_META, emptyDesk, type CheckState, type Desk, type MailType, type ModKey, type OnbRec, type UiStatus } from "@/lib/desk/types";

export interface AuditEvent {
  id: number;
  at: string;
  kind: "upload" | "update" | "owner" | "weights" | "config" | "undo" | "mail" | "move" | "check";
  summary: string;
  changes: Change[];
}

interface State {
  base: EngineInput | null;
  fileName: string;
  updates: Update[];
  owner: OwnerAction[];
  config: EngineConfig;
  runId: string | null;
  audit: AuditEvent[];
  desk: Desk;
}

const empty: State = { base: null, fileName: "", updates: [], owner: [], config: DEFAULT_CONFIG, runId: null, audit: [], desk: emptyDesk() };
const LS_KEY = "pindrop-session-v2";

function compute(s: State): { input: EngineInput; applied: AppliedUpdate[]; result: EngineResult } | null {
  if (!s.base) return null;
  const { input, applied } = applyUpdates(s.base, s.updates);
  return { input, applied, result: runEngine(input, s.config, { owner: s.owner }) };
}
function rowsOf(s: State): Row[] {
  const c = compute(s);
  return c ? buildRows(c.input, c.result, s.desk) : [];
}
const blankChecks = (): Record<string, CheckState> => Object.fromEntries(ALL_CHECK_KEYS.map((k) => [k, "todo" as CheckState]));
const iso = () => new Date().toISOString();

let eventSeq = 1;

const DEMO_REPLIES = [
  { id: "APP-007", hoursAgo: 2, text: "Hi, I found a ground floor shop, 450 sq ft, same pin 570001 on the main road." },
  { id: "APP-005", hoursAgo: 26, text: "My FD of ₹4 lakh can be used. I can show the certificate." },
];
const DEMO_EXP: [string, string, string, string, string, number, string][] = [
  ["E-101", "Suma Hegde", "Hassan", "573201", "City not served", 78, "12 Oct"],
  ["E-102", "Prakash Shenoy", "Udupi", "576101", "City not served", 81, "13 Oct"],
  ["E-103", "Zainab Khan", "Hassan", "573202", "City not served", 70, "15 Oct"],
  ["E-104", "Mahesh Gouda", "Shivamogga", "577201", "City not served", 76, "16 Oct"],
  ["E-105", "Kavitha R", "Shivamogga", "577202", "City not served", 69, "18 Oct"],
  ["E-106", "Basavaraj P", "Ballari", "583101", "City not served", 72, "19 Oct"],
  ["E-107", "Nazia Begum", "Kalaburagi", "585101", "City not served", 66, "21 Oct"],
  ["E-108", "Santosh Rao", "Udupi", "576102", "City not served", 74, "22 Oct"],
  ["E-109", "Anil Naik", "Belagavi", "590010", "No open territory in this city", 71, "23 Oct"],
];

/** A realistic starting point for the bundled sample: some partners already emailed, some replies waiting. */
function seedDemo(s: State): State {
  const c = compute(s);
  if (!c) return s;
  const rows = buildRows(c.input, c.result, s.desk);
  const now = Date.now();
  const desk: Desk = { ...s.desk, sample: true, mail: { ...s.desk.mail }, mailLog: { ...s.desk.mailLog }, onb: { ...s.desk.onb } };
  const owner = [...s.owner];
  for (const [id, stage] of [["APP-001", 6], ["APP-021", 4], ["APP-013", 3]] as const) {
    const r = rows.find((x) => x.id === id);
    if (!r?.d.allocation) continue;
    owner.push({ appId: id, action: "confirm", allocation: { territoryId: r.d.allocation.territoryId, pin: r.d.allocation.pin, kind: r.d.allocation.kind }, reason: "Next steps sent", at: iso() });
    const chk = blankChecks();
    const flat = ALL_CHECK_KEYS;
    const ver = Math.min(flat.length, Math.round((stage / 12) * flat.length * 1.5));
    flat.forEach((k, j) => (chk[k] = j < ver ? "verified" : j < ver + 2 ? "received" : j < ver + 4 ? "asked" : "todo"));
    if (id === "APP-013") chk.title = "flag";
    desk.onb[id] = { stage, chk, since: addDays(now, -3), holdUntil: addDays(now, 27 - (id === "APP-021" ? 3 : id === "APP-013" ? 7 : 0)) } satisfies OnbRec;
    desk.mail[id] = { type: "next", at: addDays(now, -3) };
    desk.mailLog[id] = [{ type: "next", at: addDays(now, -3) }];
  }
  for (const [id, d] of [["APP-005", 5], ["APP-007", 5], ["APP-017", 4], ["APP-024", 2]] as const) {
    if (!rows.find((x) => x.id === id)) continue;
    desk.mail[id] = { type: "info", at: addDays(now, -d) };
    desk.mailLog[id] = [{ type: "info", at: addDays(now, -d) }];
  }
  desk.replies = DEMO_REPLIES.filter((r) => rows.some((x) => x.id === r.id)).map((r) => ({ id: r.id, text: r.text, at: new Date(now - r.hoursAgo * 3600000).toISOString() }));
  desk.expExtra = DEMO_EXP.map(([id, name, city, pin, reason, fit, added]) => ({ id, name, city, pin, reason, fit, added }));
  for (const [id, , , , , , added] of DEMO_EXP) desk.mail["exp:" + id] = { type: "keep", at: `2026-10-${added.slice(0, 2)}T09:00:00.000Z` };
  return { ...s, owner, desk };
}

export function useWorkspace() {
  const [state, setState] = useState<State>(empty);
  const [lastChanges, setLastChanges] = useState<{ label: string; changes: Change[]; at: number } | null>(null);
  const [dbStatus, setDbStatus] = useState<"unknown" | "on" | "off">("unknown");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const derived = useMemo(() => compute(state), [state]);
  const rows = useMemo(() => (derived ? buildRows(derived.input, derived.result, state.desk) : []), [derived, state.desk]);
  const expList = useMemo(() => expAllFn(rows, state.desk), [rows, state.desk]);

  const persist = useCallback((runId: string | null, kind: string, payload: unknown) => {
    if (!runId) return;
    fetch(`/api/runs/${runId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, payload }) }).catch(() => {});
  }, []);

  /** Apply a change, rerun the engine, record what moved. */
  const mutate = useCallback(
    (label: string, kind: AuditEvent["kind"], fn: (s: State) => State, persistKinds: { kind: string; payload: unknown }[] = []) => {
      const prev = stateRef.current;
      const before = compute(prev);
      const next = fn(prev);
      const after = compute(next);
      const changes = before && after ? diffResults(before.result, after.result) : [];
      const ev: AuditEvent = { id: eventSeq++, at: new Date().toISOString(), kind, summary: label, changes };
      const withAudit = { ...next, audit: [...next.audit, ev] };
      stateRef.current = withAudit;
      setState(withAudit);
      setLastChanges({ label, changes, at: Date.now() });
      for (const p of persistKinds) persist(next.runId, p.kind, { ...(p.payload as object), label });
      return { changes, after };
    },
    [persist],
  );
  const patchDesk = useCallback((fn: (d: Desk) => Desk) => {
    const next = { ...stateRef.current, desk: fn(stateRef.current.desk) };
    stateRef.current = next;
    setState(next);
  }, []);

  const loadInput = useCallback(async (input: EngineInput, fileName: string, opts?: { runId?: string; updates?: Update[]; owner?: OwnerAction[]; config?: EngineConfig; demo?: boolean; extras?: Desk["extras"] }) => {
    let s: State = { ...empty, desk: { ...emptyDesk(), uploadedAt: iso(), extras: opts?.extras ?? {} }, base: input, fileName, updates: opts?.updates ?? [], owner: opts?.owner ?? [], config: opts?.config ?? DEFAULT_CONFIG, runId: opts?.runId ?? null };
    if (opts?.demo) s = seedDemo(s);
    s.audit = [{ id: eventSeq++, at: iso(), kind: "upload", summary: `Loaded ${fileName}: ${input.applications.length} applications, ${input.territories.length} territories.`, changes: [] }];
    stateRef.current = s;
    setState(s);
    setLastChanges(null);
    if (!opts?.runId) {
      try {
        const r = await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, config: s.config, fileName }) });
        if (r.ok) {
          const { id } = await r.json();
          setState((cur) => (cur.base === input ? { ...cur, runId: id } : cur));
          setDbStatus("on");
          const url = new URL(window.location.href);
          url.searchParams.set("run", id);
          window.history.replaceState(null, "", url.toString());
        } else setDbStatus("off");
      } catch {
        setDbStatus("off");
      }
    }
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const buf = await file.arrayBuffer();
        const input = readWorkbook(new Uint8Array(buf));
        if (!input.applications.length) throw new Error("No applications found. Is this the Case 1 template (Applications sheet with an 'Application ID' header)?");
        await loadInput(input, file.name, { extras: readExtras(new Uint8Array(buf)) });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [loadInput],
  );

  const loadSample = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/sample-test-data.xlsx");
      const buf = await r.arrayBuffer();
      await loadInput(readWorkbook(new Uint8Array(buf)), "sample-test-data.xlsx", { demo: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loadInput]);

  // Restore a shared run (?run=id) or this browser's last session.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("run");
    (async () => {
      if (id) {
        try {
          const r = await fetch(`/api/runs/${id}`);
          if (r.ok) {
            const { run, events } = await r.json();
            const updates: Update[] = [];
            const owner: OwnerAction[] = [];
            let config: EngineConfig = { ...DEFAULT_CONFIG, ...run.config };
            for (const e of events) {
              if (e.kind === "update") {
                if (e.payload.undo) updates.pop();
                else updates.push(...(e.payload.updates ?? []));
              }
              if (e.kind === "owner") {
                if (e.payload.remove) owner.splice(0, owner.length, ...owner.filter((o) => o.appId !== e.payload.remove));
                else if (e.payload.action) owner.push(e.payload.action);
              }
              if (e.kind === "config" || e.kind === "weights") config = { ...config, ...e.payload.config };
            }
            setDbStatus("on");
            await loadInput(run.input, run.file_name || "shared run", { runId: id, updates, owner, config });
            return;
          }
        } catch {}
      }
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const s = JSON.parse(raw) as State;
          if (s.base) setState({ ...s, config: { ...DEFAULT_CONFIG, ...s.config }, desk: { ...emptyDesk(), ...s.desk, mods: { ...emptyDesk().mods, ...s.desk?.mods }, guard: { ...emptyDesk().guard, ...s.desk?.guard } } });
        }
      } catch {}
    })();
  }, [loadInput]);

  useEffect(() => {
    try {
      if (state.base) localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  /* ---------- engine-level actions ---------- */
  const addUpdates = useCallback(
    (updates: Update[], label: string) => mutate(label, "update", (s) => ({ ...s, updates: [...s.updates, ...updates] }), [{ kind: "update", payload: { updates } }]),
    [mutate],
  );
  const undoLastUpdate = useCallback(() => {
    const last = stateRef.current.updates.at(-1);
    if (!last) return;
    mutate(`Undid update to ${last.appId} (${last.field})`, "undo", (s) => ({ ...s, updates: s.updates.slice(0, -1) }), [{ kind: "update", payload: { undo: true } }]);
  }, [mutate]);
  const setConfig = useCallback(
    (config: EngineConfig, label: string, kind: "weights" | "config" = "config") => mutate(label, kind, (s) => ({ ...s, config }), [{ kind, payload: { config } }]),
    [mutate],
  );

  /* ---------- owner decisions ---------- */
  /** Move people to another bucket. "Proceed" needs a free pin; the engine then keeps that pin locked. */
  const moveApplicants = useCallback(
    (ids: string[], target: UiStatus, reason: string, pin?: string, terr?: string, spot = false) => {
      const actions: OwnerAction[] = [];
      const label = `Moved ${ids.length > 1 ? ids.length + " people" : ids[0]} to ${UI_META[target].label}: ${reason}`;
      const res = mutate(
        label,
        "move",
        (s) => {
          const rs = rowsOf(s);
          const owner = s.owner.filter((o) => !ids.includes(o.appId));
          const moves = { ...s.desk.moves };
          const spotMap = { ...s.desk.spot };
          for (const id of ids) {
            const r = rs.find((x) => x.id === id);
            if (!r) continue;
            const at = iso();
            let a: OwnerAction;
            if (target === "adv" && pin && terr) a = { appId: id, action: "confirm", allocation: { territoryId: terr, pin, kind: pin === (r.app.pin ?? "") ? "own_pin" : "redirect" }, reason, at };
            else a = { appId: id, action: "override", status: target === "info" ? "HOLD" : target === "wait" ? "WAITLIST" : "NOT_NOW", reason, at };
            owner.push(a);
            actions.push(a);
            moves[id] = { target: target === "adv" && pin !== r.app.pin ? "redir" : target, reason, at, from: r.ui, pin, terr };
            if (spot) spotMap[id] = "moved";
          }
          return { ...s, owner, desk: { ...s.desk, moves, spot: spotMap } };
        },
        [],
      );
      actions.forEach((a) => persist(stateRef.current.runId, "owner", { action: a, label }));
      return res;
    },
    [mutate, persist],
  );
  const resetMove = useCallback(
    (id: string) =>
      mutate(`${id} reset to the engine's suggestion`, "move", (s) => {
        const moves = { ...s.desk.moves };
        delete moves[id];
        return { ...s, owner: s.owner.filter((o) => o.appId !== id), desk: { ...s.desk, moves } };
      }, [{ kind: "owner", payload: { remove: id } }]),
    [mutate],
  );
  const toggleLock = useCallback(
    (id: string) => {
      const r = rowsOf(stateRef.current).find((x) => x.id === id);
      if (!r?.d.allocation) return;
      const locked = r.locked;
      const a: OwnerAction = { appId: id, action: "confirm", allocation: { territoryId: r.d.allocation.territoryId, pin: r.d.allocation.pin, kind: r.d.allocation.kind }, reason: "Pin locked by owner", at: iso() };
      mutate(locked ? `${id}: pin unlocked` : `${id}: pin ${r.d.allocation.pin} locked`, "owner", (s) => {
        const owner = s.owner.filter((o) => o.appId !== id);
        const moves = { ...s.desk.moves };
        if (locked) delete moves[id];
        return { ...s, owner: locked ? owner : [...owner, a], desk: { ...s.desk, moves } };
      }, locked ? [{ kind: "owner", payload: { remove: id } }] : [{ kind: "owner", payload: { action: a } }]);
    },
    [mutate],
  );

  /** Send emails. Next-steps emails lock the pin and move the person to Onboarding. */
  const sendMail = useCallback(
    async (items: { id: string; type: MailType; edited?: boolean; area?: string; override?: { sub: string; text: string } }[]) => {
      const sent: { to: string; sub: string; text: string }[] = [];
      mutate(
        items.length === 1 ? `${MAIL_LABEL[items[0].type]} email to ${items[0].id}` : `${items.length} emails sent`,
        "mail",
        (s) => {
          const rs = rowsOf(s);
          const desk: Desk = { ...s.desk, mail: { ...s.desk.mail }, mailLog: { ...s.desk.mailLog }, onb: { ...s.desk.onb }, closed: { ...s.desk.closed } };
          let owner = [...s.owner];
          const now = Date.now();
          for (const it of items) {
            const r = rs.find((x) => x.id === it.id);
            const ex = s.desk.expExtra.find((e) => e.id === it.id);
            const key = it.type === "keep" ? "exp:" + it.id : it.type === "exp2" ? "exp2:" + it.id : it.id;
            const rec = { type: it.type, at: new Date(now).toISOString(), edited: it.edited };
            desk.mail[key] = rec;
            desk.mailLog[it.id] = [rec, ...(desk.mailLog[it.id] ?? [])];
            const m = mailFor(r ? ctxFromRow(r) : ex ? ctxFromExp(ex) : { name: it.id, city: "", pin: "", asks: [], why: "" }, it.type, it.area);
            sent.push({ to: m.to, sub: it.override?.sub ?? m.sub, text: it.override?.text ?? toText(m.html) });
            if ((it.type === "next" || it.type === "offer") && r) {
              if (r.d.allocation) owner = [...owner.filter((o) => o.appId !== it.id), { appId: it.id, action: "confirm", allocation: { territoryId: r.d.allocation.territoryId, pin: r.d.allocation.pin, kind: r.d.allocation.kind }, reason: "Next steps sent", at: rec.at }];
              desk.onb[it.id] = { stage: 0, chk: { ...blankChecks(), ...(s.desk.extras[it.id] ?? {}) }, since: rec.at, holdUntil: addDays(now, s.desk.guard.hold) };
            }
            if (it.type === "notnow") desk.closed[it.id] = true;
          }
          return { ...s, owner, desk };
        },
        [],
      );
      if (stateRef.current.desk.emailMode === "real") {
        let ok = 0;
        for (const m of sent) {
          try {
            const r = await fetch("/api/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(m) });
            if (r.ok) ok++;
          } catch {}
        }
        return { ok, failed: sent.length - ok, real: true };
      }
      return { ok: sent.length, failed: 0, real: false };
    },
    [mutate],
  );

  const remind = useCallback(
    (id: string) =>
      mutate(`Reminder sent to ${id}`, "mail", (s) => {
        const rec = { type: "remind" as MailType, at: iso() };
        return { ...s, desk: { ...s.desk, mail: { ...s.desk.mail, [id]: rec }, mailLog: { ...s.desk.mailLog, [id]: [rec, ...(s.desk.mailLog[id] ?? [])] } } };
      }),
    [mutate],
  );
  const markSpot = useCallback((id: string, r: "agree" | "moved") => mutate(`Spot-check: ${r === "agree" ? "agreed with" : "disagreed with"} ${id}`, "check", (s) => ({ ...s, desk: { ...s.desk, spot: { ...s.desk.spot, [id]: r } } })), [mutate]);

  /* ---------- onboarding ---------- */
  const cycleCheck = useCallback(
    (id: string, key: string) =>
      mutate(`Check updated for ${id}`, "check", (s) => {
        const o = s.desk.onb[id];
        if (!o) return s;
        const nx = ({ todo: "asked", asked: "received", received: "verified", verified: "todo", flag: "verified" } as Record<CheckState, CheckState>)[o.chk[key]];
        const chk = { ...o.chk, [key]: nx };
        let stage = o.stage;
        if (nx === "verified") {
          const v = Object.values(chk).filter((x) => x === "verified").length;
          stage = Math.max(stage, Math.min(11, Math.floor((v / ALL_CHECK_KEYS.length) * 6)));
        }
        return { ...s, desk: { ...s.desk, onb: { ...s.desk.onb, [id]: { ...o, chk, stage } } } };
      }),
    [mutate],
  );
  const simulateReply = useCallback(
    (id: string) =>
      mutate(`${id} replied: documents received`, "check", (s) => {
        const o = s.desk.onb[id];
        if (!o) return s;
        const chk = { ...o.chk };
        let c = 0;
        for (const k of ALL_CHECK_KEYS) {
          if (c < 3 && chk[k] === "asked") {
            chk[k] = "received";
            c++;
          }
        }
        for (const k of ALL_CHECK_KEYS) {
          if (c < 4 && chk[k] === "todo") {
            chk[k] = "asked";
            c++;
          }
        }
        return { ...s, desk: { ...s.desk, onb: { ...s.desk.onb, [id]: { ...o, chk } } } };
      }),
    [mutate],
  );

  /** Read a reply: turn the facts in it into updates, re-run everything, and clear it from the inbox. */
  const applyReply = useCallback(
    (id: string, text: string) => {
      const { updates } = readPaste(text);
      const ups: Update[] = updates.map((u) => ({ ...u, appId: id }));
      return mutate(`Reply from ${id} applied`, "update", (s) => ({ ...s, updates: [...s.updates, ...ups], desk: { ...s.desk, replies: s.desk.replies.filter((r) => r.id !== id) } }), ups.length ? [{ kind: "update", payload: { updates: ups } }] : []);
    },
    [mutate],
  );

  /* ---------- settings ---------- */
  const setMod = useCallback((k: ModKey, on: boolean) => patchDesk((d) => ({ ...d, mods: { ...d.mods, [k]: on } })), [patchDesk]);
  const setGuard = useCallback((g: Partial<Desk["guard"]>) => patchDesk((d) => ({ ...d, guard: { ...d.guard, ...g } })), [patchDesk]);
  const setEmailMode = useCallback((m: Desk["emailMode"]) => patchDesk((d) => ({ ...d, emailMode: m })), [patchDesk]);
  const setThreshold = useCallback((n: number) => patchDesk((d) => ({ ...d, expThreshold: n })), [patchDesk]);
  const toggleServed = useCallback((city: string) => patchDesk((d) => ({ ...d, servedOn: { ...d.servedOn, [city]: !d.servedOn[city] } })), [patchDesk]);
  const saveNote = useCallback((id: string, text: string) => patchDesk((d) => ({ ...d, notes: { ...d.notes, [id]: text } })), [patchDesk]);
  const logSummary = useCallback((to: string, when: string) => mutate(`Summary emailed to ${to} (${when})`, "mail", (s) => s), [mutate]);

  const reset = useCallback(() => {
    setState(empty);
    stateRef.current = empty;
    setLastChanges(null);
    try {
      localStorage.removeItem(LS_KEY);
    } catch {}
    const url = new URL(window.location.href);
    url.searchParams.delete("run");
    window.history.replaceState(null, "", url.toString());
  }, []);

  return {
    state,
    desk: state.desk,
    input: derived?.input ?? null,
    applied: derived?.applied ?? [],
    result: derived?.result ?? null,
    rows,
    expList,
    lastChanges,
    clearLastChanges: () => setLastChanges(null),
    dbStatus,
    loading,
    error,
    uploadFile,
    loadSample,
    addUpdates,
    undoLastUpdate,
    setConfig,
    moveApplicants,
    resetMove,
    toggleLock,
    sendMail,
    remind,
    markSpot,
    cycleCheck,
    simulateReply,
    applyReply,
    setMod,
    setGuard,
    setEmailMode,
    setThreshold,
    toggleServed,
    saveNote,
    logSummary,
    reset,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
