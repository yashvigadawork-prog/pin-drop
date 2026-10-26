"use client";

import { useState, type CSSProperties } from "react";
import { Ic } from "./Icon";
import { Card, Chip, Ring, TierBadge, useUi } from "./kit";
import { itemsFor, type Item } from "./Modals";
import { active, countBy, spotIds } from "@/lib/desk/model";
import { ago } from "@/lib/desk/time";
import { MAIL_LABEL, UI_GROUPS } from "@/lib/desk/types";

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
// A compact card for the approval queue: who, how strong, why, and a tick box.
function ApprovalCard({ it, i, on, toggle }: { it: Item; i: number; on: boolean; toggle: () => void }) {
  const ui = useUi();
  const r = it.row;
  return (
    <div className={`acard rise${on ? " picked" : ""}`} data-s={it.s} style={{ "--i": i } as CSSProperties} onClick={() => ui.open(it.id)}>
      <div className="row" style={{ gap: 10 }}>
        <input type="checkbox" aria-label={`Select ${it.name}`} checked={on} onClick={(e) => e.stopPropagation()} onChange={toggle} />
        {r && <Ring v={it.s === "redir" && r.offer ? r.offer : r.fit} size={38} sw={4.5} s={r.ui} />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <b className="clip1">{it.name} <TierBadge t={r?.tier} /></b>
          <div className="muted clip1" style={{ fontSize: 12 }}>{it.city} · {it.pin}</div>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 5 }}>
        <Chip s={it.s} />
        {(r?.d.challenges?.length ?? 0) > 0 && <span className="tag"><Ic n="repeat" />Strong for {r!.d.challenges![0].pin} too</span>}
        {r?.locked && <span className="tag"><Ic n="lock" />Locked</span>}
      </div>
      <div className="muted clip2" style={{ fontSize: 12.5 }}>{it.why}</div>
      <div className="row" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <button className="btn sm" onClick={() => ui.modal({ kind: "mail", id: it.id, type: it.type })}><Ic n="eye" />Preview</button>
        {r && <button className="btn sm ghost" onClick={() => ui.move([it.id])}><Ic n="move" />Move</button>}
      </div>
    </div>
  );
}

// One line per person, for the lists that are checked quickly.
function MiniRow({ it, on, toggle }: { it: Item; on: boolean; toggle: () => void }) {
  const ui = useUi();
  return (
    <div className={`mrow${on ? " picked" : ""}`} onClick={() => ui.open(it.id)}>
      <input type="checkbox" aria-label={`Select ${it.name}`} checked={on} onClick={(e) => e.stopPropagation()} onChange={toggle} />
      <div style={{ minWidth: 0 }}>
        <b className="clip1">{it.name}</b>
        <div className="muted clip1" style={{ fontSize: 12 }}>{it.why}</div>
      </div>
      <span className="tag">{MAIL_LABEL[it.type]}</span>
      <button className="btn sm" onClick={(e) => { e.stopPropagation(); ui.modal({ kind: "mail", id: it.id, type: it.type }); }}><Ic n="eye" />Preview</button>
    </div>
  );
}

function Kpi({ i, s, icon, label, n, sub, onClick }: { i: number; s: string; icon: string; label: string; n: number; sub: string; onClick: () => void }) {
  return (
    <button className="card hov rise bucket kpi" data-s={s} style={{ "--i": i, textAlign: "left" } as CSSProperties} onClick={onClick}>
      <div className="row"><span className="ic"><Ic n={icon} /></span><span className="sp" /><span className="eyebrow">{label}</span></div>
      <span className="num">{n}</span>
      <span className="dl">{sub}</span>
    </button>
  );
}

