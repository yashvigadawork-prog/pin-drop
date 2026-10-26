"use client";

import { useId, type CSSProperties, type KeyboardEvent } from "react";
import type { Row } from "@/lib/desk/model";
import { MAP_CITIES } from "@/lib/desk/types";

// The map is the district map supplied by the owner (public/karnataka-*.png, 476 x 645 source).
// Cities are placed from real latitude and longitude, fitted to the drawn outline.
const SCALE = 1.17; // source pixels to svg units
const BOX = { x0: 45, y0: 9, x1: 438, y1: 625 }; // outline bounds in the source image
const GEO = { lon0: 74.05, lon1: 78.59, lat0: 11.5, lat1: 18.45 }; // Karnataka's extremes
const px = (lon: number, lat: number): [number, number] => [
  (BOX.x0 + ((lon - GEO.lon0) / (GEO.lon1 - GEO.lon0)) * (BOX.x1 - BOX.x0)) * SCALE,
  (BOX.y0 + ((GEO.lat1 - lat) / (GEO.lat1 - GEO.lat0)) * (BOX.y1 - BOX.y0)) * SCALE,
];
const LABEL_LEFT = new Set(["Mangaluru", "Udupi", "Belagavi", "Hubballi-Dharwad"]); // near the west edge: write the name beside the pin

export interface MapProps {
  rows?: Row[];
  stores?: { city: string }[];
  expCounts?: Record<string, number>;
  layers?: { app: boolean; store: boolean; exp: boolean };
  selected?: string | null;
  onCity?: (c: string) => void;
  compact?: boolean;
}

export function MapCanvas({ rows = [], stores = [], expCounts = {}, layers = { app: true, store: true, exp: true }, selected, onCity, compact }: MapProps) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg className="k" viewBox="0 0 560 760" role="img" aria-label="Map of Karnataka with cities, stores, applicants and expansion interest">
      <defs>
        <mask id={`kf${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="560" height="760"><image href="/karnataka-fill.png" width={476 * SCALE} height={645 * SCALE} /></mask>
        <mask id={`kl${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="560" height="760"><image href="/karnataka-lines.png" width={476 * SCALE} height={645 * SCALE} /></mask>
      </defs>
      <rect className="kland" width="560" height="760" mask={`url(#kf${uid})`} />
      <rect className="klines" width="560" height="760" mask={`url(#kl${uid})`} />
      {MAP_CITIES.map((c, ci) => {
        const [x, y] = px(c.lon, c.lat);
        const apps = rows.filter((r) => (r.app.city ?? r.app.cityRaw) === c.n);
        const nStores = stores.filter((s) => s.city === c.n).length;
        const sel = selected === c.n;
        const key = (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCity?.(c.n);
          }
        };
        return (
          <g key={c.n} className={`cnode${sel ? " sel" : ""}`} tabIndex={onCity ? 0 : -1} role="button" aria-label={c.n} onClick={() => onCity?.(c.n)} onKeyDown={key}>
            {c.served ? (
              <>
                <circle className="halo" cx={x} cy={y} r={compact ? 26 : 30} />
                {(layers.app || compact) &&
                  apps.map((a, k) => {
                    const ang = (k / apps.length) * Math.PI * 2 - Math.PI / 2;
                    const r = 22 + (k % 2) * 3;
                    return <circle key={a.id} data-s={a.ui} cx={x + r * Math.cos(ang)} cy={y + r * Math.sin(ang) - 6} r="5" fill="var(--c)" stroke="var(--surface)" strokeWidth="1.5" />;
                  })}
                {(layers.store || compact) &&
                  Array.from({ length: nStores }).map((_, s) => {
                    const an = Math.PI * 0.2 + s * 0.45;
                    return <rect key={s} x={x + 36 * Math.cos(an) - 3.5} y={y + 36 * Math.sin(an) - 9} width="7" height="7" rx="1.5" fill="var(--ink)" />;
                  })}
                <g transform={`translate(${x - 13},${y - 30})`}>
                  <g className="drop" style={{ "--i": ci } as CSSProperties}>
                    <path transform="scale(1.1)" d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="var(--primary)" />
                    <circle transform="scale(1.1)" cx="12" cy="10" r="2.7" fill="var(--accent)" />
                  </g>
                </g>
              </>
            ) : layers.exp || compact ? (
              <>
                <circle className="pulse" cx={x} cy={y} r="13" style={{ "--i": ci } as CSSProperties} />
                <circle className="pulse" cx={x} cy={y} r="13" style={{ "--i": ci + 3 } as CSSProperties} />
                <circle cx={x} cy={y} r="12" fill="var(--surface)" stroke="var(--s-exp)" strokeWidth="2" strokeDasharray="3 3" />
                {expCounts[c.n] ? <text x={x} y={y + 4} textAnchor="middle" style={{ stroke: "none", fill: "var(--s-exp)" }}>{expCounts[c.n]}</text> : null}
              </>
            ) : null}
            {(c.served || layers.exp || compact) && (LABEL_LEFT.has(c.n) ? <text x={x - 16} y={y + 4} textAnchor="end">{c.n}</text> : <text x={x} y={y + (c.served ? 18 : 28)} textAnchor="middle">{c.n}</text>)}
          </g>
        );
      })}
    </svg>
  );
}
