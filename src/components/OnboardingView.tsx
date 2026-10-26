"use client";

import type { CSSProperties } from "react";
import { demoMail, parseEml, parsePasted } from "@/lib/desk/inbox";
import { useRef, useState } from "react";
import { Checklist, Gantt } from "./Checklist";
import { Ic } from "./Icon";
import { BucketIcon, Card, Empty, Ring, TierBadge, useUi } from "./kit";
import { STAGES, CHECK_GROUPS } from "@/lib/desk/types";
import { daysLeft } from "@/lib/desk/time";

export function OnboardingView() {
  const ui = useUi();
  const { ws, nav, setNav, now } = ui;
  const { rows, desk } = ws;
  const ids = Object.keys(desk.onb).filter((id) => rows.some((r) => r.id === id));
  if (!ids.length) return <Empty icon="clip" title="Nobody here yet" text="When you email someone their next steps, they move here from the Pipeline." />;
  const id = ids.includes(nav.onb) ? nav.onb : ids[0];
  const row = rows.find((r) => r.id === id)!;
  const o = desk.onb[id];
  const prog = Math.round((o.stage / 12) * 100);
  const flags = Object.values(o.chk).filter((v) => v === "flag").length;
  const hold = daysLeft(o.holdUntil, now);
  let pending: string | null = null;
  for (const g of CHECK_GROUPS) for (const [k, label] of g.items) if (!pending && desk.mods[g.mod] && (o.chk[k] === "todo" || o.chk[k] === "asked")) pending = label;
  const d = row.d;
  const mentor = d.plan?.training.mentorStore;

  return (
    <div className="grid onbgrid">
      <div className="stack" style={{ gap: 10 }}>
        {ids.map((pid, i) => {
          const r = rows.find((x) => x.id === pid)!;
          const rec = desk.onb[pid];
          const fl = Object.values(rec.chk).filter((v) => v === "flag").length;
          return (
            <button key={pid} className="card hov rise row" style={{ "--i": i, gap: 12, textAlign: "left", padding: 12, ...(pid === id ? { borderColor: "var(--accent)" } : {}) } as CSSProperties} onClick={() => setNav({ onb: pid })}>
              <Ring v={(rec.stage / 12) * 100} size={48} sw={5} pct />
              <div style={{ minWidth: 0 }}>
                <b>{r.app.name} <TierBadge t={r.tier} /></b>
                <div className="muted" style={{ fontSize: 12 }}>{STAGES[rec.stage]} · {r.slotPin ?? r.app.pin}</div>
                {fl > 0 && <span className="tag warn" style={{ marginTop: 4 }}><Ic n="alert" />{fl} flag</span>}
              </div>
            </button>
          );
        })}
      </div>
      <div className="stack">
        <Card>
          <div className="row wrap" style={{ gap: 14 }}>
            <Ring v={prog} size={72} sw={7} pct />
            <div style={{ flex: 1, minWidth: 160 }}>
              <h3 style={{ margin: 0, fontSize: 20 }}>{row.app.name}</h3>
              <div className="muted">{row.app.city ?? row.app.cityRaw} · pin {row.slotPin ?? row.app.pin}{d.plan ? ` · opens ${d.plan.plannedOpen}` : ""}</div>
              <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                <span className={`tag${hold < 10 ? " warn" : ""}`}><Ic n="calendar" />Pin held {hold} more days</span>
                {flags > 0 && <span className="tag warn"><Ic n="alert" />{flags} flag</span>}
                <button className="tag" onClick={() => ui.open(id)}><Ic n="eye" />Full reasoning</button>
              </div>
            </div>
            <button className="btn primary" title="Demo only: pretends the partner replied" onClick={() => { ws.simulateReply(id); ui.toast(`${row.app.name.split(" ")[0]} replied: documents received`); }}><Ic n="zap" />Demo: partner replies</button>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="row" style={{ gap: 6, overflowX: "auto", paddingBottom: 6 }}>
              {STAGES.map((s, i) => {
                const c = i < o.stage ? "done" : i === o.stage ? "cur" : "";
                return (
                  <div key={s} className="pop" style={{ "--i": i, flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 70, textAlign: "center", fontSize: 11, fontWeight: 600, color: c ? "var(--ink)" : "var(--muted)" } as CSSProperties}>
                    <span style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", background: c === "done" ? "var(--s-adv)" : c === "cur" ? "var(--s-wait)" : "var(--surface2)", color: c ? "#fff" : "var(--muted)", border: "1px solid var(--line)", fontSize: 13 }}>
                      {c === "done" ? <Ic n="check" /> : <span className="mono" style={{ fontSize: 11 }}>{i + 1}</span>}
                    </span>
                    {s}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="row" data-s="wait" style={{ gap: 10, marginTop: 8, padding: "10px 12px", borderRadius: "var(--r-sm)", background: "color-mix(in srgb,var(--c) 12%,var(--surface))" }}>
            <Ic n="clock" />
            <span><b>Next:</b> {pending ? `waiting on ${pending}` : "all checks done. Move to agreement."}</span>
          </div>
        </Card>

        <PartnerInbox id={id} name={row.app.name} />

        <Card i={1}>
          <h3><Ic n="shield" />Checks<span className="sp" /><span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>Groups can be switched off in Rules and settings</span></h3>
          <Checklist o={o} mods={desk.mods} interactive id={id} onCycle={(k) => ws.cycleCheck(id, k)} onSet={(k, st) => ws.setCheck(id, k, st)} onRemind={() => ui.toast(`Reminder sent to ${row.app.name.split(" ")[0]}`)} />
        </Card>

        {desk.mods.sup && (
          <Card i={3}>
            <h3><Ic n="heart" />First 90 days: support</h3>
            <div className="grid g3" style={{ gap: 10 }}>
              {[
                ["build", "Day 1", `Visit mentor store ${mentor ? mentor.id : "ST-01"}`],
                ["phone", "Week 1", "Check-in call with expansion manager"],
                ["trend", "Day 30 · 60 · 90", "Sales vs plan review"],
                ["msg", "Helpline", "One number for every question"],
                ["star", "Day 90", "NPS survey to the partner"],
              ].map(([ic, t, s], i) => (
                <div key={t} className="row pop" style={{ "--i": i, gap: 10, alignItems: "flex-start", padding: 10, borderRadius: "var(--r-sm)", background: "var(--surface2)" } as CSSProperties}>
                  <BucketIcon icon={ic} size={32} />
                  <div><b>{t}</b><div className="muted" style={{ fontSize: 12.5 }}>{s}</div></div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card i={4}>
          <h3><Ic n="clock" />Path to opening</h3>
          <Gantt row={row} />
        </Card>
      </div>
    </div>
  );
}

// Partner emails go in here. The app finds the documents and marks them "for your review".
function PartnerInbox({ id, name }: { id: string; name: string }) {
  const ui = useUi();
  const { ws } = ui;
  const file = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const [open, setOpen] = useState(false);
  const review = Object.entries(ws.desk.onb[id]?.docs ?? {}).filter(([k]) => ws.desk.onb[id].chk[k] === "received").length;
  const done = (labels: string[]) => {
    if (!labels.length) ui.toast("No new documents found. They may already be verified.");
    else ui.toast(`Found ${labels.join(", ")}. Ready for your review`);
  };
  const onFile = async (f: File) => {
    const text = await f.text();
    done(ws.receiveEmail(id, f.name.toLowerCase().endsWith(".eml") ? parseEml(text) : parsePasted(text)));
  };
  return (
    <Card i={1} data-s={review ? "info" : undefined}>
      <h3>
        <Ic n="inbox" />Partner emails
        <span className="sp" />
        <span className={`tag${review ? " warn" : ""}`}>{review ? `${review} document${review === 1 ? "" : "s"} for your review` : "Nothing waiting"}</span>
      </h3>
      <p className="muted" style={{ margin: 0 }}>When {name.split(" ")[0]} emails documents, add the email here. We find the documents, show them for review, and you click Verify. No more digging through your inbox.</p>
      <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
        <input ref={file} type="file" accept=".eml,.txt" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <button className="btn primary" onClick={() => file.current?.click()}><Ic n="upload" />Add an email (.eml)</button>
        <button className="btn" onClick={() => setOpen(!open)}><Ic n="edit" />Paste an email</button>
        <button className="btn" title="Demo only: adds a sample email with two attachments" onClick={() => {
          const o = ws.desk.onb[id];
          const owed = CHECK_GROUPS.filter((g) => ws.desk.mods[g.mod]).flatMap((g) => g.items.map((it) => it[0])).filter((k) => o && (o.chk[k] === "todo" || o.chk[k] === "asked"));
          if (!owed.length) ui.toast("This partner owes no more documents");
          else done(ws.receiveEmail(id, demoMail(name, owed)));
        }}><Ic n="zap" />Demo: partner emails documents</button>
      </div>
      {open && (
        <div className="stack" style={{ gap: 8, marginTop: 10 }}>
          <textarea className="paste" aria-label="Paste the email" placeholder={"From: Name <name@email.com>\nSubject: Documents\nAttachments: PAN_card.pdf, Bank_statement.pdf\n\nPlease find my PAN card attached."} value={paste} onChange={(e) => setPaste(e.target.value)} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary" disabled={!paste.trim()} onClick={() => { done(ws.receiveEmail(id, parsePasted(paste))); setPaste(""); setOpen(false); }}>Find documents</button>
            <span className="muted" style={{ fontSize: 12.5 }}>Tip: list attachment names on an “Attachments:” line.</span>
          </div>
        </div>
      )}
      <p className="muted" style={{ margin: "10px 0 0", fontSize: 12 }}>Reading a live inbox automatically needs a Google or Outlook connection. For now, drop the email in, or forward it and download as .eml.</p>
    </Card>
  );
}