// "Needs you now": one dashboard of everything that waits on a person. Trends live in Performance.
export function NowView() {
  const ui = useUi();
  const { ws, now } = ui;
  const { rows, desk, result } = ws;
  const act = active(rows);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"info" | "wait" | "later">("info");
  const [all, setAll] = useState(false);
  const yes = itemsFor("proceed", ws, "");
  const groups: Record<"info" | "wait" | "later", Item[]> = { info: itemsFor("info", ws, ""), wait: itemsFor("wait", ws, ""), later: itemsFor("later", ws, "") };
  const GL: [typeof tab, string, string][] = [["info", "help", "Needs info"], ["wait", "hourglass", "Waitlist"], ["later", "pause", "Not now"]];
  const emails = groups.info.length + groups.wait.length + groups.later.length;
  const spot = spotIds(rows, desk.guard.spot);
  const spotLeft = spot.filter((id) => !desk.spot[id]).length;
  const replied = new Set(desk.replies.map((r) => r.id));
  const asked = act.filter((r) => r.ui === "info" && desk.mail[r.id] && !replied.has(r.id));
  const typos = act.filter((r) => r.ui === "info" && r.tag === "pin").length;
  const toReview = Object.entries(desk.onb).map(([id, o]) => ({ id, name: rows.find((r) => r.id === id)?.app.name ?? id, keys: Object.keys(o.docs ?? {}).filter((k) => o.chk[k] === "received") })).filter((x) => x.keys.length);
  const docs = toReview.reduce((a, x) => a + x.keys.length, 0);
  const flags = Object.values(desk.onb).reduce((a, o) => a + Object.values(o.chk).filter((v) => v === "flag").length, 0);
  const challengers = rows.filter((r) => (r.d.challenges?.length ?? 0) > 0 && !r.moved);
  const c = countBy(rows.filter((r) => !r.withdrawn));
  const total = Math.max(1, rows.filter((r) => !r.withdrawn).length);
  const toggle = (id: string) => setSel((s) => ({ ...s, [id]: !s[id] }));
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const shown = all ? yes : yes.slice(0, 6);

  const alerts: { icon: string; s: string; text: string; go: () => void; label: string }[] = [];
  if (asked.length) alerts.push({ icon: "clock", s: "wait", text: `${asked.length} partner${asked.length === 1 ? "" : "s"} slow to reply`, label: "Chase", go: () => jump("inbox-card") });
  if (flags) alerts.push({ icon: "alert", s: "no", text: `${flags} onboarding check${flags === 1 ? "" : "s"} flagged`, label: "Open", go: () => ui.go("onboarding") });
  if (typos) alerts.push({ icon: "pin", s: "info", text: `${typos} pin${typos === 1 ? "" : "s"} need confirming`, label: "See", go: () => ui.go("pipeline", { filter: "info" }) });
  if (challengers.length) alerts.push({ icon: "repeat", s: "redir", text: `${challengers.length} strong applicant${challengers.length === 1 ? "" : "s"} could take a neighbouring pin`, label: "Review", go: () => ui.open(challengers[0].id) });
  if (spotLeft) alerts.push({ icon: "shield", s: "info", text: `${spotLeft} spot-check${spotLeft === 1 ? "" : "s"} due`, label: "Check", go: () => jump("spot-card") });
  if (ws.expList.length) alerts.push({ icon: "globe", s: "exp", text: `${ws.expList.length} people waiting on the expansion list`, label: "Open", go: () => ui.go("expansion") });

  return (
    <div className="stack">
      <div className="grid g4 kpis">
        <Kpi i={0} s="adv" icon="check" label="Waiting for your yes" n={yes.length} sub={yes.length ? (["A", "B", "C"] as const).map((k) => [k, yes.filter((x) => x.row?.tier === k).length] as const).filter(([, n]) => n > 0).map(([k, n]) => `${n} Tier ${k}`).join(" · ") || "Ready to approve" : "All clear"} onClick={() => jump("queue-card")} />
        <Kpi i={1} s="info" icon="mail" label="Emails ready to send" n={emails} sub={`${groups.info.length} ask · ${groups.wait.length} waitlist · ${groups.later.length} not now`} onClick={() => jump("emails-card")} />
        <Kpi i={2} s="redir" icon="file" label="Documents to review" n={docs} sub={docs ? `${toReview.length} partner${toReview.length === 1 ? "" : "s"}` : "Nothing waiting"} onClick={() => (toReview[0] ? ui.go("onboarding", { onb: toReview[0].id }) : ui.go("onboarding"))} />
        <Kpi i={3} s="wait" icon="inbox" label="Replies and chasing" n={desk.replies.length + asked.length} sub={`${desk.replies.length} to read · ${asked.length} slow`} onClick={() => jump("inbox-card")} />
      </div>

      <div className="grid g3">
        <Card i={4}>
          <h3><Ic n="layers" />Where everyone stands</h3>
          <div className="stackbar" role="img" aria-label="Applicants by status">
            {UI_GROUPS.map((g) => {
              const n = g.members.reduce((a, m) => a + c[m], 0);
              return n ? <button key={g.key} data-s={g.key} style={{ flex: n }} title={`${g.label}: ${n}`} onClick={() => ui.go("pipeline", { filter: g.key, showMoved: true })} /> : null;
            })}
          </div>
          <div className="stack" style={{ gap: 4, marginTop: 10 }}>
            {UI_GROUPS.map((g) => {
              const n = g.members.reduce((a, m) => a + c[m], 0);
              return (
                <button key={g.key} className="row legrow" data-s={g.key} onClick={() => ui.go("pipeline", { filter: g.key, showMoved: true })}>
                  <span className="dot" />
                  <span style={{ flex: 1, textAlign: "left" }}>{g.label}</span>
                  <b className="mono">{n}</b>
                  <span className="muted mono" style={{ width: 36, textAlign: "right", fontSize: 11.5 }}>{Math.round((n / total) * 100)}%</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card i={5}>
          <h3><Ic n="map" />Territory coverage</h3>
          <div className="stack" style={{ gap: 7 }}>
            {(result?.territories ?? []).map((t) => {
              const al = rows.filter((r) => r.slotTerr === t.territory.id && (r.ui === "adv" || r.ui === "redir")).length;
              const full = al >= t.territory.slots;
              return (
                <button key={t.territory.id} className="row" style={{ gap: 8, textAlign: "left" }} onClick={() => ui.go("places", { placesTab: "terr" })}>
                  <span style={{ width: 112, fontSize: 12.5, fontWeight: 600 }} className="clip1">{t.territory.city} <span className="muted mono" style={{ fontWeight: 500, fontSize: 11 }}>{t.territory.id.replace("TER-", "")}</span></span>
                  <span className="meter" style={{ flex: 1 }}><i style={{ width: `${Math.min(100, (al / Math.max(1, t.territory.slots)) * 100)}%`, background: full ? "var(--s-adv)" : "var(--s-wait)" }} /></span>
                  <b className="mono" style={{ fontSize: 12, width: 28, textAlign: "right" }}>{al}/{t.territory.slots}</b>
                </button>
              );
            })}
          </div>
        </Card>

        <Card i={6}>
          <h3><Ic n="alert" />Alerts</h3>
          <div className="stack" style={{ gap: 6 }}>
            {alerts.length ? alerts.map((a) => (
              <div key={a.text} className="row alert" data-s={a.s} style={{ gap: 10 }}>
                <span className="bucket"><span className="ic" style={{ width: 30, height: 30, fontSize: 15 }}><Ic n={a.icon} /></span></span>
                <span style={{ flex: 1, fontSize: 13 }}>{a.text}</span>
                <button className="btn sm" onClick={a.go}>{a.label}</button>
              </div>
            )) : <div className="muted" style={{ padding: 12, textAlign: "center" }}>Nothing needs attention.</div>}
          </div>
        </Card>
      </div>

      <Card i={7} id="queue-card">
        <h3>
          <Ic n="star" />Approval queue · {yes.length}
          <span className="sp" />
          <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>Best fit first</span>
        </h3>
        {yes.length > 0 && <SendBar items={yes} sel={sel} setSel={setSel} verb="Send next steps to" />}
        {yes.length ? (
          <>
            <div className="agrid">{shown.map((it, i) => <ApprovalCard key={it.id} it={it} i={i} on={!!sel[it.id]} toggle={() => toggle(it.id)} />)}</div>
            {yes.length > 6 && <button className="btn" style={{ display: "flex", margin: "10px auto 0" }} onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${yes.length}`}</button>}
          </>
        ) : <div className="muted" style={{ padding: 20, textAlign: "center" }}>Nobody is waiting. Everyone you approved is in Onboarding.</div>}
      </Card>

      <div className="grid g2">
        <Card i={8} id="emails-card">
          <h3><Ic n="mail" />Emails ready to send · {emails}</h3>
          <div className="seg" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
            {GL.map(([k, ic, l]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}><Ic n={ic} />{l}<span className="n" style={{ marginLeft: 2 }}>{groups[k].length}</span></button>
            ))}
          </div>
          {groups[tab].length > 0 && <SendBar items={groups[tab]} sel={sel} setSel={setSel} verb="Send to" />}
          <div className="stack" style={{ gap: 2 }}>
            {groups[tab].length ? groups[tab].map((it) => <MiniRow key={it.id} it={it} on={!!sel[it.id]} toggle={() => toggle(it.id)} />) : <div className="muted" style={{ padding: 16, textAlign: "center" }}>All done here.</div>}
          </div>
        </Card>

        <div className="stack" id="inbox-card">
          <Card i={9}>
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
                        <div className="muted clip2" style={{ fontSize: 12.5 }}>“{rp.text}”</div>
                      </div>
                      <button className="btn sm primary" onClick={() => ui.open(rp.id, "facts", rp.text)}><Ic n="zap" />Apply</button>
                    </div>
                  );
                })
              ) : (
                <div className="muted">No new replies. Paste a reply into any applicant’s Facts tab to update them.</div>
              )}
            </div>
          </Card>
          <Card i={10}>
            <h3><Ic n="clock" />Slow to reply · {asked.length}</h3>
            <div className="stack" style={{ gap: 6 }}>
              {asked.length ? (
                asked.map((r) => (
                  <div key={r.id} className="row" style={{ gap: 10, padding: 8, borderRadius: "var(--r-sm)", background: "var(--surface2)" }}>
                    <Ring v={r.fit} size={34} sw={4} s="info" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{r.app.name}</b>
                      <div className="muted clip1" style={{ fontSize: 12.5 }}>Asked {ago(desk.mail[r.id].at, now)}. {r.asks[0] ?? ""}</div>
                    </div>
                    <button className="btn sm primary" onClick={() => { ws.remind(r.id); ui.toast(`Reminder sent to ${r.app.name}`); }}><Ic n="bell" />Remind</button>
                  </div>
                ))
              ) : (
                <div className="muted">Everyone replied.</div>
              )}
            </div>
          </Card>
          {toReview.length > 0 && (
            <Card i={11} data-s="info">
              <h3><Ic n="file" />Documents to review · {docs}</h3>
              <div className="stack" style={{ gap: 6 }}>
                {toReview.map((x) => (
                  <div key={x.id} className="row" style={{ gap: 10, padding: 8, borderRadius: "var(--r-sm)", background: "var(--surface2)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}><b>{x.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{x.keys.length} document{x.keys.length === 1 ? "" : "s"} ready to verify</div></div>
                    <button className="btn sm primary" onClick={() => ui.go("onboarding", { onb: x.id })}><Ic n="eye" />Review</button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card i={12} id="spot-card">
        <h3>
          <Ic n="shield" />Spot-check the engine · {spot.length - spotLeft} of {spot.length}
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
                  <div className="muted clip2" style={{ fontSize: 12.5 }}>{r.why}</div>
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
