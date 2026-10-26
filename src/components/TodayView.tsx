"use client";

import type { CSSProperties } from "react";
import { Ic } from "./Icon";
import { Card, Chip, Ring, useUi, type ReviewBucket } from "./kit";
import { active, spotIds, type Row } from "@/lib/desk/model";
import { ago } from "@/lib/desk/time";

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

// "Needs you now": only things a person must act on. Numbers and trends live in Performance.
export function NowView() {
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
  const spot = spotIds(rows, desk.guard.spot);
  const replied = new Set(desk.replies.map((r) => r.id));
  const asked = info.filter((r) => desk.mail[r.id] && !replied.has(r.id));
  const typos = info.filter((r) => r.tag === "pin");

  const E: { b: ReviewBucket; icon: string; s: string; title: string; sub: string; n: number }[] = [
    { b: "info", icon: "help", s: "info", title: "Needs info", sub: `${infoNew.length} not asked yet${typos.length ? ` · ${typos.length} pin typo${typos.length === 1 ? "" : "s"}` : ""}`, n: infoNew.length },
    { b: "wait", icon: "hourglass", s: "wait", title: "Waitlist", sub: `${waitNew.length} not told yet`, n: waitNew.length },
    { b: "later", icon: "pause", s: "no", title: "Not now", sub: "Reason, plus a way back in", n: later.length },
  ];

  return (
    <div className="stack">
      <div className="grid g2">
        <Card i={0}>
          <h3>
            <Ic n="star" />Waiting for your yes · {prop.length}
            <span className="sp" />
            {prop.length > 0 && <button className="btn sm primary" onClick={() => ui.review("proceed")}><Ic n="eye" />Review all {prop.length}</button>}
          </h3>
          <div className="stack" style={{ gap: 2 }}>
            {prop.length ? prop.map((r, i) => <ProceedRow key={r.id} r={r} i={i} />) : <div className="muted" style={{ padding: 20, textAlign: "center" }}>Nobody is waiting. Everyone you approved is in Onboarding.</div>}
          </div>
        </Card>
        <div className="stack">
          <Card i={1}>
            <h3><Ic n="mail" />Emails ready to send</h3>
            <div className="stack" style={{ gap: 6 }}>
              {E.map((e) => (
                <div key={e.b} className="row" data-s={e.s} style={{ gap: 10, padding: 8, borderRadius: "var(--r-sm)", background: "var(--surface2)" }}>
                  <span className="bucket"><span className="ic" style={{ width: 32, height: 32, fontSize: 16 }}><Ic n={e.icon} /></span></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{e.title} · {e.n}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{e.sub}</div>
                  </div>
                  {e.n ? <button className="btn sm primary" onClick={() => ui.review(e.b)}><Ic n="eye" />Review {e.n}</button> : <span className="tag"><Ic n="check" />All done</span>}
                </div>
              ))}
            </div>
          </Card>
          <Card i={2}>
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
          <Card i={3}>
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

      <Card i={4}>
        <h3>
          <Ic n="shield" />Spot-check the engine · {spot.filter((id) => desk.spot[id]).length} of {spot.length}
          <span className="sp" />
          <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>{desk.guard.spot}% of decisions, checked by you</span>
        </h3>
        <div className="grid g2" style={{ gap: 6 }}>
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
  );
}
