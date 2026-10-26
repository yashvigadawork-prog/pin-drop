"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Ic } from "./Icon";
import { Chip, Ring, useUi, type ModalState, type ReviewBucket } from "./kit";
import { ctxFromExp, ctxFromRow, defaultMailType, mailFor, toText } from "@/lib/desk/mail";
import { active, byCity, freePins, type Row } from "@/lib/desk/model";
import { stageTimes, summaryLines } from "@/lib/desk/metrics";
import { MAIL_LABEL, UI_META, type MailType, type UiStatus } from "@/lib/desk/types";

function Shell({ title, eyebrow, onClose, children, foot, wide, sheet }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean; sheet?: boolean }) {
  return (
    <div className={`modal${wide ? " wide" : ""}${sheet ? " sheet" : ""}`} role="dialog" aria-label={title}>
      <div className="dhead" style={{ paddingBottom: 12 }}>
        <div className="row">
          <div style={{ flex: 1 }}>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2 style={{ fontSize: 19 }}>{title}</h2>
          </div>
          <button className="btn ghost sm round" aria-label="Close" onClick={onClose}><Ic n="x" /></button>
        </div>
      </div>
      <div className="dbody" style={{ gap: 8 }}>{children}</div>
      {foot && <div className="dfoot">{foot}</div>}
    </div>
  );
}

