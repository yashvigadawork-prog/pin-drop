"use client";

import { useState, type CSSProperties } from "react";
import { Checklist, Gantt } from "./Checklist";
import { Ic } from "./Icon";
import { Chip, Ring, useUi, type DrawerTab } from "./kit";
import { fmtDate } from "@/lib/engine/engine";
import { ctxFromRow, defaultMailType, mailFor } from "@/lib/desk/mail";
import { readPaste } from "@/lib/desk/paste";
import { SIGNAL_LABEL, MAIL_LABEL, UI_META } from "@/lib/desk/types";
import { ago } from "@/lib/desk/time";
import type { Row } from "@/lib/desk/model";

const TABS: [DrawerTab, string, string][] = [
  ["why", "target", "Why"],
  ["plan", "clock", "Plan"],
  ["facts", "file", "Facts"],
];

function sentences(x: string): string[] {
  return x.replace(/\s+/g, " ").split(/(?<=[.])\s+(?=[A-Z₹])/).filter((s) => s.length > 3).slice(0, 6);
}
const box: CSSProperties = { boxShadow: "none" };

export function Drawer({ id, tab, setTab, paste, onClose }: { id: string; tab: DrawerTab; setTab: (t: DrawerTab) => void; paste?: string; onClose: () => void }) {
  const ui = useUi();
  const { ws, now } = ui;
  const { rows, desk, result } = ws;
  const r = rows.find((x) => x.id === id);
  if (!r || !result) return null;
  const isP = r.ui === "adv" || r.ui === "redir";
  const onb = desk.onb[id];
  const dst = r.moved === "onb" ? ["clip", "In Onboarding", "onboarding"] : r.moved === "exp" ? ["globe", "On Expansion list", "expansion"] : null;
  const tags: React.ReactNode[] = [];
  if (r.tag === "pin" && r.ui === "info") tags.push(<span key="p" className="tag warn"><Ic n="alert" />Pin needs a look</span>);
  if (r.tag === "dup") tags.push(<span key="d" className="tag warn">Duplicate</span>);
  if (r.locked) tags.push(<span key="l" className="tag"><Ic n="lock" />Pin locked</span>);
  const pin = r.app.pin;
  const near = pin && desk.mods.near ? (ws.input?.stores ?? []).find((st) => st.pin !== pin && st.pin.slice(0, 5) === pin.slice(0, 5)) : undefined;
  if (near) tags.push(<span key="n" className="tag warn" title="Pin numbers close together are usually close on the map. A proxy until real map data."><Ic n="pin" />Near {near.id} · {near.pin}</span>);
  if (r.d.alternatives[0] && desk.mods.fmt && r.ui !== "adv") tags.push(<span key="a" className="tag"><Ic n="layers" />{r.d.alternatives[0]}</span>);

  return (
    <aside className="drawer" role="dialog" aria-label={r.app.name}>
      <div className="dhead">
        <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
          <Ring v={r.fit} size={58} sw={6} s={r.ui} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono muted" style={{ fontSize: 11.5 }}>{r.id} · sheet row {r.app.rowNumber}</div>
            <h2 style={{ fontSize: 22 }}>{r.app.name}</h2>
            <div className="muted">{r.app.city ?? r.app.cityRaw} · {r.app.pin ?? r.app.pinRaw} · {r.app.investment !== null ? `₹${r.app.investment}L` : "no investment"}</div>
          </div>
          <button className="btn ghost sm round" aria-label="Close" onClick={onClose}><Ic n="x" /></button>
        </div>
        <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
          <Chip s={r.ui} />
          {tags}
        </div>
        <div className="tabs" role="tablist">
          {TABS.map(([k, ic, l]) => (
            <button key={k} className={tab === k ? "on" : ""} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}><Ic n={ic} />{l}</button>
          ))}
        </div>
      </div>
      <div className="dbody">
        {tab === "why" && (
          <>
            <WhyTab r={r} />
            <ScoreTab r={r} />
          </>
        )}
        {tab === "plan" && (
          <>
            <PlanTab r={r} isP={isP} />
            {isP || onb ? (
              <div className="card" style={box}>
                <h3><Ic n="shield" />Checks before the agreement{!onb && <><span className="sp" /><span className="tag">Starts after the next-steps email</span></>}</h3>
                <Checklist o={onb ?? (desk.extras[id] ? { stage: 0, since: "", holdUntil: "", chk: desk.extras[id] } : undefined)} mods={desk.mods} id={id} />
                {onb && <button className="btn" style={{ marginTop: 10 }} onClick={() => ui.go("onboarding", { onb: id })}><Ic n="clip" />Open in Onboarding</button>}
              </div>
            ) : null}
            <EmailsTab r={r} now={now} />
          </>
        )}
        {tab === "facts" && <FactsTab key={id + (paste ?? "")} r={r} initial={paste ?? ""} />}
      </div>
      <div className="dfoot">
        {dst ? (
          <button className="btn primary" onClick={() => ui.go(dst[2] as "onboarding" | "expansion", { onb: id })}><Ic n={dst[0]} />{dst[1]} →</button>
        ) : isP ? (
          <button className="btn primary" onClick={() => ui.mail(id)}><Ic n="send" />Email next steps</button>
        ) : (
          <button className="btn primary" onClick={() => ui.mail(id)}><Ic n="mail" />{MAIL_LABEL[defaultMailType(r.ui, r.tag)]}</button>
        )}
        {!dst && <button className="btn" onClick={() => ui.move([id])}><Ic n="move" />Move to…</button>}
        {isP && !dst && <button className="btn" onClick={() => ws.toggleLock(id)}><Ic n="lock" />{r.locked ? "Unlock pin" : "Lock pin"}</button>}
        <span className="sp" />
        <button className="btn ghost" onClick={() => ui.chat(`Why is ${id} ${UI_META[r.ui].label.toLowerCase()}?`)}><Ic n="msg" />Ask</button>
      </div>
    </aside>
  );
}

