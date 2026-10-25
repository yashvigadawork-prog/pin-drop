"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CONFIG } from "@/lib/engine/config";
import { diffResults, runEngine } from "@/lib/engine/engine";
import { applyUpdates, type AppliedUpdate, type Update } from "@/lib/engine/updates";
import { readWorkbook } from "@/lib/engine/workbook";
import type { Change, EngineConfig, EngineInput, EngineResult, OwnerAction } from "@/lib/engine/types";

export interface AuditEvent {
  id: number;
  at: string;
  kind: "upload" | "update" | "owner" | "weights" | "config" | "undo";
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
}

const empty: State = { base: null, fileName: "", updates: [], owner: [], config: DEFAULT_CONFIG, runId: null, audit: [] };
const LS_KEY = "partnerpath-session-v1";

function compute(s: State): { input: EngineInput; applied: AppliedUpdate[]; result: EngineResult } | null {
  if (!s.base) return null;
  const { input, applied } = applyUpdates(s.base, s.updates);
  return { input, applied, result: runEngine(input, s.config, { owner: s.owner }) };
}

let eventSeq = 1;

export function useWorkspace() {
  const [state, setState] = useState<State>(empty);
  const [lastChanges, setLastChanges] = useState<{ label: string; changes: Change[]; at: number } | null>(null);
  const [dbStatus, setDbStatus] = useState<"unknown" | "on" | "off">("unknown");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const derived = useMemo(() => compute(state), [state]);

  const persist = useCallback((runId: string | null, kind: string, payload: unknown) => {
    if (!runId) return;
    fetch(`/api/runs/${runId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, payload }) }).catch(() => {});
  }, []);

  /** Apply a change, rerun the engine, record what moved. */
  const mutate = useCallback(
    (label: string, kind: AuditEvent["kind"], fn: (s: State) => State, persistKind?: { kind: string; payload: unknown }) => {
      const prev = stateRef.current;
      const before = compute(prev);
      const next = fn(prev);
      const after = compute(next);
      const changes = before && after ? diffResults(before.result, after.result) : [];
      const ev: AuditEvent = { id: eventSeq++, at: new Date().toISOString(), kind, summary: label, changes };
      const withAudit = { ...next, audit: [...next.audit, ev] };
      setState(withAudit);
      setLastChanges({ label, changes, at: Date.now() });
      if (persistKind) persist(next.runId, persistKind.kind, { ...(persistKind.payload as object), label });
      return { changes, after };
    },
    [persist],
  );

  const loadInput = useCallback(async (input: EngineInput, fileName: string, opts?: { runId?: string; updates?: Update[]; owner?: OwnerAction[]; config?: EngineConfig }) => {
    const s: State = { ...empty, base: input, fileName, updates: opts?.updates ?? [], owner: opts?.owner ?? [], config: opts?.config ?? DEFAULT_CONFIG, runId: opts?.runId ?? null };
    s.audit = [{ id: eventSeq++, at: new Date().toISOString(), kind: "upload", summary: `Loaded ${fileName}: ${input.applications.length} applications, ${input.territories.length} territories.`, changes: [] }];
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
        await loadInput(input, file.name);
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
      await loadInput(readWorkbook(new Uint8Array(buf)), "sample-test-data.xlsx");
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
          if (s.base) setState({ ...s, config: { ...DEFAULT_CONFIG, ...s.config } });
        }
      } catch {}
    })();
  }, [loadInput]);

  useEffect(() => {
    try {
      if (state.base) localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const addUpdates = useCallback(
    (updates: Update[], label: string) => mutate(label, "update", (s) => ({ ...s, updates: [...s.updates, ...updates] }), { kind: "update", payload: { updates } }),
    [mutate],
  );
  const undoLastUpdate = useCallback(() => {
    const last = stateRef.current.updates.at(-1);
    if (!last) return;
    mutate(`Undid update to ${last.appId} (${last.field})`, "undo", (s) => ({ ...s, updates: s.updates.slice(0, -1) }), { kind: "update", payload: { undo: true } });
  }, [mutate]);
  const ownerAction = useCallback(
    (a: OwnerAction) =>
      mutate(
        a.action === "confirm" ? `Owner confirmed ${a.appId}${a.allocation ? ` (${a.allocation.territoryId}·${a.allocation.pin} locked)` : ""}: ${a.reason}` : `Owner set ${a.appId} to ${a.status}: ${a.reason}`,
        "owner",
        (s) => ({ ...s, owner: [...s.owner.filter((o) => o.appId !== a.appId), a] }),
        { kind: "owner", payload: { action: a } },
      ),
    [mutate],
  );
  const clearOwner = useCallback(
    (appId: string) => mutate(`Owner decision on ${appId} removed — back to engine recommendation`, "owner", (s) => ({ ...s, owner: s.owner.filter((o) => o.appId !== appId) }), { kind: "owner", payload: { remove: appId } }),
    [mutate],
  );
  const setConfig = useCallback(
    (config: EngineConfig, label: string, kind: "weights" | "config" = "config") => mutate(label, kind, (s) => ({ ...s, config }), { kind, payload: { config } }),
    [mutate],
  );
  const reset = useCallback(() => {
    setState(empty);
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
    input: derived?.input ?? null,
    applied: derived?.applied ?? [],
    result: derived?.result ?? null,
    lastChanges,
    clearLastChanges: () => setLastChanges(null),
    dbStatus,
    loading,
    error,
    uploadFile,
    loadSample,
    addUpdates,
    undoLastUpdate,
    ownerAction,
    clearOwner,
    setConfig,
    reset,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
