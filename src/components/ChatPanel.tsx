"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Ic } from "./Icon";
import { ChangeList, useUi } from "./kit";
import { deskAnswer } from "@/lib/desk/answer";
import { parseMessage } from "@/lib/engine/nlu";
import { FIELD_LABEL, UPDATE_FIELDS, type Update, type UpdateField } from "@/lib/engine/updates";
import type { Change, EngineInput, EngineResult } from "@/lib/engine/types";
import { UI_META, type UiStatus } from "@/lib/desk/types";

interface Msg {
  id: number;
  role: "user" | "bot";
  text: string;
  source?: "engine" | "ai" | "fallback";
  model?: string;
  applied?: { appId: string; field: string; before: string; after: string; ok: boolean; error?: string }[];
  changes?: Change[];
  focus?: string[];
  undoable?: boolean;
}

let seq = 1;

/** What we send to the AI. For big files it gets totals plus full records only for the applicants named. */
function buildContext(result: EngineResult, input: EngineInput, focusIds: string[]) {
  const apps = Object.fromEntries(input.applications.map((a) => [a.id, a]));
  const full = new Set(focusIds);
  const many = result.order.length > 40;
  const fullRec = (id: string) => {
    const d = result.decisions[id];
    const a = apps[id];
    return {
      id, name: a.name, city: a.city ?? a.cityRaw, pin: a.pin ?? a.pinRaw, status: d.status, headline: d.headline, score: d.score?.total, slot: d.allocation ? `${d.allocation.territoryId}/${d.allocation.pin}` : null,
      explanation: d.explanation,
      nextSteps: d.nextSteps.slice(0, 4),
      issues: d.issues.filter((i) => i.severity !== "info").map((i) => i.message),
      facts: { investmentLakh: a.investment, extraLakh: a.extra.extraCapital, requiredLakh: d.requiredCapital, experienceYrs: a.experience, space: a.space, sqft: a.sizeSqft, floor: a.floor, targetMonths: a.targetMonths, languages: a.languages, business: a.business, notes: a.notes },
      competition: d.competition,
    };
  };
  const records = many ? [...full].filter((id) => apps[id]).slice(0, 12).map(fullRec) : result.order.map(fullRec);
  const counts: Record<string, number> = {};
  for (const id of result.order) counts[result.decisions[id].status] = (counts[result.decisions[id].status] ?? 0) + 1;
  const territories = result.territories.map((t) => ({ id: t.territory.id, city: t.territory.city, priority: t.territory.priority, realCapacity: t.capacity, allocated: t.allocated.map((a) => `${a.appId}:${a.pin}`), freePins: t.freePins }));
  return JSON.stringify({ totals: { applications: result.order.length, byStatus: counts }, weights: result.config.weights, phase: result.config.phaseName, minCapitalLakh: result.config.minCapital, applications: records, territories });
}

function Rich({ text }: { text: string }): ReactNode {
  const ui = useUi();
  return (
    <>
      {text.split("\n\n").map((para, i) => (
        <p key={i} style={{ whiteSpace: "pre-line" }}>
          {para.split(/(\*\*[^*]+\*\*|APP-\d{3}(?:-R\d+)?)/g).map((seg, k) =>
            seg.startsWith("**") ? <b key={k}>{seg.slice(2, -2)}</b> : /^APP-\d{3}/.test(seg) && ui.ws.rows.some((r) => r.id === seg) ? <button key={k} className="lnk" onClick={() => ui.open(seg)}>{seg}</button> : <span key={k}>{seg}</span>,
          )}
        </p>
      ))}
    </>
  );
}

