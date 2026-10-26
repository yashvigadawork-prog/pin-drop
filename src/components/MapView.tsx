"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Ic } from "./Icon";
import { Chip, Ring, useUi } from "./kit";
import { MapCanvas } from "./MapCanvas";
import { byCity, countBy } from "@/lib/desk/model";
import { MAP_CITIES, UI_ORDER } from "@/lib/desk/types";

export function MapView() {
  const ui = useUi();
  const { ws, nav, setNav } = ui;
  const { rows, input, expList } = ws;
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (nav.city) panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [nav.city]);
  if (!input) return null;
  const exp = Object.fromEntries(byCity(expList));
  const c = MAP_CITIES.find((x) => x.n === nav.city);
  const apps = c ? rows.filter((r) => (r.app.city ?? r.app.cityRaw) === c.n) : [];
  const waiting = c ? expList.filter((e) => e.city === c.n) : [];
  const stores = c ? input.stores.filter((s) => s.city === c.n) : [];
  const n = countBy(apps);

  return (
    <div className="mapwrap">
      <div className="map rise">
        <MapCanvas rows={rows} stores={input.stores} expCounts={exp} layers={nav.layers} selected={nav.city} onCity={(city) => setNav({ city })} />
        <div className="maplegend">
          {(["app", "store", "exp"] as const).map((k) => (
            <label key={k}>
              <input type="checkbox" checked={nav.layers[k]} onChange={(e) => setNav({ layers: { ...nav.layers, [k]: e.target.checked } })} /> {k === "app" ? "Applicants" : k === "store" ? "Stores" : "Expansion interest"}
            </label>
          ))}
        </div>
      </div>
      <div className="card rise" ref={panel}>
        {!c ? (
          <>
            <h3><Ic n="map" />Karnataka at a glance</h3>
            <div className="grid" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
              {[
                ["pin", String(MAP_CITIES.filter((x) => x.served).length), "Cities served", () => ui.go("settings", { settings: "areas" })],
                ["build", String(input.stores.length), "Stores open", () => ui.modal({ kind: "stores" })],
                ["users", String(rows.length), "Applicants", () => ui.go("pipeline", { filter: "all" })],
                ["globe", String(expList.length), "Waiting for expansion", () => ui.go("expansion")],
              ].map(([icon, num, label, go], i) => (
                <button key={label as string} className="bucket pop" style={{ "--i": i, textAlign: "left", padding: 10, borderRadius: "var(--r-sm)" } as CSSProperties} onClick={go as () => void}>
                  <span className="ic" style={{ color: "var(--accent)", background: "color-mix(in srgb,var(--accent) 14%,var(--surface))" }}><Ic n={icon as string} /></span>
                  <div className="num" style={{ fontSize: 30 }}>{num as string}</div>
                  <p>{label as string} <Ic n="arrow" /></p>
                </button>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 14 }}>Click a city on the map to see its applicants, stores and waiting demand. Use the boxes on the map to show or hide layers.</p>
          </>
        ) : (
          <>
            <div className="row">
              <h3 style={{ margin: 0, fontSize: 20 }}>{c.n}</h3>
              <span className="tag">{c.served ? "Served" : "Not served yet"}</span>
              <span className="sp" />
              <button className="btn ghost sm round" aria-label="Back to overview" onClick={() => setNav({ city: null })}><Ic n="x" /></button>
            </div>
            <div className="row wrap" style={{ margin: "12px 0", gap: 6 }}>
              <span className="tag"><Ic n="build" />{stores.length} stores</span>
              <span className="tag"><Ic n="users" />{apps.length} applicants</span>
              <span className="tag"><Ic n="globe" />{waiting.length} waiting</span>
            </div>
            {apps.length > 0 && <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>{UI_ORDER.filter((s) => n[s]).map((s) => <Chip key={s} s={s} extra={` ${n[s]}`} />)}</div>}
            {stores.length > 0 && (
              <>
                <div className="eyebrow" style={{ marginBottom: 4 }}>Stores</div>
                <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
                  {stores.map((s) => <button key={s.id} className="tag" onClick={() => ui.modal({ kind: "store", pin: s.pin })}><Ic n="build" />{s.id} · {s.pin}</button>)}
                </div>
              </>
            )}
            {apps.length > 0 && (
              <>
                <div className="eyebrow" style={{ marginBottom: 4 }}>Applicants</div>
                <div className="stack" style={{ gap: 2 }}>
                  {apps.map((r) => (
                    <div key={r.id} className="lrow" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }} onClick={() => ui.open(r.id)}>
                      <Ring v={r.fit} size={34} sw={4} s={r.ui} />
                      <div className="nm">{r.app.name}<small>{r.app.pin ?? r.app.pinRaw}{r.moved ? " · moved on" : ""}</small></div>
                      <Chip s={r.ui} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {waiting.length > 0 && <button className="btn" style={{ marginTop: 12 }} onClick={() => ui.go("expansion", { expF: c.n, expCity: c.n })}><Ic n="globe" />Open the {waiting.length} waiting in Expansion list</button>}
            {!apps.length && !waiting.length && <p className="muted">No applicants or waiting people here yet.</p>}
          </>
        )}
      </div>
    </div>
  );
}