export function ModalHost({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  switch (modal.kind) {
    case "mail": return <MailModal id={modal.id} type={modal.type} onClose={onClose} />;
    case "review": return <ReviewModal b={modal.b} onClose={onClose} />;
    case "move": return <MoveModal ids={modal.ids} spot={modal.spot} target={modal.target} onClose={onClose} />;
    case "pin": return <PinModal pin={modal.pin} terr={modal.terr} onClose={onClose} />;
    case "store": return <StoreModal pin={modal.pin} onClose={onClose} />;
    case "stores": return <StoresModal onClose={onClose} />;
    case "summary": return <SummaryModal onClose={onClose} />;
    case "more": return <MoreSheet onClose={onClose} />;
  }
}

/* ---------- one email ---------- */
function MailModal({ id, type: t0, onClose }: { id: string; type?: MailType; onClose: () => void }) {
  const ui = useUi();
  const { ws } = ui;
  const r = ws.rows.find((x) => x.id === id);
  const e = ws.expList.find((x) => x.id === id);
  const type = t0 ?? (r ? defaultMailType(r.ui, r.tag) : "keep");
  const m = mailFor(r ? ctxFromRow(r) : e ? ctxFromExp(e) : { name: id, city: "", pin: "", asks: [], why: "" }, type);
  const [edit, setEdit] = useState(false);
  const [sub, setSub] = useState(m.sub);
  const [txt, setTxt] = useState(toText(m.html));
  const name = r?.app.name ?? e?.name ?? id;
  const moves = type === "next" || type === "offer";
  const send = async () => {
    const edited = edit && (sub !== m.sub || txt !== toText(m.html));
    onClose();
    const res = await ws.sendMail([{ id, type, edited, override: edited ? { sub, text: txt } : undefined }]);
    ui.toast(res.real ? (res.failed ? "Sending failed. Check the email setup." : `Sent to the test inbox for ${name}`) : `Sent to ${name}${moves ? ". Moved to Onboarding" : ""}`, moves ? { label: "Open", run: () => ui.go("onboarding", { onb: id }) } : undefined);
  };
  return (
    <Shell title={MAIL_LABEL[type]} eyebrow={`Email to ${name}`} onClose={onClose} foot={
      <>
        <button className="btn" onClick={() => setEdit(!edit)}><Ic n="edit" />{edit ? "Preview" : "Edit text"}</button>
        <span className="sp" />
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={send}><Ic n="send" />{ws.desk.emailMode === "demo" ? "Send (demo)" : "Send to test inbox"}</button>
      </>
    }>
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="tag"><Ic n="mail" />{m.to}</span>
        <span className="tag">English</span>
        <span className="tag">{ws.desk.emailMode === "demo" ? "Demo send: logged only" : "Real send: test inbox"}</span>
      </div>
      {edit ? (
        <>
          <input className="search" style={{ maxWidth: "none" }} aria-label="Subject" value={sub} onChange={(ev) => setSub(ev.target.value)} />
          <textarea className="paste" aria-label="Email text" style={{ minHeight: 220, borderStyle: "solid" }} value={txt} onChange={(ev) => setTxt(ev.target.value)} />
        </>
      ) : (
        <div className="mail"><div className="sub">{m.sub}</div><div dangerouslySetInnerHTML={{ __html: m.html }} /></div>
      )}
      <div className="muted" style={{ fontSize: 12.5 }}>
        {moves ? `Sending moves ${name.split(" ")[0]} to Onboarding and holds the pin for ${ws.desk.guard.hold} days.` : type === "notnow" ? "Sending closes the application. They stay on file." : "They stay in your Pipeline."}
      </div>
    </Shell>
  );
}

/* ---------- review a whole bucket ---------- */
interface Item { id: string; name: string; city: string; pin: string; s: UiStatus; why: string; type: MailType; row?: Row; area?: string }
function itemsFor(b: ReviewBucket, ws: ReturnType<typeof useUi>["ws"], expCity: string): Item[] {
  const { rows, desk, expList } = ws;
  const act = active(rows);
  const fromRow = (r: Row, type: MailType, why = r.why): Item => ({ id: r.id, name: r.app.name, city: r.app.city ?? r.app.cityRaw, pin: r.slotPin ?? r.app.pin ?? r.app.pinRaw, s: r.ui, why, type, row: r });
  if (b === "proceed") return act.filter((r) => r.ui === "adv" || r.ui === "redir").sort((a, c) => c.fit - a.fit).map((r) => fromRow(r, defaultMailType(r.ui)));
  if (b === "info") return act.filter((r) => r.ui === "info" && !desk.mail[r.id]).map((r) => fromRow(r, defaultMailType(r.ui, r.tag), r.asks[0] ?? r.why));
  if (b === "wait") return act.filter((r) => r.ui === "wait" && !desk.mail[r.id]).map((r) => fromRow(r, "line"));
  if (b === "later" || b === "fresh") {
    const exp = rows.filter((r) => r.ui === "exp" && !desk.onb[r.id] && !desk.mail["exp:" + r.id]).map((r) => fromRow(r, "keep"));
    const no = b === "later" ? act.filter((r) => r.ui === "no" && !desk.mail[r.id]).map((r) => fromRow(r, "notnow")) : [];
    return [...exp, ...no];
  }
  return expList.filter((e) => e.city === expCity && !desk.mail["exp2:" + e.id]).map((e) => ({ id: e.id, name: e.name, city: e.city, pin: e.pin, s: "exp" as UiStatus, why: e.reason, type: "exp2" as MailType, area: expCity }));
}
const REVIEW_TITLE: Record<ReviewBucket, string> = { proceed: "Waiting for your yes", info: "Ask for missing details", wait: "Tell them they are in line", later: "Not now, kept for later", fresh: "Keep on file", exp2: "We're expanding" };

function ReviewModal({ b, onClose }: { b: ReviewBucket; onClose: () => void }) {
  const ui = useUi();
  const { ws, nav } = ui;
  const list = itemsFor(b, ws, nav.expCity);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);
  const chosen = list.filter((x) => !off[x.id]);
  const send = async () => {
    const items = chosen.map((x) => ({ id: x.id, type: x.type, area: x.area }));
    onClose();
    const res = await ws.sendMail(items);
    const moved = items.some((i) => i.type === "next" || i.type === "offer");
    ui.toast(`${res.ok} email${res.ok === 1 ? "" : "s"} ${res.real ? "sent to the test inbox" : "sent"}${res.failed ? `, ${res.failed} failed` : ""}${moved ? ". Moved to Onboarding" : ""}`);
  };
  return (
    <Shell wide title={b === "exp2" ? `We're expanding to ${nav.expCity}` : REVIEW_TITLE[b]} eyebrow="Review before sending" onClose={onClose} foot={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <span className="sp" />
        <button className="btn primary" disabled={!chosen.length} onClick={send}><Ic n="send" />{ws.desk.emailMode === "demo" ? "Send (demo) " : "Send "}{chosen.length}</button>
      </>
    }>
      <div className="muted" style={{ fontSize: 12.5 }}>Untick anyone to skip them. Open a row to read their email. Nothing is sent until you press Send.</div>
      {list.length === 0 ? (
        <div className="muted" style={{ textAlign: "center", padding: 24 }}>Nobody left to review here.</div>
      ) : (
        <>
          <div className="row">
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={chosen.length === list.length} onChange={(e) => setOff(e.target.checked ? {} : Object.fromEntries(list.map((x) => [x.id, true])))} /> Select all
            </label>
            <span className="sp" />
            <span className="muted">{chosen.length} of {list.length} selected</span>
          </div>
          {list.map((x) => {
            const m = open === x.id ? mailFor(x.row ? ctxFromRow(x.row) : { name: x.name, city: x.city, pin: x.pin, asks: [], why: x.why, reason: x.why }, x.type, x.area) : null;
            return (
              <div key={x.id} className="rvrow" data-s={x.s}>
                <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                  <input type="checkbox" aria-label={`Include ${x.name}`} style={{ marginTop: 4 }} checked={!off[x.id]} onChange={(e) => setOff({ ...off, [x.id]: !e.target.checked })} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{x.name}</b> <span className="muted mono" style={{ fontSize: 11.5 }}>{x.city} · {x.pin}</span>
                    <div className="row wrap" style={{ gap: 6, margin: "3px 0" }}><Chip s={x.s} /><span className="tag">{MAIL_LABEL[x.type]}</span></div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{x.why}</div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn sm" onClick={() => setOpen(open === x.id ? null : x.id)}><Ic n="eye" />{open === x.id ? "Hide" : "Read"}</button>
                    {x.row && <button className="btn sm" title="Move to another bucket instead" aria-label={`Move ${x.name}`} onClick={() => ui.move([x.id])}><Ic n="move" /></button>}
                  </div>
                </div>
                {m && <div className="mail" style={{ marginTop: 8 }}><div className="muted">To: {m.to}</div><div className="sub">{m.sub}</div><div dangerouslySetInnerHTML={{ __html: m.html }} /></div>}
              </div>
            );
          })}
        </>
      )}
    </Shell>
  );
}

