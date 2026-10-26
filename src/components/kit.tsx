"use client";

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Ic } from "./Icon";
import type { Workspace } from "./useWorkspace";
import { UI_META, type UiStatus } from "@/lib/desk/types";
import { statusWord } from "@/lib/engine/engine";

export type View = "overview" | "pipeline" | "onboarding" | "places" | "settings";
// Older names still work as targets: Today is the first Overview tab. Map and Expansion are parts of Places.
export type GoTarget = View | "today" | "map" | "expansion";
export type ReviewBucket = "proceed" | "info" | "wait" | "later" | "fresh" | "exp2";
export type DrawerTab = "why" | "plan" | "facts";

export interface Ui {
  ws: Workspace;
  now: number;
  view: View;
  go: (v: GoTarget, opts?: { onb?: string; settings?: string; filter?: string; terr?: string | null; showMoved?: boolean; placesTab?: "terr" | "exp"; expF?: string | null; expCity?: string }) => void;
  open: (id: string, tab?: DrawerTab, paste?: string) => void;
  mail: (id: string) => void;
  move: (ids: string[], o?: { spot?: boolean; target?: UiStatus }) => void;
  review: (b: ReviewBucket) => void;
  modal: (m: ModalState) => void;
  toast: (text: string, act?: { label: string; run: () => void }) => void;
  chat: (q?: string) => void;
  nav: NavState;
  setNav: (n: Partial<NavState>) => void;
}
export interface NavState {
  filter: UiStatus | "all";
  q: string;
  sort: "fit" | "status" | "sheet";
  showMoved: boolean;
  terrF: string | null;
  pick: Record<string, boolean>;
  setting: string;
  onb: string;
  expF: string | null;
  expCity: string;
  city: string | null;
  layers: { app: boolean; store: boolean; exp: boolean };
  period: "week" | "month";
  ovTab: "now" | "perf";
  placesTab: "terr" | "exp";
}
export type ModalState =
  | { kind: "mail"; id: string; type?: import("@/lib/desk/types").MailType }
  | { kind: "review"; b: ReviewBucket }
  | { kind: "move"; ids: string[]; spot?: boolean; target?: UiStatus }
  | { kind: "pin"; pin: string; terr: string }
  | { kind: "store"; pin: string }
  | { kind: "stores" }
  | { kind: "summary" };

export const UiCtx = createContext<Ui | null>(null);
export function useUi(): Ui {
  const u = useContext(UiCtx);
  if (!u) throw new Error("UiCtx missing");
  return u;
}

export function Chip({ s, extra }: { s: UiStatus; extra?: string }) {
  return (
    <span className="chip" data-s={s}>
      <Ic n={UI_META[s].icon} />
      {UI_META[s].label}
      {extra}
    </span>
  );
}

export function Tag({ children, warn, icon, onClick }: { children: ReactNode; warn?: boolean; icon?: string; onClick?: () => void }) {
  const cls = `tag${warn ? " warn" : ""}`;
  const inner = (
    <>
      {icon && <Ic n={icon} />}
      {children}
    </>
  );
  return onClick ? (
    <button className={cls} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

export function Ring({ v, size = 40, sw = 5, s }: { v: number; size?: number; sw?: number; s?: UiStatus }) {
  const r = (size - sw) / 2;
  const C = 2 * Math.PI * r;
  const len = (C * Math.max(0, Math.min(100, v))) / 100;
  const h = size / 2;
  return (
    <span className="pdring" data-s={s} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle className="track" cx={h} cy={h} r={r} strokeWidth={sw} />
        <circle className="arc" cx={h} cy={h} r={r} fill="none" stroke={s ? "var(--c)" : "var(--accent)"} strokeWidth={sw} strokeLinecap="round" style={{ "--cc": C, strokeDasharray: `${len} ${C}` } as CSSProperties} />
      </svg>
      <span className="v" style={{ fontSize: Math.round(size * 0.3) }}>
        {Math.round(v)}
      </span>
    </span>
  );
}

export function CountUp({ to, className, style }: { to: number; className?: string; style?: CSSProperties }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <span className={className} style={style}>
      {v}
    </span>
  );
}

export function Meter({ pct, color, i = 0, style }: { pct: number; color?: string; i?: number; style?: CSSProperties }) {
  return (
    <span className="meter" style={style}>
      <i className="grow-x" style={{ "--i": i, width: `${Math.max(0, Math.min(100, pct))}%`, ...(color ? { background: color } : {}) } as CSSProperties} />
    </span>
  );
}

export function Card({ children, i = 0, className = "", style, ...rest }: { children: ReactNode; i?: number; className?: string; style?: CSSProperties } & Record<string, unknown>) {
  return (
    <div className={`card rise ${className}`} style={{ "--i": i, ...style } as CSSProperties} {...(rest as object)}>
      {children}
    </div>
  );
}

export function BucketIcon({ icon, size = 38 }: { icon: string; size?: number }) {
  return (
    <span className="bucket">
      <span className="ic" style={{ width: size, height: size, fontSize: size / 2 }}>
        <Ic n={icon} />
      </span>
    </span>
  );
}

export function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 40 }}>
      <span className="bucket">
        <span className="ic" style={{ margin: "auto", color: "var(--accent)" }}>
          <Ic n={icon} />
        </span>
      </span>
      <h3 style={{ justifyContent: "center", marginTop: 10 }}>{title}</h3>
      <p className="muted">{text}</p>
    </div>
  );
}

export function Delta({ v, prev, lowerBetter, unit = "" }: { v: number; prev: number | null; lowerBetter?: boolean; unit?: string }) {
  if (prev === null) return null;
  const d = Math.round((v - prev) * 10) / 10;
  if (d === 0) return <span className="dl">no change</span>;
  const good = lowerBetter ? d < 0 : d > 0;
  return (
    <span className={`dl ${good ? "good" : "bad"}`}>
      <Ic n={d < 0 ? "down2" : "up2"} />
      {Math.abs(d)}
      {unit} vs last week
    </span>
  );
}

export function ChangeList({ changes, onOpen, max = 12 }: { changes: import("@/lib/engine/types").Change[]; onOpen: (id: string) => void; max?: number }) {
  return (
    <ul className="plain" style={{ marginTop: 6, fontSize: 12.5, listStyle: "none", paddingLeft: 0 }}>
      {changes.slice(0, max).map((c) => (
        <li key={c.id} className="row wrap" style={{ gap: 6 }}>
          <button className="lnk mono" onClick={() => onOpen(c.id)}>{c.id}</button>
          {c.from && <span className="tag">{statusWord(c.from)}</span>}
          {c.from !== c.to && (
            <>
              <Ic n="arrow" />
              {c.to && <span className="tag">{statusWord(c.to)}</span>}
            </>
          )}
          {c.fromAlloc !== c.toAlloc && <span className="muted">{c.fromAlloc ?? "no slot"} → {c.toAlloc ?? "no slot"}</span>}
        </li>
      ))}
      {changes.length > max && <li className="muted">+ {changes.length - max} more</li>}
    </ul>
  );
}
