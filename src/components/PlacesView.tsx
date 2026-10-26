"use client";

import type { CSSProperties } from "react";
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
              <button className="btn sm" style={{ marginTop: 12 }} onClick={() => ui.go("pipeline", { terr: t.id })}><Ic n="list" />Show these applicants in the list</button>
            </div>
          );
        })}
      </div>
    </>
  );
}