export function ChatPanel({ seed, onClose }: { seed: { text: string; n: number } | null; onClose: () => void }) {
  const ui = useUi();
  const { ws, now } = ui;
  const { result, input, rows, desk } = ws;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const done = useRef<number | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);
  useEffect(() => {
    if (seed && done.current !== seed.n) {
      done.current = seed.n;
      void send(seed.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.n]);

  const suggestions = useMemo(() => {
    const s = ["Top 5", "What is the bottleneck?"];
    const info = rows.find((r) => r.ui === "info");
    if (info) s.unshift(`Why is ${info.id} on hold?`);
    const wait = rows.find((r) => r.ui === "wait");
    const adv = rows.find((r) => r.ui === "adv");
    if (wait && adv) s.push(`Compare ${adv.id} and ${wait.id}`);
    s.push("How many in Bengaluru?");
    return s.slice(0, 5);
  }, [rows]);
  const names = useMemo(() => Object.fromEntries((input?.applications ?? []).map((a) => [a.id, a.name])), [input]);

  const bot = (m: Omit<Msg, "id" | "role">) => setMsgs((all) => [...all, { id: seq++, role: "bot", ...m }]);

  function engineAnswer(ids: string[], source: Msg["source"] = "engine") {
    const parts = ids.map((id) => {
      const r = rows.find((x) => x.id === id);
      const d = result!.decisions[id];
      return `**${id} — ${r ? UI_META[r.ui].label : ""}.** ${d.explanation}${d.nextSteps.length ? `\nNext: ${d.nextSteps.slice(0, 2).join(" · ")}` : ""}`;
    });
    bot({ text: parts.join("\n\n"), source, focus: ids });
  }

  function applyAndReport(updates: Update[], source: Msg["source"], model?: string) {
    const { changes, after } = ws.addUpdates(updates, `Update from chat: ${updates.map((u) => `${u.appId} ${FIELD_LABEL[u.field]} = ${u.value}`).join("; ")}`);
    const applied = after ? after.applied.slice(-updates.length) : [];
    const ids = [...new Set(updates.map((u) => u.appId))];
    const moved = changes.filter((c) => !ids.includes(c.id));
    const main = changes.filter((c) => ids.includes(c.id));
    let summary = main.length ? `Re-ran every check. ${main.map((c) => `${c.id}: ${c.from ?? ""} → ${c.to ?? ""}${c.toAlloc && c.toAlloc !== c.fromAlloc ? ` (${c.toAlloc})` : ""}`).join("; ")}.` : "Re-ran every check. The recommendation did not change.";
    if (moved.length) summary += ` Knock-on effect on ${moved.length} other applicant${moved.length > 1 ? "s" : ""}.`;
    if (after) for (const id of ids) if (after.result.decisions[id]) summary += `\n\n**${id} now:** ${after.result.decisions[id].explanation}`;
    bot({ text: summary, source, model, applied, changes, focus: ids, undoable: true });
  }

  async function send(raw: string) {
    const t = raw.trim();
    if (!t || !result || !input || busy) return;
    setText("");
    setMsgs((m) => [...m, { id: seq++, role: "user", text: t }]);
    const known = result.order;
    const p = parseMessage(t, known, names);

    if (p.confident && p.kind === "update") return applyAndReport(p.updates, "engine");
    const quick = deskAnswer(t, rows, desk, p.appIds.length ? p.appIds : [], now);
    if (quick) return bot({ text: quick.text, source: "engine", focus: quick.ids });
    if (p.confident && p.kind === "explain") return engineAnswer(p.appIds);

    setBusy(true);
    try {
      const history = msgs.slice(-6).map((m) => ({ role: m.role, text: m.text }));
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t, data: buildContext(result, input, p.appIds), history }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "AI unavailable");
      const ups: Update[] = (j.updates ?? [])
        .filter((u: { appId: string; field: string }) => known.includes(u.appId) && UPDATE_FIELDS.includes(u.field as UpdateField))
        .map((u: { appId: string; field: UpdateField; value: string }) => ({ appId: u.appId, field: u.field, value: u.value, source: "ai" as const, text: t }));
      if (j.intent === "update" && ups.length) applyAndReport(ups, "ai", j.model);
      else bot({ text: j.answer || "I couldn't find that in the records.", source: "ai", model: j.model, focus: (j.appIds ?? []).filter((id: string) => known.includes(id)).slice(0, 6) });
    } catch {
      if (p.appIds.length) engineAnswer(p.appIds, "fallback");
      else bot({ source: "fallback", text: "The AI helper is busy, so I can answer these without it: “Why is APP-007 on hold?”, “How many in Bengaluru?”, “Top 5”, “Who is on the waitlist?”, “Compare APP-001 and APP-002”, “What is the bottleneck?”. You can also give new facts, like “APP-012 has found a ground-floor space”." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="chat" aria-label="Ask Pin Drop">
      <div className="row" style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
        <span className="bucket"><span className="ic" style={{ width: 30, height: 30, fontSize: 15, color: "var(--accent)", background: "color-mix(in srgb,var(--accent) 14%,var(--surface))" }}><Ic n="spark" /></span></span>
        <b style={{ flex: 1 }}>Ask Pin Drop</b>
        <span className="tag">Answers from the records</span>
        <button className="btn ghost sm round" aria-label="Close" onClick={onClose}><Ic n="x" /></button>
      </div>
      <div className="msgs">
        {msgs.length === 0 && (
          <>
            <div className="muted">Ask about any applicant, a city or a status. Or tell it something new and it re-checks everyone.</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {suggestions.map((s) => <button key={s} className="fchip" onClick={() => void send(s)}>{s}</button>)}
            </div>
          </>
        )}
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="bub me">{m.text}</div>
          ) : (
            <div key={m.id} className="bub">
              {m.applied && m.applied.length > 0 && (
                <div className="stack" style={{ gap: 4, marginBottom: 8, fontSize: 12.5 }}>
                  {m.applied.map((a, i) => (
                    <div key={i}><span className="mono">{a.appId}</span> · {FIELD_LABEL[a.field as UpdateField] ?? a.field}: {a.ok ? <><s className="muted">{a.before}</s> → <b>{a.after}</b></> : `not applied (${a.error})`}</div>
                  ))}
                </div>
              )}
              <Rich text={m.text} />
              {m.changes && m.changes.length > 0 && (<><div className="eyebrow" style={{ marginTop: 8 }}>What changed</div><ChangeList changes={m.changes} onOpen={(id) => ui.open(id)} /></>)}
              {m.focus && m.focus.length > 0 && (
                <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                  {m.focus.slice(0, 6).map((id) => {
                    const r = rows.find((x) => x.id === id);
                    return r ? <button key={id} className="chip" data-s={r.ui as UiStatus} onClick={() => ui.open(id)}><span className="mono">{id}</span> {r.app.name.split(" ")[0]}</button> : null;
                  })}
                </div>
              )}
              <div className="row" style={{ gap: 8, marginTop: 8, fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                <span>{m.source === "engine" ? "From the records" : m.source === "ai" ? `Read by AI (${m.model ?? "Gemini"}), grounded in records` : "AI busy · from the records"}</span>
                {m.undoable && m === [...msgs].reverse().find((x) => x.undoable) && ws.state.updates.length > 0 && (
                  <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => { ws.undoLastUpdate(); bot({ text: "Undone. The update was removed and every recommendation recalculated.", source: "engine" }); }}><Ic n="undo" />Undo</button>
                )}
              </div>
            </div>
          ),
        )}
        {busy && <div className="bub muted">Reading your message…</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <input placeholder="e.g. Why is APP-007 on hold?" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn primary round" aria-label="Send" disabled={busy || !text.trim()}><Ic n="send" /></button>
      </form>
    </section>
  );
}

