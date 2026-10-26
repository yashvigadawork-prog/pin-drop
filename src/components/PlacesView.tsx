"use client";

import { useState, type CSSProperties } from "react";
import { Ic } from "./Icon";
import { useUi } from "./kit";
import { ExpansionView } from "./ExpansionView";
import { MapView } from "./MapView";
import { terrOf } from "@/lib/desk/model";
import { UI_META } from "@/lib/desk/types";

export function PlacesView() {
  const ui = useUi();
  const { nav, setNav, ws } = ui;
  return (
    <div className="stack">
      <MapView />
      <div className="seg" id="places-tabs" style={{ alignSelf: "flex-start" }}>
        <button className={nav.placesTab === "terr" ? "on" : ""} onClick={() => setNav({ placesTab: "terr" })}><Ic n="layers" />Territories</button>
        <button className={nav.placesTab === "exp" ? "on" : ""} onClick={() => setNav({ placesTab: "exp" })}><Ic n="globe" />Expansion list<span className="n" style={{ marginLeft: 2 }}>{ws.expList.length}</span></button>
      </div>
      {nav.placesTab === "terr" ? <TerritoryCards /> : <ExpansionView />}
    </div>
  );
}

function TerritoryCards() {
  const ui = useUi();
  const { ws } = ui;
  const { rows, result } = ws;
  const [cmp, setCmp] = useState(false);
  const [pinned, setPinned] = useState<string | null>(null);
  if (!result) return null;
  const data = result.territories.map((tv) => {
    const t = tv.territory;
    const allocated = rows.filter((r) => r.slotTerr === t.id && (r.ui === "adv" || r.ui === "redir"));
    const line = rows.filter((r) => terrOf(result, r.app.pin) === t.id && !r.slotPin && r.ui !== "exp" && !r.withdrawn);
    return { tv, t, allocated, line, taken: new Set(allocated.map((r) => r.slotPin)), storePins: new Set(tv.blockedPins.map((b) => b.pin)) };
  });
  return (
    <>
      <div className="row wrap" style={{ gap: 10 }}>
        <p className="muted" style={{ margin: 0, flex: 1, minWidth: 220 }}>Point at a territory to see its pins and people. Tap on a phone.</p>
        <button className={`btn${cmp ? " primary" : ""}`} onClick={() => setCmp(!cmp)}><Ic n="layers" />{cmp ? "Back to cards" : "Comprehensive comparative view"}</button>
      </div>
      {cmp ? (
        <div className="card tw rise" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr><th>Territory</th><th>Tier · priority</th><th>Slots filled</th><th>Free pins</th><th>Store pins</th><th>Accepted</th><th>In line</th><th>Avg fit, accepted</th><th>Top candidate</th><th>Note</th></tr>
            </thead>
            <tbody>
              {data.map(({ tv, t, allocated, line, storePins }) => {
                const top = [...allocated, ...line].sort((a, b) => b.fit - a.fit)[0];
                const avg = allocated.length ? Math.round(allocated.reduce((a, r) => a + r.fit, 0) / allocated.length) : null;
                return (
                  <tr key={t.id} className="r" onClick={() => ui.go("pipeline", { terr: t.id })}>
                    <td data-l="Territory"><b>{t.city}</b><div className="muted mono" style={{ fontSize: 11.5 }}>{t.id}</div></td>
                    <td data-l="Tier">{t.tier} · {t.priority}</td>
                    <td data-l="Slots"><b className="mono">{allocated.length}/{t.slots}</b></td>
                    <td data-l="Free pins" className="mono">{tv.freePins.length}</td>
                    <td data-l="Store pins" className="mono">{storePins.size}</td>
                    <td data-l="Accepted" className="mono">{allocated.length}</td>
                    <td data-l="In line" className="mono">{line.length}</td>
                    <td data-l="Avg fit">{avg ?? "–"}</td>
                    <td data-l="Top">{top ? <span>{top.app.name} <span className="muted mono">{top.fit}</span></span> : "–"}</td>
                    <td data-l="Note" className="muted" style={{ minWidth: 160 }}>{tv.capacity < t.slots ? `Only ${tv.capacity} free pins` : tv.issues[0] ?? "OK"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid g3">
          {data.map(({ tv, t, allocated, line, taken, storePins }, i) => {
            const open = pinned === t.id;
            return (
              <div key={t.id} className={`card tcard rise${open ? " open" : ""}`} style={{ "--i": i } as CSSProperties} tabIndex={0} onClick={() => setPinned(open ? null : t.id)} onKeyDown={(e) => e.key === "Enter" && setPinned(open ? null : t.id)}>
                <div className="row">
                  <b style={{ fontFamily: "var(--f-display)", fontSize: 15 }}>{t.city}</b>
                  <span className="tag mono">{t.id}</span>
                  <span className="sp" />
                  <span className="mono muted" style={{ fontSize: 12 }}>{allocated.length}/{t.slots}</span>
                </div>
                <div className="row" style={{ margin: "10px 0 6px", gap: 4 }}>
                  {Array.from({ length: Math.max(t.slots, 1) }).map((_, k) => (
                    <span key={k} className="pop" style={{ "--i": k, flex: 1, height: 8, borderRadius: 99, background: k < allocated.length ? "var(--s-adv)" : "var(--line)" } as CSSProperties} />
                  ))}
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>{allocated.length} accepted · {line.length} in line{tv.capacity < t.slots ? ` · ${tv.capacity} free pins` : ""}</div>
                <div className="tdetail" onClick={(e) => e.stopPropagation()}>
                  <div className="row wrap" style={{ gap: 6 }}><span className="tag">{t.tier}</span><span className="tag">{t.priority} priority</span></div>
                  <div className="eyebrow">Pins</div>
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
                      <div className="eyebrow">In line</div>
                      <div className="row wrap" style={{ gap: 6 }}>
                        {line.map((r) => <button key={r.id} className="chip" data-s={r.ui} onClick={() => ui.open(r.id)}><Ic n={UI_META[r.ui].icon} />{r.app.name.split(" ")[0]}</button>)}
                      </div>
                    </>
                  )}
                  <button className="btn sm" onClick={() => ui.go("pipeline", { terr: t.id })}><Ic n="list" />Show these applicants</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
