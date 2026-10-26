"use client";

import { useState, type CSSProperties } from "react";
import { Ic } from "./Icon";
import { Card, Chip, Ring, useUi } from "./kit";
import { itemsFor, type Item } from "./Modals";
import { active, spotIds } from "@/lib/desk/model";
import { ago } from "@/lib/desk/time";
import { MAIL_LABEL } from "@/lib/desk/types";

function QueueRow({ it, i, on, toggle }: { it: Item; i: number; on: boolean; toggle: () => void }) {
  const ui = useUi();
  const r = it.row;
  return (
    <div className={`lrow qrow rise${on ? " picked" : ""}`} style={{ "--i": i } as CSSProperties} onClick={() => ui.open(it.id)}>
      <input type="checkbox" aria-label={`Select ${it.name}`} checked={on} onClick={(e) => e.stopPropagation()} onChange={toggle} />
      {r ? <Ring v={it.s === "redir" && r.offer ? r.offer : r.fit} size={40} sw={5} s={r.ui} /> : <span />}
      <div className="nm">
        {it.name}
        <small>{it.city} · {it.pin} · {it.id}</small>
      </div>
      <div className="why">
        <div className="row wrap" style={{ gap: 6 }}>
          <Chip s={it.s} />
          <span className="tag"><Ic n="mail" />{MAIL_LABEL[it.type]}</span>
          {r?.move && <span className="tag">Your call</span>}
          {r?.locked && <span className="tag"><Ic n="lock" />Locked</span>}
          {(r?.d.challenges?.length ?? 0) > 0 && <span className="tag"><Ic n="repeat" />Strong for {r!.d.challenges![0].pin} too</span>}
        </div>
        <div style={{ marginTop: 4 }}>{it.why}</div>
        {r && r.ui === "info" && r.asks.length > 1 && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Also asks: {r.asks.slice(1, 3).join(" · ")}</div>}
      </div>
      <div className="acts" onClick={(e) => e.stopPropagation()}>
        <button className="btn sm" onClick={() => ui.modal({ kind: "mail", id: it.id, type: it.type })}><Ic n="eye" />Preview</button>
        {r && <button className="btn sm" onClick={() => ui.move([it.id])}><Ic n="move" />Move</button>}
      </div>
    </div>
  );
}

// Tick people, then send to the ones ticked. One confirm click guards against a blind send.
function SendBar({ items, sel, setSel, verb }: { items: Item[]; sel: Record<string, boolean>; setSel: (s: Record<string, boolean>) => void; verb: string }) {
  const ui = useUi();
  const { ws } = ui;
  const [sure, setSure] = useState(false);
  const chosen = items.filter((x) => sel[x.id]);
  const all = items.length > 0 && chosen.length === items.length;
  const send = async () => {
    setSure(false);
    const list = chosen.map((x) => ({ id: x.id, type: x.type, area: x.area }));
    setSel({ ...sel, ...Object.fromEntries(chosen.map((x) => [x.id, false])) });
    const res = await ws.sendMail(list);
    const moved = list.some((i) => i.type === "next" || i.type === "offer");
    ui.toast(`${res.ok} email${res.ok === 1 ? "" : "s"} ${res.real ? "sent to the test inbox" : "sent"}${res.failed ? `, ${res.failed} failed` : ""}${moved ? ". Moved to Onboarding" : ""}`);
  };
  return (
    <div className="row wrap sendbar" style={{ gap: 8 }}>
      <label className="row" style={{ gap: 6, fontWeight: 600 }}>
        <input type="checkbox" checked={all} onChange={(e) => { setSure(false); setSel({ ...sel, ...Object.fromEntries(items.map((x) => [x.id, e.target.checked])) }); }} /> Select all
      </label>
      <span className="muted">{chosen.length} of {items.length} selected</span>
      <span className="sp" />
      {chosen.length > 0 && !sure && <button className="btn primary" onClick={() => setSure(true)}><Ic n="send" />{verb} {chosen.length}</button>}
      {chosen.length > 0 && sure && (
        <>
          <span className="muted">{ws.desk.emailMode === "demo" ? "Demo send" : "Real send to the test inbox"}.</span>
          <button className="btn" onClick={() => setSure(false)}>Cancel</button>
          <button className="btn primary" onClick={send}><Ic n="check" />Confirm: send to {chosen.length}</button>
        </>
      )}
    </div>
  );
}

