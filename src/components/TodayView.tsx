"use client";

import type { CSSProperties, ReactNode } from "react";
import { Ic } from "./Icon";
import { BucketIcon, Card, Chip, CountUp, Ring, useUi, type ReviewBucket } from "./kit";
import { active, countBy, spotIds, type Row } from "@/lib/desk/model";
import { UI_META, UI_ORDER, type UiStatus } from "@/lib/desk/types";
import { ago } from "@/lib/desk/time";

export function Donut({ rows, onPick }: { rows: Row[]; onPick: (s: UiStatus) => void }) {
  const n = countBy(rows);
  const tot = rows.length;
  const R = 54;
  const C = 2 * Math.PI * R;
  const starts = UI_ORDER.reduce<number[]>((acc, st, i) => [...acc, (acc[i - 1] ?? 0) + (i ? (C * n[UI_ORDER[i - 1]]) / Math.max(1, tot) : 0)], []);
  return (
    <div className="row" style={{ gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <span className="pdring" style={{ width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Where everyone stands">
          <circle className="track" cx="70" cy="70" r={R} strokeWidth="16" />
          {UI_ORDER.map((s, i) => {
            if (!n[s]) return null;
            const part = (C * n[s]) / Math.max(1, tot);
            const len = Math.max(part - 3, 1);
            return <circle key={s} className="arc" data-s={s} cx="70" cy="70" r={R} fill="none" stroke="var(--c)" strokeWidth="16" style={{ "--cc": C, "--i": i, strokeDasharray: `${len} ${C - len}`, strokeDashoffset: -starts[i] } as CSSProperties} />;
          })}
        </svg>
        <span className="v" style={{ textAlign: "center", lineHeight: 1.1 }}>
          <CountUp to={tot} style={{ fontSize: 32 }} />
          <br />
          <span className="muted" style={{ fontSize: 11, fontWeight: 500, fontFamily: "var(--f-body)" }}>applications</span>
        </span>
      </span>
      <div className="stack" style={{ gap: 3, flex: 1, minWidth: 130 }}>
        {UI_ORDER.map((s) => (
          <button key={s} className="row legrow" data-s={s} onClick={() => onPick(s)} title="Show these in the pipeline">
            <span className="dot" />
            <span style={{ flex: 1, textAlign: "left" }}>{UI_META[s].label}</span>
            <b className="mono">{n[s]}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

function PinRow({ icon, s, title, text, children }: { icon: string; s: UiStatus; title: string; text: string; children: ReactNode }) {
  return (
    <div className="row wrap" data-s={s} style={{ gap: 12, alignItems: "flex-start" }}>
      <BucketIcon icon={icon} size={34} />
      <div style={{ flex: 1, minWidth: 150 }}>
        <b>{title}</b>
        <div className="muted" style={{ fontSize: 12.5 }}>{text}</div>
        <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>{children}</div>
      </div>
    </div>
  );
}

export function ProceedRow({ r, i }: { r: Row; i: number }) {
  const ui = useUi();
  return (
    <div className="lrow rise" style={{ "--i": i } as CSSProperties} onClick={() => ui.open(r.id)}>
      <Ring v={r.ui === "redir" && r.offer ? r.offer : r.fit} size={40} sw={5} s={r.ui} />
      <div className="nm">
        {r.app.name}
        <small>{r.app.city ?? r.app.cityRaw} · {r.slotPin ?? r.app.pin ?? r.app.pinRaw} · {r.id}</small>
      </div>
      <div className="why">
        <div className="row wrap" style={{ gap: 6 }}>
          <Chip s={r.ui} />
          {r.move && <span className="tag">Your call</span>}
          {r.locked && <span className="tag"><Ic n="lock" />Locked</span>}
        </div>
        <div style={{ marginTop: 4 }}>{r.why}</div>
      </div>
      <div className="acts" onClick={(e) => e.stopPropagation()}>
        <button className="btn sm primary" onClick={() => ui.mail(r.id)}><Ic n="send" />Email</button>
        <button className="btn sm" onClick={() => ui.move([r.id])}><Ic n="move" />Move</button>
      </div>
    </div>
  );
}

export function TodayView() {
  const ui = useUi();
  const { ws, now } = ui;
  const { rows, desk } = ws;
  const act = active(rows);
  const prop = act.filter((r) => r.ui === "adv" || r.ui === "redir").sort((a, b) => b.fit - a.fit);
  const info = act.filter((r) => r.ui === "info");
  const infoNew = info.filter((r) => !desk.mail[r.id]);
  const wait = act.filter((r) => r.ui === "wait");
  const waitNew = wait.filter((r) => !desk.mail[r.id]);
  const later = [...act.filter((r) => r.ui === "no" && !desk.mail[r.id]), ...rows.filter((r) => r.ui === "exp" && !desk.onb[r.id] && !desk.mail["exp:" + r.id])];
  const inOnb = Object.keys(desk.onb).length;
  const spot = spotIds(rows, desk.guard.spot);
  const replied = new Set(desk.replies.map((r) => r.id));
  const asked = info.filter((r) => desk.mail[r.id] && !replied.has(r.id));
  const typos = info.filter((r) => r.tag === "pin");
  const outside = rows.filter((r) => r.ui === "exp" && !r.withdrawn);

  const B: { s: UiStatus; icon: string; n: number; title: string; sub: string; b: ReviewBucket }[] = [
    { s: "adv", icon: "check", n: prop.length, title: "Waiting for your yes", sub: `${prop.length} ready to email${inOnb ? `. ${inOnb} already in Onboarding` : ""}`, b: "proceed" },
    { s: "info", icon: "help", n: infoNew.length, title: "Need info", sub: `${infoNew.length} not asked yet · ${info.length - infoNew.length} asked, waiting`, b: "info" },
    { s: "wait", icon: "hourglass", n: waitNew.length, title: "Waitlist", sub: `${waitNew.length} not told yet · ${wait.length - waitNew.length} told`, b: "wait" },
    { s: "exp", icon: "globe", n: later.length, title: "Not now, kept", sub: "Reasons plus a way back in", b: "later" },
  ];

  return (
    <div className="stack">
      <div className="row wrap rise" style={{ gap: 8 }}>
        <span className="tag"><Ic n="check" />{prop.length} waiting for your yes</span>
        <span className="tag"><Ic n="inbox" />{desk.replies.length} replies to read</span>
        <span className="tag"><Ic n="clock" />{asked.length} slow to reply</span>
      </div>
      <div className="grid g4">
        <Card i={0}>
          <h3><Ic n="layers" />Where everyone stands</h3>
          <Donut rows={rows} onPick={(s) => ui.go("pipeline", { filter: s, showMoved: true })} />
        </Card>
        {B.map((b, i) => (
          <div key={b.b} className="card bucket rise" data-s={b.s} style={{ "--i": i + 1 } as CSSProperties}>
            <div className="row">
              <span className="ic"><Ic n={b.icon} /></span>
              <span className="sp" />
              <span className="eyebrow">{b.title}</span>
            </div>
            <CountUp className="num" to={b.n} />
            <p>{b.sub}</p>
            {b.n ? (
              <button className="btn sm primary" onClick={() => ui.review(b.b)}><Ic n="eye" />Review {b.n}</button>
            ) : (
              <button className="btn sm done"><Ic n="check" />All done</button>
            )}
          </div>
        ))}
      </div>

      <div className="grid g2">
        <Card i={2}>
          <h3>
            <Ic n="star" />Waiting for your yes · {prop.length}
            <span className="sp" />
            <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>Best fit first. Click a row for the full reasoning.</span>
          </h3>
          <div className="stack" style={{ gap: 2 }}>
            {prop.length ? prop.map((r, i) => <ProceedRow key={r.id} r={r} i={i} />) : <div className="muted" style={{ padding: 20, textAlign: "center" }}>Nobody is waiting. Everyone you approved is in Onboarding.</div>}
          </div>
        </Card>
        <div className="stack">
          <Card i={3}>
            <h3><Ic n="inbox" />Replies to read · {desk.replies.length}</h3>
            <div className="stack" style={{ gap: 6 }}>
              {desk.replies.length ? (
                desk.replies.map((rp) => {
                  const r = rows.find((x) => x.id === rp.id);
                  if (!r) return null;
                  return (
                    <div key={rp.id} className="row" style={{ gap: 10, alignItems: "flex-start", padding: 8, borderRadius: "var(--r-sm)", background: "var(--surface2)" }}>
                      <Ring v={r.fit} size={34} sw={4} s={r.ui} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b>{r.app.name} <span className="muted" style={{ fontWeight: 500 }}>· {ago(rp.at, now)}</span></b>
                        <div className="muted" style={{ fontSize: 12.5 }}>“{rp.text}”</div>
                      </div>
                      <button className="btn sm primary" onClick={() => ui.open(rp.id, "facts", rp.text)}><Ic n="zap" />Read and apply</button>
                    </div>
                  );
                })
              ) : (
                <div className="muted">No new replies. Paste a reply into any applicant’s Facts tab to update them.</div>
              )}
            </div>
          </Card>
          <Card i={4}>
            <h3>
              <Ic n="shield" />Spot-check the engine · {spot.filter((id) => desk.spot[id]).length} of {spot.length}
              <span className="sp" />
              <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>{desk.guard.spot}% of decisions, checked by you</span>
            </h3>
            <div className="stack" style={{ gap: 6 }}>
              {spot.map((id) => {
                const r = rows.find((x) => x.id === id)!;
                const done = desk.spot[id];
                return (
                  <div key={id} className="row" style={{ gap: 10, padding: 8, borderRadius: "var(--r-sm)", background: "var(--surface2)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{r.app.name}</b> <Chip s={r.ui} />
                      <div className="muted" style={{ fontSize: 12.5 }}>{r.why}</div>
                    </div>
                    {done ? (
                      <span className="tag"><Ic n="check" />{done === "agree" ? "Agreed" : "Moved"}</span>
                    ) : (
                      <>
                        <button className="btn sm" onClick={() => ws.markSpot(id, "agree")}><Ic n="check" />Agree</button>
                        <button className="btn sm" onClick={() => ui.move([id], { spot: true })}>Disagree</button>
                      </>
                    )}
                  </div>
                );
              })}
              {!spot.length && <div className="muted">Nothing to check yet.</div>}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid g2">
        <Card i={5}>
          <h3><Ic n="pin" />Pin problems</h3>
          <div className="stack" style={{ gap: 10 }}>
            <PinRow icon="help" s="info" title={`${typos.length} pin${typos.length === 1 ? "" : "s"} need confirming`} text="Typo or mismatch. We ask, we do not reject.">
              {typos.map((r) => <button key={r.id} className="chip" data-s="info" onClick={() => ui.open(r.id)}>{r.app.name.split(" ")[0]}</button>)}
            </PinRow>
            <PinRow icon="globe" s="exp" title={`${outside.length} valid pin${outside.length === 1 ? "" : "s"} we do not serve yet`} text="Kept on the Expansion list, not rejected.">
              {outside.map((r) => <button key={r.id} className="chip" data-s="exp" onClick={() => ui.open(r.id)}>{r.app.name.split(" ")[0]}</button>)}
              <button className="btn sm" onClick={() => ui.go("expansion")}>Open list</button>
            </PinRow>
          </div>
        </Card>
        <Card i={6}>
          <h3><Ic n="clock" />Slow to reply · {asked.length}</h3>
          <div className="stack" style={{ gap: 6 }}>
            {asked.length ? (
              asked.map((r) => (
                <div key={r.id} className="row" style={{ gap: 10, padding: 8, borderRadius: "var(--r-sm)", background: "var(--surface2)" }}>
                  <Ring v={r.fit} size={34} sw={4} s="info" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{r.app.name}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>Asked {ago(desk.mail[r.id].at, now)}. {r.asks[0] ?? ""}</div>
                  </div>
                  <button className="btn sm" onClick={() => ui.open(r.id)}>Open</button>
                  <button className="btn sm primary" onClick={() => { ws.remind(r.id); ui.toast(`Reminder sent to ${r.app.name}`); }}><Ic n="bell" />Remind</button>
                </div>
              ))
            ) : (
              <div className="muted">Everyone replied.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
