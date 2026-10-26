"use client";

import { useState, type CSSProperties } from "react";
import { Ic } from "./Icon";
import { Chip, Ring, Tag, useUi } from "./kit";
import { countBy, terrOf, type Row } from "@/lib/desk/model";
import { UI_META, UI_ORDER, type UiStatus } from "@/lib/desk/types";
import { ago } from "@/lib/desk/time";

function dest(r: Row): [string, string, "onboarding" | "expansion" | null] | null {
  return r.moved === "onb" ? ["clip", "In Onboarding", "onboarding"] : r.moved === "closed" ? ["x", "Closed, emailed", null] : r.moved === "exp" ? ["globe", "On Expansion list", "expansion"] : null;
}

export function PipelineView() {
  const ui = useUi();
  const { ws, nav, setNav, now } = ui;
  const { rows, desk, result } = ws;
  const [limit, setLimit] = useState(50);
  if (!result) return null;
  const base = rows.filter((r) => nav.showMoved || !r.moved);
  const n = countBy(base);
  const moved = rows.filter((r) => r.moved).length;
  const picked = Object.keys(nav.pick).filter((k) => nav.pick[k]);

  let list = base.filter((r) => nav.filter === "all" || r.ui === nav.filter);
  if (nav.terrF) list = list.filter((r) => terrOf(result, r.app.pin) === nav.terrF || r.slotTerr === nav.terrF);
  const q = nav.q.trim().toLowerCase();
  if (q) list = list.filter((r) => `${r.id} ${r.app.name} ${r.app.city ?? r.app.cityRaw} ${r.app.pin ?? r.app.pinRaw}`.toLowerCase().includes(q));
  if (nav.sort === "fit") list = [...list].sort((a, b) => b.fit - a.fit);
  if (nav.sort === "status") list = [...list].sort((a, b) => UI_ORDER.indexOf(a.ui) - UI_ORDER.indexOf(b.ui));

  return (
    <div className="stack">
      <div className="row wrap">
        <label className="search">
          <Ic n="search" />
          <input placeholder="Search name, pin, city" value={nav.q} onChange={(e) => setNav({ q: e.target.value })} />
        </label>
        <span className="seg">
          <button className={nav.mode === "list" ? "on" : ""} onClick={() => setNav({ mode: "list" })}><Ic n="list" />List</button>
          <button className={nav.mode === "terr" ? "on" : ""} onClick={() => setNav({ mode: "terr" })}><Ic n="layers" />By territory</button>
        </span>
        <span className="sp" />
        <select className="sel" aria-label="Sort" value={nav.sort} onChange={(e) => setNav({ sort: e.target.value as typeof nav.sort })}>
          <option value="fit">Sort: best fit</option>
          <option value="status">Sort: status</option>
          <option value="sheet">Sort: sheet order</option>
        </select>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <button className={`fchip${nav.filter === "all" ? " on" : ""}`} onClick={() => setNav({ filter: "all" })}>All <span className="n">{base.length}</span></button>
        {UI_ORDER.map((s) => (
          <button key={s} className={`fchip${nav.filter === s ? " on" : ""}`} data-s={s} onClick={() => (s === "exp" ? ui.go("expansion") : setNav({ filter: s }))} title={s === "exp" ? "Open the Expansion list" : undefined}>
            <Ic n={UI_META[s].icon} />
            {UI_META[s].label} <span className="n">{s === "exp" ? ws.expList.length : n[s]}</span>
          </button>
        ))}
        <span className="sp" />
        <label className="row" style={{ gap: 6, fontSize: 12.5 }}>
          <input type="checkbox" checked={nav.showMoved} onChange={(e) => setNav({ showMoved: e.target.checked })} /> Show the {moved} who moved on
        </label>
      </div>
      {nav.terrF && (
        <div className="row" style={{ gap: 8 }}>
          <Tag icon="layers">Territory {nav.terrF}</Tag>
          <button className="btn sm ghost" onClick={() => setNav({ terrF: null })}><Ic n="x" />Clear</button>
        </div>
      )}
      <div className="muted" style={{ fontSize: 12.5 }}>
        <Ic n="info" /> <b>Fit</b> is how well someone matches the brand rules, 0 to 100. People who were emailed and moved forward leave this list and appear in Onboarding.
      </div>

      {nav.mode === "terr" ? (
        <TerritoryCards />
      ) : (
        <>
          {picked.length > 0 && (
            <div className="card row rise" style={{ padding: "10px 14px", gap: 10, borderColor: "var(--accent)", flexWrap: "wrap" }}>
              <b>{picked.length} selected</b>
              <span className="sp" />
              {(["info", "wait", "no", "exp"] as UiStatus[]).map((t) => (
                <button key={t} className="btn sm" onClick={() => ui.move(picked, { target: t })}><Ic n={UI_META[t].icon} />{UI_META[t].label}</button>
              ))}
              <button className="btn sm ghost" onClick={() => setNav({ pick: {} })}>Clear</button>
            </div>
          )}
          <div className="card tw" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th className="ck" />
                  <th>Applicant</th>
                  <th>Place</th>
                  <th>Status</th>
                  <th title="How well they match the brand rules, 0 to 100">Fit</th>
                  <th>Why</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.slice(0, limit).map((r) => {
                  const d = dest(r);
                  const m = desk.mail[r.id];
                  return (
                    <tr key={r.id} className="r" onClick={() => ui.open(r.id)}>
                      <td className="ck" data-l="" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${r.app.name}`} checked={!!nav.pick[r.id]} disabled={!!d} onChange={(e) => setNav({ pick: { ...nav.pick, [r.id]: e.target.checked } })} />
                      </td>
                      <td data-l="Applicant">
                        <b>{r.app.name}</b>
                        <div className="muted mono" style={{ fontSize: 11.5 }}>{r.id}</div>
                      </td>
                      <td data-l="Place">
                        {r.app.city ?? r.app.cityRaw}
                        <div className="muted mono" style={{ fontSize: 11.5 }}>{r.app.pin ?? r.app.pinRaw}</div>
                      </td>
                      <td data-l="Status">
                        <Chip s={r.ui} />
                        {r.move && <span className="muted" style={{ fontSize: 11 }}> engine: {UI_META[r.engine].label}</span>}{" "}
                        {r.move && <Tag>Your call</Tag>} {r.locked && <Tag icon="lock">Locked</Tag>}{" "}
                        {r.tag === "pin" && r.ui === "info" && <Tag warn icon="alert">Pin</Tag>} {r.tag === "dup" && <Tag warn>Duplicate</Tag>}{" "}
                        {r.ui === "info" && m && <Tag>Asked {ago(m.at, now)}</Tag>} {r.ui === "wait" && m && <Tag>Told</Tag>}{" "}
                        {d && <button className="tag" onClick={(e) => { e.stopPropagation(); if (d[2]) ui.go(d[2], { onb: r.id }); }}><Ic n={d[0]} />{d[1]}{d[2] ? " →" : ""}</button>}
                      </td>
                      <td data-l="Fit">
                        <Ring v={r.fit} size={36} sw={4} s={r.ui} />
                        {r.offer !== undefined && <div className="muted mono" style={{ fontSize: 10.5 }}>if moved {r.offer}</div>}
                      </td>
                      <td data-l="Why" className="muted" style={{ minWidth: 200 }}>{r.why}</td>
                      <td data-l="" className="acts2" onClick={(e) => e.stopPropagation()}>
                        {!d && (
                          <>
                            <button className="btn sm" title="Move to another bucket" onClick={() => ui.move([r.id])}><Ic n="move" />Move</button>
                            <button className="btn sm" aria-label={`Email ${r.app.name}`} onClick={() => ui.mail(r.id)}><Ic n="mail" /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!list.length && <div className="muted" style={{ padding: 24, textAlign: "center" }}>No applicants match.</div>}
            {list.length > limit && (
              <div className="row" style={{ padding: 12, justifyContent: "center", gap: 10 }}>
                <span className="muted">Showing {limit} of {list.length}</span>
                <button className="btn sm" onClick={() => setLimit(limit + 50)}>Show 50 more</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TerritoryCards() {
  const ui = useUi();
  const { ws } = ui;
  const { rows, result } = ws;
  if (!result) return null;
  return (
    <>
      <p className="muted" style={{ margin: 0 }}>Each card is a territory. The bars are its open slots, the chips are its pins. Click a pin to act on it.</p>
      <div className="grid g2">
        {result.territories.map((tv, i) => {
          const t = tv.territory;
          const allocated = rows.filter((r) => r.slotTerr === t.id && (r.ui === "adv" || r.ui === "redir"));
          const taken = new Set(allocated.map((r) => r.slotPin));
          const storePins = new Set(tv.blockedPins.map((b) => b.pin));
          const line = rows.filter((r) => terrOf(result, r.app.pin) === t.id && !r.slotPin && r.ui !== "exp" && !r.withdrawn);
          return (
            <div key={t.id} className="card rise" style={{ "--i": i } as CSSProperties}>
              <div className="row">
                <b style={{ fontFamily: "var(--f-display)", fontSize: 16 }}>{t.city}</b>
                <span className="tag mono">{t.id}</span>
                <span className="sp" />
                <span className="tag">{t.tier} · {t.priority} priority</span>
              </div>
              <div className="row" style={{ margin: "12px 0 6px" }}>
                <span className="muted">Slots</span>
                {Array.from({ length: Math.max(t.slots, 1) }).map((_, k) => (
                  <span key={k} className="pop" style={{ "--i": k, width: 26, height: 10, borderRadius: 99, background: k < allocated.length ? "var(--s-adv)" : "var(--line)" } as CSSProperties} />
                ))}
                <span className="mono muted" style={{ fontSize: 11.5 }}>{allocated.length}/{t.slots}{tv.capacity < t.slots ? ` · only ${tv.capacity} free pins` : ""}</span>
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                {t.pins.map((p) => {
                  if (storePins.has(p)) return <button key={p} className="tag" style={{ background: "var(--ink)", color: "var(--surface)", borderColor: "var(--ink)" }} onClick={() => ui.modal({ kind: "store", pin: p })}><Ic n="build" />{p} · store</button>;
                  const al = allocated.find((r) => r.slotPin === p);
                  if (al) return <button key={p} className="chip" data-s={al.ui} onClick={() => ui.open(al.id)}><Ic n={UI_META[al.ui].icon} />{p} · {al.app.name.split(" ")[0]}</button>;
                  if (!taken.has(p) && allocated.length < tv.capacity) return <button key={p} className="tag" style={{ borderStyle: "dashed" }} onClick={() => ui.modal({ kind: "pin", pin: p, terr: t.id })}><Ic n="plus" />{p} · free</button>;
                  return <span key={p} className="tag">{p} · no slot</span>;
                })}
              </div>
              {line.length > 0 && (
                <>
                  <div className="eyebrow" style={{ margin: "12px 0 6px" }}>In line for this territory</div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    {line.map((r) => (
                      <button key={r.id} className="chip" data-s={r.ui} onClick={() => ui.open(r.id)}><Ic n={UI_META[r.ui].icon} />{r.app.name.split(" ")[0]}</button>
                    ))}
                  </div>
                </>
              )}
              <button className="btn sm" style={{ marginTop: 12 }} onClick={() => ui.go("pipeline", { terr: t.id, mode: "list" })}><Ic n="list" />Show these applicants in the list</button>
            </div>
          );
        })}
      </div>
    </>
  );
}

