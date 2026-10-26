"use client";

import { useState, type CSSProperties } from "react";
import { Ic } from "./Icon";
import { CHECK_GROUPS, CK_META, PLAN_STEPS, type CheckState, type Desk, type OnbRec } from "@/lib/desk/types";
import { attachmentUrl } from "@/lib/desk/inbox";
import type { Row } from "@/lib/desk/model";

export function Checklist({ o, mods, interactive, id, onCycle, onRemind, onSet }: { o?: OnbRec; mods: Desk["mods"]; interactive?: boolean; id: string; onCycle?: (key: string) => void; onRemind?: (key: string) => void; onSet?: (key: string, s: CheckState) => void }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return (
    <>
      {CHECK_GROUPS.filter((g) => mods[g.mod]).map((g) => {
        const verified = g.items.filter((it) => o?.chk[it[0]] === "verified").length;
        const open = !closed[g.name];
        return (
          <div key={g.name}>
            <button className="row grp" aria-expanded={open} onClick={() => setClosed({ ...closed, [g.name]: open })}>
              <Ic n={g.icon} />
              <b>{g.name}</b>
              <span className="muted mono" style={{ fontSize: 11.5 }}>{verified}/{g.items.length} verified</span>
              <span className="meter" style={{ width: 60, marginLeft: "auto" }}><i style={{ width: `${(verified / g.items.length) * 100}%`, background: "var(--s-adv)" }} /></span>
              <Ic n="chev" />
            </button>
            {open &&
              g.items.map(([key, label]) => {
                const s = o?.chk[key] ?? "todo";
                const m = CK_META[s];
                const doc = o?.docs?.[key];
                const view = attachmentUrl(id, key);
                return (
                  <div key={key} className="chk" data-k={s}>
                    <span className="b"><Ic n={m[0]} /></span>
                    <div>
                      <b>{label}</b>
                      <small>{s === "flag" ? "Needs a closer look" : s === "received" && doc ? `For your review · ${doc.file}` : m[1]}</small>
                      {s === "received" && doc && <small className="muted">From {doc.from}</small>}
                    </div>
                    <span className="row" style={{ gap: 6 }}>
                      {interactive && s === "todo" && <button className="btn sm" onClick={() => onCycle?.(key)}>Ask</button>}
                      {interactive && s === "asked" && (
                        <>
                          <button className="btn sm" onClick={() => onRemind?.(key)}><Ic n="bell" />Remind</button>
                          <button className="btn sm" onClick={() => onCycle?.(key)}>Mark received</button>
                        </>
                      )}
                      {interactive && s === "received" && doc && view && <a className="btn sm" href={view} target="_blank" rel="noreferrer"><Ic n="eye" />View</a>}
                      {interactive && s === "received" && doc && <a className="btn sm" href={doc.link} target="_blank" rel="noreferrer"><Ic n="mail" />Open email</a>}
                      {interactive && s === "received" && <button className="btn sm primary" onClick={() => (onSet ? onSet(key, "verified") : onCycle?.(key))}>Verify</button>}
                      {interactive && s === "received" && onSet && <button className="btn sm" onClick={() => onSet(key, "flag")}>Flag</button>}
                      {interactive && s === "flag" && <button className="btn sm primary" onClick={() => onCycle?.(key)}>Resolve</button>}
                      {interactive && s === "verified" && <button className="btn sm ghost" onClick={() => onCycle?.(key)}>Undo</button>}
                    </span>
                  </div>
                );
              })}
          </div>
        );
      })}
    </>
  );
}

const OWN: Record<string, string> = { P: "var(--s-info)", E: "var(--s-adv)", T: "var(--s-wait)", O: "var(--ink)" };

export function Gantt({ row }: { row: Row }) {
  const noSite = row.app.space !== "Owned" && row.app.space !== "Rented";
  const steps: [string, number, number, string][] = PLAN_STEPS.map((s, i) => [s[0], s[1] + (noSite && i >= 5 ? 7 : 0), s[2], s[3]]);
  if (noSite) {
    steps[3][1] = 9;
    steps.splice(3, 0, ["Find a site", 1, 8, "P"]);
  }
  const max = Math.max(...steps.map((s) => s[1] + s[2]));
  return (
    <>
      <div className="gantt">
        {steps.map((s, i) => (
          <div key={s[0]} className="gl">
            <span>{s[0]}</span>
            <div className="bar">
              <i style={{ left: `${(s[1] / max) * 100}%`, width: `${(s[2] / max) * 100}%`, "--i": i, background: OWN[s[3]] } as CSSProperties} />
            </div>
            <span className="muted mono">wk {s[1]}</span>
          </div>
        ))}
      </div>
      <div className="legend" style={{ marginTop: 10 }}>
        {[["P", "Partner"], ["E", "Expansion team"], ["T", "Training team"], ["O", "Owner"]].map(([k, l]) => (
          <span key={k} style={{ "--oc": OWN[k] } as CSSProperties}><i />{l}</span>
        ))}
      </div>
    </>
  );
}
