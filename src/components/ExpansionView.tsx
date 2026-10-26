"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Ic } from "./Icon";
import { BucketIcon, Card, Chip, CountUp, Ring, useUi } from "./kit";
import { byCity } from "@/lib/desk/model";
import { ago } from "@/lib/desk/time";

export function ExpansionView() {
  const ui = useUi();
  const { ws, nav, setNav, now } = ui;
  const { rows, desk, expList } = ws;
  const table = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (nav.expF) table.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [nav.expF]);
  const cities = byCity(expList);
  const max = cities[0]?.[1] ?? 1;
  const fresh = rows.filter((r) => r.ui === "exp" && !desk.onb[r.id] && !desk.mail["exp:" + r.id]);
  const shown = nav.expF ? expList.filter((e) => e.city === nav.expF) : expList;
  const area = cities.some((c) => c[0] === nav.expCity) ? nav.expCity : cities[0]?.[0] ?? "";
  const match = expList.filter((e) => e.city === area);
  const notYet = match.filter((e) => !desk.mail["exp2:" + e.id]);

  return (
    <div className="stack">
      <div className="grid g3">
        {[
          ["help", "info", "1 · Typo or wrong pin", "We ask them to confirm. Nothing is rejected."],
          ["globe", "exp", "2 · Valid pin we do not serve", "They land on this list and get a polite email."],
          ["check", "adv", "3 · Served and free", "Decided as usual: Proceed, new pin or Waitlist."],
        ].map(([ic, s, t, d], i) => (
          <div key={t} className="card row flat rise" data-s={s} style={{ "--i": i, gap: 12 } as CSSProperties}>
            <BucketIcon icon={ic} />
            <div><b>{t}</b><div className="muted" style={{ fontSize: 12.5 }}>{d}</div></div>
          </div>
        ))}
      </div>

      {fresh.length > 0 && (
        <div className="card row rise" data-s="exp" style={{ gap: 12, borderColor: "color-mix(in srgb,var(--s-exp) 50%,var(--line))", flexWrap: "wrap" }}>
          <BucketIcon icon="spark" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <b>{fresh.length} new {fresh.length === 1 ? "person" : "people"} added today</b>
            <div className="muted" style={{ fontSize: 12.5 }}>{fresh.map((r) => `${r.app.name} (${r.app.city ?? r.app.cityRaw})`).join(", ")}</div>
          </div>
          <button className="btn primary" onClick={() => ui.review("fresh")}><Ic n="eye" />Review and send “we’ll keep you on file”</button>
        </div>
      )}

      {expList.length === 0 ? (
        <Card><div style={{ textAlign: "center", padding: 20 }}><BucketIcon icon="globe" /><h3 style={{ justifyContent: "center", marginTop: 10 }}>Nobody waiting yet</h3><p className="muted">When someone applies for a valid pin we do not serve, they land here instead of being rejected.</p></div></Card>
      ) : (
        <>
          <div className="grid g2">
            <Card i={1}>
              <h3>
                <Ic n="globe" />By area<span className="sp" />
                <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}><CountUp to={expList.length} /> people · {cities.length} areas</span>
              </h3>
              <div className="stack" style={{ gap: 6 }} data-s="exp">
                {cities.map((c, i) => (
                  <button key={c[0]} className={`row areabtn${nav.expF === c[0] ? " on" : ""}`} style={{ gap: 10, textAlign: "left" }} title={`Filter the table to ${c[0]}`} onClick={() => setNav({ expF: nav.expF === c[0] ? null : c[0], expCity: c[0] })}>
                    <span style={{ width: 104, fontWeight: 600 }}>{c[0]}</span>
                    <span className="meter" style={{ flex: 1 }}><i className="grow-x" style={{ "--i": i, width: `${(c[1] / max) * 100}%`, background: "var(--s-exp)" } as CSSProperties} /></span>
                    <b className="mono">{c[1]}</b>
                    {c[1] >= desk.expThreshold && <span className="tag">Consider</span>}
                  </button>
                ))}
              </div>
              <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
                <span className="muted" style={{ fontSize: 12.5 }}>Flag an area as worth opening when it has at least</span>
                <select className="sel" style={{ height: 30 }} aria-label="Threshold" value={desk.expThreshold} onChange={(e) => ws.setThreshold(Number(e.target.value))}>
                  {[2, 3, 5].map((v) => <option key={v}>{v}</option>)}
                </select>
                <span className="muted" style={{ fontSize: 12.5 }}>people</span>
              </div>
            </Card>
            <Card i={2} data-s="exp">
              <h3><Ic n="send" />Reach out when we expand</h3>
              <div className="stack">
                <div className="row wrap">
                  <span className="muted">We are expanding to</span>
                  <select className="sel" aria-label="Area" value={area} onChange={(e) => setNav({ expCity: e.target.value })}>
                    {cities.map((c) => <option key={c[0]}>{c[0]}</option>)}
                  </select>
                </div>
                <div className="row" style={{ gap: 12 }}>
                  <BucketIcon icon="users" />
                  <span><CountUp className="num" to={match.length} style={{ fontSize: 30, fontFamily: "var(--f-display)", fontWeight: 700 }} /> <span className="muted">applied here earlier, {notYet.length} not told yet. Their old details are ready to restart.</span></span>
                </div>
                <div className="row wrap">
                  <button className="btn primary" disabled={!notYet.length} onClick={() => { setNav({ expCity: area }); ui.review("exp2"); }}><Ic n="eye" />Review and send</button>
                </div>
              </div>
            </Card>
          </div>

          {nav.expF && (
            <div className="row" style={{ gap: 8 }}>
              <span className="tag"><Ic n="pin" />Showing {nav.expF}</span>
              <button className="btn sm ghost" onClick={() => setNav({ expF: null })}><Ic n="x" />Show everyone</button>
            </div>
          )}
          <div className="card tw rise" ref={table} style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr><th>Person</th><th>Pin and area</th><th>Why they are here</th><th>Fit</th><th>Added</th><th>Email 1: keep on file</th><th>Email 2: we expanded</th></tr>
              </thead>
              <tbody>
                {shown.map((e) => {
                  const s1 = desk.mail["exp:" + e.id];
                  const s2 = desk.mail["exp2:" + e.id];
                  const isApp = rows.some((r) => r.id === e.id);
                  return (
                    <tr key={e.id} className="r" onClick={() => isApp && ui.open(e.id)}>
                      <td data-l="Person"><b>{e.name}</b><div className="muted mono" style={{ fontSize: 11.5 }}>{e.id}</div></td>
                      <td data-l="Pin">{e.city}<div className="muted mono" style={{ fontSize: 11.5 }}>{e.pin}</div></td>
                      <td data-l="Why"><Chip s="exp" /><div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{e.reason}</div></td>
                      <td data-l="Fit"><Ring v={e.fit} size={34} sw={4} s="exp" /></td>
                      <td data-l="Added" className="muted">{e.added}</td>
                      <td data-l="Email 1" onClick={(ev) => ev.stopPropagation()}>
                        {s1 ? <span className="tag"><Ic n="check" />Sent · {s1.at.startsWith("2026-10-") && !isApp ? e.added : ago(s1.at, now)}</span> : <button className="btn sm" onClick={() => { ws.sendMail([{ id: e.id, type: "keep" }]); ui.toast(`Sent to ${e.name}: we’ll keep you on file`); }}><Ic n="send" />Send</button>}
                      </td>
                      <td data-l="Email 2">{s2 ? <span className="tag"><Ic n="check" />Sent</span> : <span className="muted">Waits for expansion</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