/* ---------- move someone ---------- */
const TARGETS: [UiStatus, string][] = [
  ["adv", "Reserve a pin and move toward next steps."],
  ["info", "Keep deciding. Ask for the missing facts."],
  ["wait", "Qualified, but no slot yet."],
  ["no", "Close politely with reasons."],
  ["exp", "Keep for when we serve their area."],
];
function MoveModal({ ids, spot, target: t0, onClose }: { ids: string[]; spot?: boolean; target?: UiStatus; onClose: () => void }) {
  const ui = useUi();
  const { ws } = ui;
  const rs = ids.map((id) => ws.rows.find((r) => r.id === id)).filter(Boolean) as Row[];
  const single = rs.length === 1;
  const a = rs[0];
  const [target, setTarget] = useState<UiStatus | null>(t0 ?? null);
  const [reason, setReason] = useState("");
  const [pinSel, setPinSel] = useState<{ pin: string; terr: string } | null>(null);
  if (!a || !ws.result) return null;
  const free = target === "adv" && single ? freePins(ws.result, a.app.city ?? undefined) : [];
  const own = a.slotPin && (a.ui === "adv" || a.ui === "redir") ? [{ pin: a.slotPin, terr: a.slotTerr!, city: a.app.city as string }] : [];
  const pins = [...own, ...free];
  const pinNow = pinSel ?? (target === "adv" && pins.length ? { pin: (pins.find((p) => p.pin === a.app.pin) ?? pins[0]).pin, terr: (pins.find((p) => p.pin === a.app.pin) ?? pins[0]).terr } : null);
  const holders = ws.rows.filter((x) => x.id !== a.id && !x.moved && (x.ui === "adv" || x.ui === "redir") && (x.app.city ?? "") === (a.app.city ?? "~"));
  const ok = reason.trim().length >= 3 && !!target && (target !== "adv" || (single && !!pinNow));
  const go = () => {
    if (!ok || !target) return;
    onClose();
    const res = ws.moveApplicants(ids, target, reason.trim(), pinNow?.pin, pinNow?.terr, spot);
    const others = res.changes.filter((c) => !ids.includes(c.id));
    ui.toast(`${single ? a.app.name : ids.length + " people"} moved to ${UI_META[target].label}${others.length ? `. ${others.length} other${others.length > 1 ? "s" : ""} re-ranked` : ""}`);
  };
  return (
    <Shell title={`Move ${single ? a.app.name : ids.length + " people"}`} eyebrow="Your call" onClose={onClose} foot={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <span className="sp" />
        <button className="btn primary" disabled={!ok} onClick={go}><Ic n="check" />Move</button>
      </>
    }>
      {single && <div className="muted" style={{ fontSize: 12.5 }}>Engine says: {UI_META[a.engine].label}. {a.why}</div>}
      <div className="stack" style={{ gap: 6 }}>
        {TARGETS.map(([s, d]) => {
          const disabled = (!single && s === "adv") || (single && a.ui === s && !a.move);
          return (
            <button key={s} className={`optcard${target === s ? " on" : ""}`} data-s={s} disabled={disabled} onClick={() => { setTarget(s); setPinSel(null); }}>
              <span className="dot" />
              <span style={{ flex: 1, textAlign: "left" }}>
                <b>{UI_META[s].label}</b>{single && a.ui === s && !a.move && <span className="tag" style={{ marginLeft: 6 }}>Current</span>}
                <span className="muted" style={{ display: "block", fontSize: 12.5 }}>{!single && s === "adv" ? "Pick a pin for each person one at a time." : d}</span>
              </span>
            </button>
          );
        })}
      </div>
      {target === "adv" && single && (
        <div className="card" style={{ boxShadow: "none", padding: 12 }}>
          <b>Which pin?</b>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>One store per pin. Only free pins are listed.</div>
          {pins.length ? (
            <div className="row wrap" style={{ gap: 6 }}>
              {pins.map((p) => <button key={p.pin} className={`fchip${pinNow?.pin === p.pin ? " on" : ""}`} onClick={() => setPinSel({ pin: p.pin, terr: p.terr })}>{p.pin} · {p.terr}{p.pin === a.app.pin ? " · their pin" : ""}</button>)}
            </div>
          ) : (
            <>
              <div className="row" data-s="no" style={{ gap: 8, alignItems: "flex-start" }}><Ic n="alert" /><span>No free pin in {a.app.city ?? "their city"}. One store per pin, so Proceed is blocked. To make room, move someone out of Proceed first:</span></div>
              <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                {holders.length ? holders.map((h) => <button key={h.id} className="chip" data-s={h.ui} onClick={() => ui.move([h.id])}><Ic n={UI_META[h.ui].icon} />{h.app.name.split(" ")[0]} · {h.slotPin ?? h.app.pin}</button>) : <span className="muted">Nobody. Those slots are held by partners already in Onboarding.</span>}
              </div>
            </>
          )}
        </div>
      )}
      <label>
        <b>Why? (required)</b>
        <textarea className="paste" style={{ borderStyle: "solid" }} placeholder="One line. It goes in the history." value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
    </Shell>
  );
}

