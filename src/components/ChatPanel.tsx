"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseMessage, statusFromWord } from "@/lib/engine/nlu";
import { FIELD_LABEL, UPDATE_FIELDS, type Update, type UpdateField } from "@/lib/engine/updates";
import type { Change, EngineInput, EngineResult, Status } from "@/lib/engine/types";
import { ChangeList } from "./OtherTabs";
import { STATUS_META, StatusChip } from "./ui";
import type { Workspace } from "./useWorkspace";

interface Msg {
  id: number;
  role: "user" | "bot";
  text: string;
  source?: "engine" | "ai" | "fallback";
  model?: string;
  applied?: { appId: string; field: string; before: string; after: string; ok: boolean; error?: string }[];
  changes?: Change[];
  focus?: { id: string; status: Status; headline: string }[];
  undoable?: boolean;
}

let seq = 1;

function buildContext(result: EngineResult, input: EngineInput, focusIds: string[]) {
  const apps = Object.fromEntries(input.applications.map((a) => [a.id, a]));
  const full = new Set(focusIds);
  const many = result.order.length > 60;
  const records = result.order.map((id) => {
    const d = result.decisions[id];
    const a = apps[id];
    const base = { id, name: a.name, city: a.city ?? a.cityRaw, pin: a.pin ?? a.pinRaw, status: d.status, headline: d.headline, score: d.score?.total, slot: d.allocation ? `${d.allocation.territoryId}/${d.allocation.pin}` : null, territory: d.territoryId };
    if (many && !full.has(id)) return base;
    return {
      ...base,
      explanation: d.explanation,
      nextSteps: d.nextSteps.slice(0, 4),
      issues: d.issues.filter((i) => i.severity !== "info").map((i) => i.message),
      facts: { investmentLakh: a.investment, extraLakh: a.extra.extraCapital, requiredLakh: d.requiredCapital, experienceYrs: a.experience, space: a.space, sqft: a.sizeSqft, floor: a.floor, targetMonths: a.targetMonths, languages: a.languages, business: a.business, notes: a.notes },
      competition: d.competition,
      plannedOpen: d.plan?.plannedOpen,
      mentorStore: d.plan?.training.mentorStore.id,
      paybackMonths: d.plan?.payback?.months,
    };
  });
  const territories = result.territories.map((t) => ({ id: t.territory.id, city: t.territory.city, priority: t.territory.priority, tier: t.territory.tier, realCapacity: t.capacity, sheetSlots: t.territory.slots, freePins: t.freePins, storePins: t.blockedPins, allocated: t.allocated }));
  return JSON.stringify({ weights: result.config.weights, phase: result.config.phaseName, minCapitalLakh: result.config.minCapital, applications: records, territories });
}