function WhyTab({ r }: { r: Row }) {
  const ui = useUi();
  const { ws } = ui;
  const d = r.d;
  const seen = new Set<string>();
  const sg = d.signals.filter((s) => {
    const k = s.kind + s.quote;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const comp = d.competition;
  const same = comp ? ws.rows.filter((x) => x.d.competition?.territoryId === comp.territoryId && x.ui !== "exp").sort((a, b) => b.fit - a.fit).slice(0, 7) : [];
  return (
    <>
      <div className="card" data-s={r.ui} style={box}>
        <div className="eyebrow">Recommendation{r.move ? " · your call" : ""}</div>
        <p style={{ fontSize: 17, fontWeight: 600, margin: "6px 0 0", fontFamily: "var(--f-display)" }}>{r.move ? r.why : d.headline}</p>
        {r.move && (
          <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
            <span className="tag"><Ic n="move" />Engine said {UI_META[r.engine].label}</span>
            <button className="btn sm" onClick={() => ws.resetMove(r.id)}><Ic n="undo" />Reset to engine</button>
          </div>
        )}
        {r.slotPin && (r.ui === "adv" || r.ui === "redir") && (
          <div className="row" style={{ marginTop: 10 }}><Ic n="pin" /><b>{r.slotTerr} · {r.slotPin}</b>{d.plan && <span className="muted">· opens {fmtDate(d.plan.plannedOpen)}</span>}</div>
        )}
      </div>

      {(d.challenges?.length ?? 0) > 0 && (
        <div className="card" data-s="redir" style={box}>
          <div className="eyebrow">Also strong enough for a neighbouring pin</div>
          <p className="muted" style={{ margin: "4px 0 8px" }}>They lost their own pin, but they score well above the person holding these. You decide.</p>
          <div className="stack" style={{ gap: 8 }}>
            {d.challenges!.map((c) => (
              <div key={c.pin} className="row wrap" style={{ gap: 8 }}>
                <span className="tag mono"><Ic n="pin" />{c.pin}</span>
                <span style={{ flex: 1, minWidth: 160 }}>Beats {c.vsName} by <b>{c.margin}</b> points ({c.myScore} vs {c.vsScore}).</span>
                <button className="btn sm primary" onClick={() => { ws.offerPin(r.id, c.territoryId, c.pin); ui.toast(`${r.app.name.split(" ")[0]} offered pin ${c.pin}`); }}><Ic n="repeat" />Offer this pin</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={box}>
        <h3><Ic n="book" />In plain words</h3>
        <ul className="plain">{sentences(d.explanation).map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>

      <div className="card" style={box}>
        <h3><Ic n="shield" />The five gates</h3>
        <div className="stack" style={{ gap: 8 }}>
          {d.gates.map((g, i) => {
            const k = g.state === "pass" ? "p" : g.state === "attention" ? "a" : "f";
            const label = ["Application", "Place", "Partner", "Premises", "Pace"][i] ?? g.gate;
            return (
              <div key={g.gate} className="row gate2" data-g={k} style={{ gap: 10, alignItems: "flex-start" }}>
                <span className="g"><Ic n={k === "p" ? "check" : k === "a" ? "alert" : "x"} /></span>
                <div><b>{label}</b><div className="muted" style={{ fontSize: 12.5 }}>{g.summary}</div></div>
              </div>
            );
          })}
        </div>
      </div>

      {d.issues.length > 0 && (
        <div className="card" style={box}>
          <h3><Ic n="alert" />Flags</h3>
          <div className="stack" style={{ gap: 10 }}>
            {d.issues.map((i, k) => (
              <div key={k} className="flagrow">
                <div className="row" style={{ gap: 6, alignItems: "flex-start" }}>
                  <span className={`tag${i.severity === "info" ? "" : " warn"}`}>{i.severity === "block" ? "Blocks" : i.severity === "warn" ? "Watch" : "Note"}</span>
                  <span>{i.message}</span>
                </div>
                {i.fix && <div className="muted" style={{ fontSize: 12.5, margin: "3px 0 0 4px" }}>To clear: {i.fix}</div>}
                {i.evidence && <div className="quote">“{i.evidence}”</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {sg.length > 0 && (
        <div className="card" style={box}>
          <h3><Ic n="msg" />In their own words</h3>
          <div className="stack" style={{ gap: 8 }}>
            {sg.map((s, i) => (
              <div key={i}>
                <div className="eyebrow">{SIGNAL_LABEL[s.kind] ?? s.kind}</div>
                <div className="quote">“{s.quote}”</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.requiredCapital !== null && (
        <div className="card" style={box}>
          <h3><Ic n="wallet" />Capital</h3>
          <div className="row" style={{ gap: 10 }}>
            <b className="mono">₹{d.effectiveCapital ?? "?"}L</b>
            <span className="meter" style={{ flex: 1 }}><i className="grow-x" style={{ width: `${Math.min(100, ((d.effectiveCapital ?? 0) / d.requiredCapital) * 100)}%`, background: (d.effectiveCapital ?? 0) >= d.requiredCapital ? "var(--s-adv)" : "var(--s-wait)" }} /></span>
            <span className="muted">needs ₹{d.requiredCapital}L</span>
          </div>
        </div>
      )}

      {comp && (
        <div className="card" style={box}>
          <h3><Ic n="users" />Competition in {comp.territoryId}</h3>
          <p className="muted" style={{ marginBottom: 8 }}>
            #{comp.rank} of {comp.contenders} for {comp.capacity} slot{comp.capacity === 1 ? "" : "s"}
            {comp.beatenBy?.length ? `. Ahead of them: ${comp.beatenBy.map((b) => `${b.id} (${Math.round(b.score)})`).join(", ")}` : ""}.
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {same.map((x, i) => (
              <div key={x.id} className="row" data-s={x.ui} style={{ gap: 10 }}>
                <span style={{ width: 92, fontWeight: x.id === r.id ? 700 : 500 }}>{x.app.name.split(" ")[0]}</span>
                <span className="meter" style={{ flex: 1 }}><i className="grow-x" style={{ "--i": i, width: `${x.fit}%` } as CSSProperties} /></span>
                <b className="mono">{x.fit}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {r.asks.length > 0 && (
        <div className="card" style={box}>
          <h3><Ic n="help" />Decision changes if</h3>
          <div className="stack" style={{ gap: 8 }}>
            {r.asks.map((q, i) => <div key={i} className="row" data-s="info" style={{ gap: 8, alignItems: "flex-start" }}><span className="dot" style={{ marginTop: 6 }} /><span>{q}</span></div>)}
          </div>
        </div>
      )}

      <div className="card" style={box}>
        <h3><Ic n="arrow" />What happens next</h3>
        <ol className="plain">
          {d.nextSteps.slice(0, 5).map((t, i) => {
            const p = t.split(" — ");
            return <li key={i}><b>{p[0]}</b>{p[1] && <div className="muted" style={{ fontSize: 12.5 }}>{p[1]}</div>}</li>;
          })}
        </ol>
      </div>
    </>
  );
}

function ScoreTab({ r }: { r: Row }) {
  const { ws } = useUi();
  const w = ws.result!.config.weights;
  const s = r.d.score;
  if (!s) return <div className="card muted" style={{ ...box, textAlign: "center", padding: 30 }}>No score for this applicant yet.</div>;
  const parts: [string, number, number, string[]][] = [
    ["Partner", s.partner, w.partner, s.notes.partner],
    ["Premises", s.premises, w.premises, s.notes.premises],
    ["Place", s.place, w.place, s.notes.place],
    ["Pace", s.pace, w.pace, s.notes.pace],
  ];
  const sum = w.partner + w.premises + w.place + w.pace || 1;
  const tot = parts.reduce((a, p) => a + p[1] * p[2], 0) / sum;
  return (
    <>
      {r.offer !== undefined ? (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="card row" style={{ ...box, gap: 12 }}><Ring v={r.fit} size={56} sw={6} s={r.ui} /><div><b>Fit at the pin they asked for</b><div className="muted" style={{ fontSize: 12 }}>What ranks them for their own pin</div></div></div>
          <div className="card row" style={{ ...box, gap: 12 }}><Ring v={r.offer} size={56} sw={6} /><div><b>If moved to another pin</b><div className="muted" style={{ fontSize: 12 }}>They would need a new site, so it is lower</div></div></div>
        </div>
      ) : (
        <div className="card row" style={{ ...box, gap: 14 }}><Ring v={r.fit} size={64} sw={7} s={r.ui} /><div><b>Fit score</b><div className="muted">Ranks people for the same slots. It never overrides a hard rule.</div></div></div>
      )}
      <div className="card" style={box}>
        <h3><Ic n="sliders" />How it adds up · ranking {ws.result!.config.phaseName}</h3>
        <div className="stack" style={{ gap: 14 }}>
          {parts.map(([l, v, wt, notes], i) => (
            <div key={l}>
              <div className="row"><b>{l}</b><span className="sp" /><span className="mono muted">{Math.round(v * 100)}% × weight {wt} = <b style={{ color: "var(--ink)" }}>{Math.round(((v * wt) / sum) * 1000) / 10}</b></span></div>
              <div className="meter" style={{ margin: "5px 0" }}><i className="grow-x" style={{ "--i": i, width: `${v * 100}%`, background: "var(--accent)" } as CSSProperties} /></div>
              <ul className="plain muted" style={{ fontSize: 12.5 }}>{notes.map((n, k) => <li key={k}>{n}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)" }}><b>Total</b><span className="sp" /><b className="mono" style={{ fontSize: 16 }}>{Math.round(tot * 1000) / 10} / 100</b></div>
      </div>
    </>
  );
}

function PlanTab({ r, isP }: { r: Row; isP: boolean }) {
  const plan = r.d.plan;
  if (!isP || !plan) return <div className="card muted" style={{ ...box, textAlign: "center", padding: 30 }}><Ic n="clock" /><p style={{ marginTop: 8 }}>The plan appears once this person moves to Proceed.</p></div>;
  const t = plan.training;
  return (
    <>
      <div className="card" style={box}>
        <h3><Ic n="clock" />Path to opening · {fmtDate(plan.plannedOpen)}</h3>
        <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
          <span className="tag">{plan.feasibleMonths} months earliest</span>
          {plan.payback && <span className="tag">~{plan.payback.months} months payback</span>}
        </div>
        <Gantt row={r} />
      </div>
      <div className="card" style={box}>
        <h3><Ic n="users" />How they are prepared</h3>
        <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
          <span className="tag"><Ic n="msg" />{t.languages.join(" + ")}</span>
          <span className="tag"><Ic n="clock" />{t.shadowDays} shadow days</span>
          {t.extended && <span className="tag warn">Extended track</span>}
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>Mentor store: {t.mentorStore.id} · {t.mentorStore.why}</div>
        {t.languageNote && <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{t.languageNote}</div>}
        <div className="stack" style={{ gap: 4 }}>
          {t.modules.map((m) => <div key={m.name} className="row" style={{ gap: 8, fontSize: 13 }}><span style={{ flex: 1 }}>{m.name}</span><span className="muted" style={{ fontSize: 12 }}>{m.mode}</span><b className="mono">{m.days}d</b></div>)}
        </div>
      </div>
      {plan.conditions.length > 0 && (
        <div className="card" style={box}>
          <h3><Ic n="alert" />Conditions</h3>
          <ul className="plain">{plan.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
    </>
  );
}

function EmailsTab({ r, now }: { r: Row; now: number }) {
  const ui = useUi();
  const { ws } = ui;
  const type = defaultMailType(r.ui, r.tag);
  const m = mailFor(ctxFromRow(r), type);
  const log = ws.desk.mailLog[r.id] ?? [];
  const [note, setNote] = useState(ws.desk.notes[r.id] ?? "");
  return (
    <>
      <div className="row wrap" style={{ gap: 6 }}><span className="eyebrow">Next draft</span><span className="tag">{MAIL_LABEL[type]}</span><span className="tag">English</span></div>
      <div className="mail">
        <div className="muted">To: {m.to}</div>
        <div className="sub">{m.sub}</div>
        <div dangerouslySetInnerHTML={{ __html: m.html }} />
      </div>
      <div className="card" style={box}>
        <h3><Ic n="history" />Sent so far</h3>
        {log.length ? log.map((l, i) => <div key={i} className="row" style={{ gap: 8, padding: "4px 0" }}><span className="tag"><Ic n="check" />{MAIL_LABEL[l.type]}</span><span className="muted">{ago(l.at, now)}</span></div>) : <div className="muted">Nothing sent yet.</div>}
      </div>
      <div className="card" style={box}>
        <h3><Ic n="edit" />Your notes</h3>
        <textarea className="paste" placeholder="Private notes. Only your team sees these." value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { ws.saveNote(r.id, note); ui.toast("Note saved"); }}>Save note</button>
      </div>
    </>
  );
}

function FactsTab({ r, initial }: { r: Row; initial: string }) {
  const ui = useUi();
  const { ws } = ui;
  const [text, setText] = useState(initial);
  const [read, setRead] = useState<ReturnType<typeof readPaste> | null>(initial ? readPaste(initial) : null);
  const a = r.app;
  const need = r.d.requiredCapital;
  const facts: [string, string][] = [
    ["Investment", a.investment !== null ? `₹${a.investment}L${need ? ` of ₹${need}L needed` : ""}` : "Blank"],
    ["Experience", a.experience !== null ? `${a.experience} yrs` : "Blank"],
    ["Space", `${a.space ?? "Unknown"}${a.sizeSqft ? ` · ${a.sizeSqft} sq ft` : ""}${a.floor ? ` · ${a.floor}` : ""}`],
    ["Language", a.languages.join(", ") || "Not given"],
    ["Business", a.business || "Not given"],
    ["Target launch", a.targetMonths !== null ? `${a.targetMonths} months` : "Not given"],
  ];
  const example = r.ui === "info" ? "Hi, I found a ground floor shop, 450 sq ft, same pin on the main road. My FD of ₹4 lakh can be used." : "Hi, I can invest ₹3 lakh more from my FD.";
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
        {facts.map(([k, v]) => <div key={k} className="card" style={{ ...box, padding: "10px 12px" }}><div className="eyebrow">{k}</div><div style={{ fontWeight: 600 }}>{v}</div></div>)}
      </div>
      {a.notes && <div className="card" style={box}><div className="eyebrow">Their notes</div><div className="quote">“{a.notes}”</div></div>}
      <div className="card" style={box}>
        <h3><Ic n="spark" />Paste anything</h3>
        <p className="muted" style={{ marginBottom: 8 }}>An email, a WhatsApp reply, a note. We fill the fields and re-check everyone.</p>
        <textarea className="paste" placeholder="Paste text here" value={text} onChange={(e) => { setText(e.target.value); setRead(null); }} />
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="btn sm primary" onClick={() => setRead(readPaste(text))}><Ic n="zap" />Read it</button>
          <button className="btn sm" onClick={() => { setText(example); setRead(readPaste(example)); }}>Use example reply</button>
        </div>
        {read && (
          <>
            <div className="field" style={{ marginTop: 12 }}>
              {read.fields.length ? read.fields.map(([k, v], i) => <div key={k} className="f" style={{ "--i": i } as CSSProperties}><b>{k}</b>{v}</div>) : <span className="muted">Nothing to fill from this text.</span>}
            </div>
            {read.updates.length > 0 && (
              <button className="btn primary" style={{ marginTop: 12 }} onClick={() => {
                const res = ws.applyReply(r.id, text);
                ui.toast(res.changes.length ? `${res.changes.length} recommendation${res.changes.length === 1 ? "" : "s"} changed` : "Saved. No change to any decision.");
                setText("");
                setRead(null);
              }}><Ic n="check" />Apply and re-check everyone</button>
            )}
          </>
        )}
      </div>
    </>
  );
}