// "Needs you now": only things a person must act on. Numbers and trends live in Performance.
export function NowView() {
  const ui = useUi();
  const { ws, now } = ui;
  const { rows, desk } = ws;
  const act = active(rows);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"info" | "wait" | "later">("info");
  const yes = itemsFor("proceed", ws, "");
  const groups: Record<"info" | "wait" | "later", Item[]> = { info: itemsFor("info", ws, ""), wait: itemsFor("wait", ws, ""), later: itemsFor("later", ws, "") };
  const GL: [typeof tab, string, string][] = [["info", "help", "Needs info"], ["wait", "hourglass", "Waitlist"], ["later", "pause", "Not now"]];
  const spot = spotIds(rows, desk.guard.spot);
  const replied = new Set(desk.replies.map((r) => r.id));
  const asked = act.filter((r) => r.ui === "info" && desk.mail[r.id] && !replied.has(r.id));
  const toReview = Object.entries(desk.onb).map(([id, o]) => ({ id, name: rows.find((r) => r.id === id)?.app.name ?? id, keys: Object.keys(o.docs ?? {}).filter((k) => o.chk[k] === "received") })).filter((x) => x.keys.length);
  const toggle = (id: string) => setSel((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="stack">
      <div className="stack">
        <Card i={0}>
          <h3><Ic n="star" />Waiting for your yes · {yes.length}</h3>
          {yes.length > 0 && <SendBar items={yes} sel={sel} setSel={setSel} verb="Send next steps to" />}
          <div className="stack" style={{ gap: 2, marginTop: 6 }}>
            {yes.length ? yes.map((it, i) => <QueueRow key={it.id} it={it} i={i} on={!!sel[it.id]} toggle={() => toggle(it.id)} />) : <div className="muted" style={{ padding: 20, textAlign: "center" }}>Nobody is waiting. Everyone you approved is in Onboarding.</div>}
          </div>
        </Card>
          {toReview.length > 0 && (
            <Card i={1} data-s="info">
              <h3><Ic n="file" />Documents to review · {toReview.reduce((a, x) => a + x.keys.length, 0)}</h3>
              <div className="stack" style={{ gap: 6 }}>
                {toReview.map((x) => (
                  <div key={x.id} className="row" style={{ gap: 10, padding: 8, borderRadius: "var(--r-sm)", background: "var(--surface2)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}><b>{x.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{x.keys.length} document{x.keys.length === 1 ? "" : "s"} emailed, ready to verify</div></div>
                    <button className="btn sm primary" onClick={() => ui.go("onboarding", { onb: x.id })}><Ic n="eye" />Review</button>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card i={1}>
            <h3><Ic n="mail" />Emails ready to send</h3>
            <div className="seg" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
              {GL.map(([k, ic, l]) => (
                <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><Ic n={ic} />{l}<span className="n" style={{ marginLeft: 2 }}>{groups[k].length}</span></button>
              ))}
            </div>
            {groups[tab].length > 0 && <SendBar items={groups[tab]} sel={sel} setSel={setSel} verb="Send to" />}
            <div className="stack" style={{ gap: 2 }}>
              {groups[tab].length ? groups[tab].map((it, i) => <QueueRow key={it.id} it={it} i={i} on={!!sel[it.id]} toggle={() => toggle(it.id)} />) : <div className="muted" style={{ padding: 16, textAlign: "center" }}>All done here.</div>}
            </div>
          </Card>
          <div className="grid g2">
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