export function ChatPanel({ ws, onOpen, injected }: { ws: Workspace; onOpen: (id: string) => void; injected: { text: string; n: number } | null }) {
  const { result, input } = ws;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);
  useEffect(() => {
    if (injected) send(injected.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injected?.n]);

  const suggestions = useMemo(() => {
    if (!result) return [];
    const s: string[] = [];
    const byStatus = (st: Status) => result.order.filter((id) => result.decisions[id].status === st);
    const hasCode = (code: string) => result.order.find((id) => result.decisions[id].issues.some((i) => i.code === code && i.severity === "block"));
    const hold = byStatus("HOLD")[0];
    if (hold) s.push(`Why is ${hold} on hold?`);
    const upper = hasCode("FLOOR_UPPER");
    if (upper) s.push(`${upper} has now found a ground-floor space`);
    const fin = hasCode("FINANCING_PROBABLE");
    if (fin) s.push(`${fin} can add 4 lakh more from family savings`);
    const wl = byStatus("WAITLIST")[0];
    if (wl) s.push(`Why is ${wl} waitlisted?`);
    const adv = byStatus("ADVANCE")[0];
    if (adv) s.push(`How will ${adv} be trained?`);
    s.push("Who is on hold and what do they need?");
    return s.slice(0, 6);
  }, [result]);

  const names = useMemo(() => Object.fromEntries((input?.applications ?? []).map((a) => [a.id, a.name])), [input]);

  function engineAnswer(ids: string[]): Msg {
    const r = result!;
    const parts = ids.map((id) => {
      const d = r.decisions[id];
      return `**${id} — ${STATUS_META[d.status].label}.** ${d.explanation}${d.nextSteps.length ? `\nNext: ${d.nextSteps.slice(0, 2).join(" · ")}` : ""}`;
    });
    return { id: seq++, role: "bot", text: parts.join("\n\n"), source: "engine", focus: ids.map((id) => ({ id, status: r.decisions[id].status, headline: r.decisions[id].headline })) };
  }

  function applyAndReport(updates: Update[], source: Msg["source"], model?: string): Msg {
    const { changes, after } = ws.addUpdates(updates, `Update from chat: ${updates.map((u) => `${u.appId} ${FIELD_LABEL[u.field]} = ${u.value}`).join("; ")}`);
    const applied = after ? after.applied.slice(-updates.length) : [];
    const ids = [...new Set(updates.map((u) => u.appId))];
    const focus = after ? ids.filter((id) => after.result.decisions[id]).map((id) => ({ id, status: after.result.decisions[id].status, headline: after.result.decisions[id].headline })) : [];
    const moved = changes.filter((c) => !ids.includes(c.id));
    const main = changes.filter((c) => ids.includes(c.id));
    let summary = main.length ? `Re-ran every check. ${main.map((c) => `${c.id}: ${c.from && STATUS_META[c.from].label} → ${c.to && STATUS_META[c.to].label}${c.toAlloc && c.toAlloc !== c.fromAlloc ? ` (${c.toAlloc})` : ""}`).join("; ")}.` : "Re-ran every check — the recommendation did not change.";
    if (moved.length) summary += ` Knock-on effect on ${moved.length} other applicant${moved.length > 1 ? "s" : ""}.`;
    if (after) for (const id of ids) {
      const d = after.result.decisions[id];
      if (d) summary += `\n\n**${id} now:** ${d.explanation}`;
    }
    return { id: seq++, role: "bot", text: summary, source, model, applied, changes, focus, undoable: true };
  }

  async function send(raw: string) {
    const t = raw.trim();
    if (!t || !result || !input || busy) return;
    setText("");
    setMsgs((m) => [...m, { id: seq++, role: "user", text: t }]);
    const known = result.order;
    const p = parseMessage(t, known, names);

    if (p.confident && p.kind === "update") return setMsgs((m) => [...m, applyAndReport(p.updates, "engine")]);
    if (p.confident && p.kind === "explain") return setMsgs((m) => [...m, engineAnswer(p.appIds)]);
    if (p.confident && p.kind === "list" && p.filter?.status) {
      const st = statusFromWord(p.filter.status);
      if (st) {
        const ids = result.order.filter((id) => result.decisions[id].status === st);
        const body = ids.length ? ids.map((id) => `• ${id} ${names[id] ?? ""} — ${result.decisions[id].headline}`).join("\n") : "None.";
        return setMsgs((m) => [...m, { id: seq++, role: "bot", text: `${ids.length} applicant${ids.length === 1 ? "" : "s"} on ${STATUS_META[st].label}:\n${body}`, source: "engine" }]);
      }
    }

    setBusy(true);
    try {
      const history = msgs.slice(-6).map((m) => ({ role: m.role, text: m.text }));
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t, data: buildContext(result, input, p.appIds), history }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "AI unavailable");
      const ups: Update[] = (j.updates ?? [])
        .filter((u: { appId: string; field: string }) => known.includes(u.appId) && UPDATE_FIELDS.includes(u.field as UpdateField))
        .map((u: { appId: string; field: UpdateField; value: string }) => ({ appId: u.appId, field: u.field, value: u.value, source: "ai" as const, text: t }));
      if (j.intent === "update" && ups.length) setMsgs((m) => [...m, applyAndReport(ups, "ai", j.model)]);
      else {
        const ids: string[] = (j.appIds ?? []).filter((id: string) => known.includes(id));
        setMsgs((m) => [...m, { id: seq++, role: "bot", text: j.answer || "I couldn't find that in the records.", source: "ai", model: j.model, focus: ids.slice(0, 6).map((id) => ({ id, status: result.decisions[id].status, headline: result.decisions[id].headline })) }]);
      }
    } catch {
      const st = p.filter?.status ? statusFromWord(p.filter.status) : null;
      if (st) {
        const ids = result.order.filter((id) => result.decisions[id].status === st);
        setMsgs((m) => [...m, { id: seq++, role: "bot", source: "fallback", text: ids.length ? ids.map((id) => `• ${id} ${names[id] ?? ""} — ${result.decisions[id].headline} ${result.decisions[id].nextSteps[0] ?? ""}`).join("\n") : "None." }]);
      } else if (p.appIds.length) setMsgs((m) => [...m, { ...engineAnswer(p.appIds), source: "fallback" }]);
      else
        setMsgs((m) => [
          ...m,
          { id: seq++, role: "bot", source: "fallback", text: "The AI helper is busy right now, so I can only answer questions that name an application. Try “Why is APP-007 on hold?”, or give new information such as “APP-012 has found a ground-floor space”." },
        ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">Ask or update</div>
        <div className="text-xs text-slate-500">Ask why, or tell it something new. It re-checks everyone and shows what changed.</div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500">Try:</div>
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50">
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-8 rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-sm text-white">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="mr-2 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
              {m.applied && m.applied.length > 0 && (
                <div className="mb-2 space-y-1 rounded-lg bg-slate-50 p-2 text-xs">
                  {m.applied.map((a, i) => (
                    <div key={i} className={a.ok ? "text-slate-700" : "text-rose-700"}>
                      <span className="font-mono">{a.appId}</span> · {FIELD_LABEL[a.field as UpdateField] ?? a.field}: {a.ok ? (
                        <>
                          <s className="text-slate-400">{a.before}</s> → <b>{a.after}</b>
                        </>
                      ) : (
                        `not applied (${a.error})`
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Rich text={m.text} />
              {m.changes && m.changes.length > 0 && (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What changed</div>
                  <ChangeList changes={m.changes} onOpen={onOpen} />
                </div>
              )}
              {m.focus && m.focus.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.focus.map((f) => (
                    <button key={f.id} onClick={() => onOpen(f.id)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs hover:border-indigo-300">
                      <span className="font-mono">{f.id}</span>
                      <StatusChip status={f.status} />
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                <span>{m.source === "engine" ? "Answered from the engine record" : m.source === "ai" ? `Read by AI (${m.model ?? "Gemini"}) · grounded in engine records` : "AI busy · answered from engine record"}</span>
                {m.undoable && m === [...msgs].reverse().find((x) => x.undoable) && ws.state.updates.length > 0 && (
                  <button onClick={() => { ws.undoLastUpdate(); setMsgs((all) => [...all, { id: seq++, role: "bot", text: "Undone — the update was removed and every recommendation recalculated.", source: "engine" }]); }} className="ml-auto rounded px-1.5 py-0.5 normal-case tracking-normal text-indigo-600 hover:bg-indigo-50">
                    Undo
                  </button>
                )}
              </div>
            </div>
          ),
        )}
        {busy && <div className="mr-2 animate-pulse rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400">Reading your message…</div>}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="border-t border-slate-200 p-3"
      >
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Why is APP-007 on hold?" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          <button disabled={busy || !text.trim()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 whitespace-pre-wrap leading-relaxed">
      {text.split("\n\n").map((para, i) => (
        <p key={i}>
          {para.split(/(\*\*[^*]+\*\*)/g).map((seg, k) => (seg.startsWith("**") ? <b key={k} className="text-slate-900">{seg.slice(2, -2)}</b> : <span key={k}>{seg}</span>))}
        </p>
      ))}
    </div>
  );
}