/* ---------- free pin, stores, summary, more ---------- */
function PinModal({ pin, terr, onClose }: { pin: string; terr: string; onClose: () => void }) {
  const ui = useUi();
  const { ws } = ui;
  const t = ws.result?.territories.find((x) => x.territory.id === terr);
  const cand = ws.rows.filter((r) => (r.app.city ?? "") === (t?.territory.city ?? "~") && !r.moved && r.ui !== "adv" && r.ui !== "redir" && !r.withdrawn).sort((a, b) => b.fit - a.fit);
  return (
    <Shell title={`Pin ${pin} is free`} eyebrow={`${terr} · ${t?.territory.city ?? ""}`} onClose={onClose}>
      <div className="muted" style={{ fontSize: 12.5 }}>Pick who gets it. They move to Proceed with this pin.</div>
      {cand.length ? cand.map((r) => (
        <div key={r.id} className="row rvrow" data-s={r.ui} style={{ gap: 10 }}>
          <Ring v={r.fit} size={36} sw={4} s={r.ui} />
          <div style={{ flex: 1, minWidth: 0 }}><b>{r.app.name}</b> <Chip s={r.ui} /><div className="muted" style={{ fontSize: 12.5 }}>{r.why}</div></div>
          <button className="btn sm primary" onClick={() => { onClose(); ws.moveApplicants([r.id], "adv", "Assigned a free pin", pin, terr); ui.toast(`${r.app.name.split(" ")[0]} now holds pin ${pin}`); }}>Assign</button>
        </div>
      )) : <div className="muted" style={{ textAlign: "center", padding: 20 }}>Nobody in {t?.territory.city} is waiting for a pin.</div>}
    </Shell>
  );
}
function StoreModal({ pin, onClose }: { pin: string; onClose: () => void }) {
  const { ws } = useUi();
  const s = ws.input?.stores.find((x) => x.pin === pin);
  return (
    <Shell title={`${s?.id ?? "Store"} · pin ${pin}`} eyebrow="Existing store" onClose={onClose}>
      <p>{s ? `${s.city}, opened ${s.opened}.` : ""} This pin is closed to new applicants: one store per pin.</p>
      <p className="muted">Anyone who applies here is offered a free pin nearby.</p>
    </Shell>
  );
}
function StoresModal({ onClose }: { onClose: () => void }) {
  const ui = useUi();
  const stores = ui.ws.input?.stores ?? [];
  return (
    <Shell title={`The ${stores.length} stores open today`} onClose={onClose}>
      {stores.map((s) => <button key={s.id} className="row rvrow" style={{ gap: 10 }} onClick={() => ui.modal({ kind: "store", pin: s.pin })}><span className="tag mono">{s.id}</span><b style={{ flex: 1, textAlign: "left" }}>{s.city}</b><span className="mono muted">{s.pin} · {s.opened}</span></button>)}
    </Shell>
  );
}
function SummaryModal({ onClose }: { onClose: () => void }) {
  const ui = useUi();
  const { ws, now } = ui;
  const [to, setTo] = useState("CEO");
  const [when, setWhen] = useState("Send now");
  const lines = summaryLines(ws.rows, ws.desk, ws.expList.length, byCity(ws.expList).length, stageTimes(ws.desk, now));
  return (
    <Shell title="Email this summary" eyebrow="Overview" onClose={onClose} foot={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <span className="sp" />
        <button className="btn primary" onClick={async () => {
          onClose();
          ws.logSummary(to, when);
          if (ws.desk.emailMode === "real") await fetch("/api/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: "team", sub: "Pin Drop weekly summary", text: lines.join("\n") }) }).catch(() => {});
          ui.toast(`Summary ${when === "Send now" ? "sent" : "scheduled"} for ${to}`);
        }}><Ic n="send" />{ws.desk.emailMode === "demo" ? "Send (demo)" : "Send"}</button>
      </>
    }>
      <div className="row wrap" style={{ gap: 8 }}>
        <label className="row" style={{ gap: 6 }}><span style={{ fontWeight: 600 }}>To</span><select className="sel" value={to} onChange={(e) => setTo(e.target.value)}><option>CEO</option><option>Head of Expansion</option><option>Finance lead</option></select></label>
        <label className="row" style={{ gap: 6 }}><span style={{ fontWeight: 600 }}>When</span><select className="sel" value={when} onChange={(e) => setWhen(e.target.value)}><option>Send now</option><option>Every Monday, 9:00</option></select></label>
      </div>
      <div className="mail"><div className="sub">Pin Drop weekly summary</div><ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul><p>Full numbers are on the Overview page.</p></div>
    </Shell>
  );
}
function MoreSheet({ onClose }: { onClose: () => void }) {
  const ui = useUi();
  return (
    <Shell sheet title="More" onClose={onClose}>
      {([["map", "map", "Map"], ["expansion", "globe", "Expansion list"], ["settings", "sliders", "Rules and settings"]] as const).map(([v, ic, l]) => (
        <button key={v} className="nav" style={{ width: "100%" } as CSSProperties} onClick={() => { onClose(); ui.go(v); }}><Ic n={ic} />{l}</button>
      ))}
    </Shell>
  );
}

