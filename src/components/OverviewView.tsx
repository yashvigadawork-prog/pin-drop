"use client";

import type { CSSProperties } from "react";
import { Ic } from "./Icon";
import { BucketIcon, Card, CountUp, Delta, InfoTip, Meter, useUi } from "./kit";
import { NowView } from "./TodayView";
import { active, countBy, type Row } from "@/lib/desk/model";
import { UI_GROUPS, UI_ORDER, type UiStatus } from "@/lib/desk/types";
import { SAMPLE_TREND, REASON_META, funnel, reasonCounts, reasonOf, stageTimes, type ReasonKey } from "@/lib/desk/metrics";
import { daysSince } from "@/lib/desk/time";

export function Donut({ rows, onPick }: { rows: Row[]; onPick: (s: UiStatus) => void }) {
  const n = countBy(rows);
  const tot = rows.length;
  const R = 54;
  const C = 2 * Math.PI * R;
  const starts = UI_ORDER.reduce<number[]>((acc, st, i) => [...acc, (acc[i - 1] ?? 0) + (i ? (C * n[UI_ORDER[i - 1]]) / Math.max(1, tot) : 0)], []);
  return (
    <div className="row" style={{ gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <span className="pdring" style={{ width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Where everyone stands">
          <circle className="track" cx="70" cy="70" r={R} strokeWidth="16" />
          {UI_ORDER.map((s, i) => {
            if (!n[s]) return null;
            const part = (C * n[s]) / Math.max(1, tot);
            const len = Math.max(part - 3, 1);
            return <circle key={s} className="arc" data-s={s} cx="70" cy="70" r={R} fill="none" stroke="var(--c)" strokeWidth="16" style={{ "--cc": C, "--i": i, strokeDasharray: `${len} ${C - len}`, strokeDashoffset: -starts[i] } as CSSProperties} />;
          })}
        </svg>
        <span className="v" style={{ textAlign: "center", lineHeight: 1.1 }}>
          <CountUp to={tot} style={{ fontSize: 32 }} />
          <br />
          <span className="muted" style={{ fontSize: 11, fontWeight: 500, fontFamily: "var(--f-body)" }}>applications</span>
        </span>
      </span>
      <div className="stack" style={{ gap: 3, flex: 1, minWidth: 130 }}>
        {UI_GROUPS.map((g) => {
          const total = g.members.reduce((a, m) => a + n[m], 0);
          const sub = g.members.slice(1).filter((m) => n[m]).map((m) => `${n[m]} ${m === "redir" ? "new pin" : "kept"}`).join(", ");
          return (
            <button key={g.key} className="row legrow" data-s={g.key} onClick={() => onPick(g.key)} title="Show these in the pipeline">
              <span className="dot" />
              <span style={{ flex: 1, textAlign: "left" }}>{g.label}{sub && <span className="muted" style={{ fontSize: 11.5 }}> · {sub}</span>}</span>
              <b className="mono">{total}</b>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OverviewView() {
  const ui = useUi();
  const { nav, setNav, ws } = ui;
  const waiting = active(ws.rows).filter((r) => r.ui === "adv" || r.ui === "redir").length + ws.desk.replies.length;
  return (
    <div className="stack">
      <div className="seg" style={{ alignSelf: "flex-start" }}>
        <button className={nav.ovTab === "now" ? "on" : ""} onClick={() => setNav({ ovTab: "now" })}><Ic n="today" />Needs you now{waiting > 0 && <span className="n" style={{ marginLeft: 2 }}>{waiting}</span>}</button>
        <button className={nav.ovTab === "perf" ? "on" : ""} onClick={() => setNav({ ovTab: "perf" })}><Ic n="bar" />Performance</button>
      </div>
      {nav.ovTab === "now" ? <NowView /> : <PerfView />}
    </div>
  );
}

function PerfView() {
  const ui = useUi();
  const { ws, now, nav, setNav } = ui;
  const { rows, desk, result } = ws;
  if (!result) return null;
  const times = stageTimes(desk, now);
  const known = times.filter((t) => t.avg !== null);
  const worst = known.filter((t) => t.avg! > t.target).sort((a, b) => b.avg! - b.target - (a.avg! - a.target))[0];
  const maxT = Math.max(1, ...known.map((t) => Math.max(t.avg!, t.prev ?? 0, t.target))) * 1.08;
  const fun = funnel(rows, desk);
  const rc = reasonCounts(rows);
  const rmax = Math.max(1, ...Object.values(rc));
  const onbIds = Object.keys(desk.onb);
  const dropouts = onbIds.filter((id) => rows.find((r) => r.id === id)?.withdrawn).length;
  const spotDone = Object.keys(desk.spot).length;
  const slowDocs = onbIds.filter((id) => desk.onb[id].stage <= 1 && daysSince(desk.onb[id].since, now) > 5).length;
  const trend = desk.sample ? SAMPLE_TREND : null;
  const tw = 280;
  const th = 84;
  const pts = trend ? trend.map((v, i) => [10 + (i * (tw - 40)) / 3, 10 + ((v - 24) / 16) * (th - 30)]) : [];

  const slotsAll = result.territories.reduce((a, t) => a + t.territory.slots, 0);
  const slotsFilled = rows.filter((r) => r.slotTerr && (r.ui === "adv" || r.ui === "redir")).length;
  const waitingYes = active(rows).filter((r) => r.ui === "adv" || r.ui === "redir").length;
  const waitList = active(rows).filter((r) => r.ui === "adv" || r.ui === "redir").sort((x, y) => y.fit - x.fit);
  const K: { icon: string; s: "adv" | "redir" | "wait"; n: number; of?: number; label: string; sub: React.ReactNode; tip: React.ReactNode; goLabel: string; go: () => void }[] = [
    {
      icon: "layers", s: "adv", n: slotsFilled, of: slotsAll, label: "Slots filled", sub: <span className="dl">{slotsAll - slotsFilled} still open</span>,
      tip: (
        <ul className="tiplist">
          {result.territories.map((t) => {
            const al = rows.filter((r) => r.slotTerr === t.territory.id && (r.ui === "adv" || r.ui === "redir")).length;
            return <li key={t.territory.id}><span>{t.territory.city} <span className="muted mono">{t.territory.id}</span></span><b className="mono">{al}/{t.territory.slots}</b></li>;
          })}
        </ul>
      ),
      goLabel: "Open Territories", go: () => ui.go("places", { placesTab: "terr" }),
    },
    {
      icon: "trend", s: "redir", n: trend ? trend[3] : 0, label: "Days to signed agreement", sub: trend ? <span className="dl">{trend[2] - trend[3]} days faster than last week</span> : <span className="dl">Appears after a week of use</span>,
      tip: trend ? (
        <ul className="tiplist">
          {trend.map((v, i) => <li key={i}><span>{i === 3 ? "Now" : `${3 - i} week${3 - i === 1 ? "" : "s"} ago`}</span><b className="mono">{v} d</b></li>)}
        </ul>
      ) : <span className="muted">No history yet. It fills in as partners sign.</span>,
      goLabel: "Open Onboarding", go: () => ui.go("onboarding"),
    },
    {
      icon: "check", s: "wait", n: waitingYes, label: "Decisions waiting", sub: <span className="dl">Waiting for your yes</span>,
      tip: (
        <ul className="tiplist">
          {waitList.slice(0, 5).map((r) => <li key={r.id}><span>{r.app.name}</span><b className="mono">{r.fit}</b></li>)}
          {waitList.length > 5 && <li className="muted">+ {waitList.length - 5} more</li>}
          {!waitList.length && <li className="muted">Nobody is waiting.</li>}
        </ul>
      ),
      goLabel: "Open the list", go: () => setNav({ ovTab: "now" }),
    },
  ];

  return (
    <div className="stack">
      <div className="row wrap rise">
        <div className="seg">
          <button className={nav.period === "week" ? "on" : ""} onClick={() => setNav({ period: "week" })}>This week</button>
          <button className={nav.period === "month" ? "on" : ""} onClick={() => setNav({ period: "month" })}>Last 4 weeks</button>
        </div>
        {desk.sample && (
          <span className="tag">
            <Ic n="info" />
            Trends use sample history for demo
          </span>
        )}
        <span className="sp" />
        <button className="btn primary" onClick={() => ui.modal({ kind: "summary" })}>
          <Ic n="send" />
          Email summary to my boss
        </button>
      </div>

      {worst ? (
        <div className="card row rise" data-s="wait" style={{ "--i": 1, gap: 14, borderColor: "color-mix(in srgb,var(--c) 55%,var(--line))", flexWrap: "wrap" } as CSSProperties}>
          <BucketIcon icon="alert" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="eyebrow">Biggest bottleneck</div>
            <b style={{ fontSize: 17, fontFamily: "var(--f-display)" }}>{worst.name}: {worst.avg} days</b>
            <div className="muted">
              Target {worst.target} days. {worst.note}.
              {worst.prev !== null && ` ${worst.avg! > worst.prev ? "Slower" : "Faster"} than last week by ${Math.abs(Math.round((worst.avg! - worst.prev) * 10) / 10)} days.`}
            </div>
          </div>
          <button className="btn" onClick={() => ui.go("onboarding")}>
            <Ic n="clip" />
            See who is waiting
          </button>
          <button className="btn primary" onClick={() => ui.toast("Reminder emails queued for the partners still waiting")}>
            <Ic n="bell" />
            Remind partners
          </button>
        </div>
      ) : (
        <div className="card row rise flat" data-s="adv" style={{ "--i": 1, gap: 12 } as CSSProperties}>
          <BucketIcon icon="check" />
          <div>
            <b>No bottleneck yet</b>
            <div className="muted">Times fill in as emails go out and partners reply. {slowDocs > 0 ? `${slowDocs} partners have been slow to send documents.` : ""}</div>
          </div>
        </div>
      )}

      <div className="grid g3">
        {K.map((k, i) => (
          <div key={k.label} className="card rise bucket" data-s={k.s} style={{ "--i": i + 2 } as CSSProperties}>
            <div className="row">
              <span className="ic"><Ic n={k.icon} /></span>
              <span className="sp" />
              <span className="eyebrow">{k.label}</span>
              <InfoTip label={k.label} goLabel={k.goLabel} onGo={k.go}>{k.tip}</InfoTip>
            </div>
            <div className="row" style={{ alignItems: "baseline", gap: 6 }}>
              {k.label.startsWith("Days") && !trend ? <span className="num">n/a</span> : <CountUp className="num" to={k.n} />}
              {k.of !== undefined && <span className="muted" style={{ fontSize: 18, fontWeight: 600 }}>/ {k.of}</span>}
            </div>
            {k.sub}
          </div>
        ))}
      </div>

      <div className="grid g2">
        <Card i={3}>
          <h3><Ic n="filter" />From application to open store</h3>
          <Funnel steps={fun} />
          <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>The % shows how many made it from the step before.</p>
        </Card>

        <Card i={4}>
          <h3>
            <Ic n="clock" />Days spent at each step<span className="sp" />
            <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>bar = this week · tick = target</span>
          </h3>
          <div className="stack" style={{ gap: 11 }}>
            {times.map((t, i) => {
              if (t.avg === null) {
                return (
                  <div key={t.name}>
                    <div className="row"><b style={{ fontSize: 13, flex: 1 }}>{t.name}</b><span className="muted" style={{ fontSize: 12 }}>No data yet</span></div>
                    <div className="meter" style={{ marginTop: 5, opacity: 0.5 }} />
                  </div>
                );
              }
              const isWorst = worst?.name === t.name;
              const col = t.avg <= t.target ? "var(--s-adv)" : isWorst ? "var(--s-no)" : "var(--s-wait)";
              return (
                <div key={t.name}>
                  <div className="row" style={{ gap: 8 }}>
                    <b style={{ fontSize: 13, flex: 1 }}>
                      {t.name}
                      {isWorst && <span className="tag warn" style={{ marginLeft: 6 }}>Bottleneck</span>}
                    </b>
                    <span className="mono">{t.avg} d</span>
                    <Delta v={t.avg} prev={t.prev} lowerBetter unit=" d" />
                  </div>
                  <div className="meter" style={{ position: "relative", marginTop: 5 }}>
                    <i className="grow-x" style={{ "--i": i, width: `${(t.avg / maxT) * 100}%`, background: col } as CSSProperties} />
                    <span style={{ position: "absolute", top: -3, bottom: -3, width: 2, background: "var(--ink)", left: `${(t.target / maxT) * 100}%` }} title={`Target ${t.target} days`} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="legend" style={{ marginTop: 12 }}>
            <span style={{ "--oc": "var(--s-adv)" } as CSSProperties}><i />On target</span>
            <span style={{ "--oc": "var(--s-wait)" } as CSSProperties}><i />Over target</span>
            <span style={{ "--oc": "var(--s-no)" } as CSSProperties}><i />Worst step</span>
          </div>
        </Card>
      </div>

      <div className="grid g3">
        <Card i={5}>
          <h3><Ic n="layers" />Where everyone stands</h3>
          <Donut rows={rows} onPick={(s) => ui.go("pipeline", { filter: s, showMoved: true })} />
        </Card>
        <Card i={6}>
          <h3><Ic n="trend" />Application to signed agreement</h3>
          {trend ? (
            <>
              <svg viewBox={`0 0 ${tw} ${th}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Days from application to signed agreement over four weeks: 38, 34, 31, 27">
                <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts.map((p) => p.join(",")).join(" ")} />
                {pts.map((p, i) => (
                  <g key={i}>
                    <circle cx={p[0]} cy={p[1]} r={i === 3 ? 5 : 3} fill={i === 3 ? "var(--accent)" : "var(--surface)"} stroke="var(--accent)" strokeWidth="2" />
                    <text x={p[0]} y={th - 4} textAnchor="middle" fontSize="10" fill="var(--muted)">{i === 3 ? "Now" : `W-${3 - i}`}</text>
                    {(i === 0 || i === 3) && <text x={p[0]} y={p[1] - 9} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">{trend[i]} d</text>}
                  </g>
                ))}
              </svg>
              <p style={{ marginTop: 6 }}><b>27 days</b> now, 4 days faster than last week and 11 faster than a month ago.</p>
            </>
          ) : (
            <p className="muted">The trend appears after a week of use. It will show how many days pass from application to a signed agreement.</p>
          )}
        </Card>

        <Card i={7}>
          <h3><Ic n="help" />Why people are not proceeding</h3>
          <div className="stack" style={{ gap: 10 }}>
            {(Object.keys(REASON_META) as ReasonKey[]).map((k, i) => {
              const who = rows.filter((r) => reasonOf(r) === k);
              return (
                <div key={k} className="row" style={{ gap: 10 }}>
                  <span className="bucket"><span className="ic" style={{ width: 30, height: 30, fontSize: 15, color: "var(--ink)", background: "var(--surface2)" }}><Ic n={REASON_META[k][0]} /></span></span>
                  <span style={{ flex: 1, fontSize: 12.5 }}>{REASON_META[k][1]}</span>
                  <Meter pct={(rc[k] / rmax) * 100} color="var(--accent)" i={i} style={{ width: 70 }} />
                  <b className="mono" style={{ width: 18 }}>{rc[k]}</b>
                  <InfoTip label={REASON_META[k][1]} goLabel={`See these ${who.length}`} onGo={() => ui.go("pipeline", { reason: k })}>
                    <ul className="tiplist">
                      {who.slice(0, 6).map((r) => <li key={r.id}><button className="lnk" onClick={(e) => { e.stopPropagation(); ui.open(r.id); }}>{r.app.name}</button><span className="muted mono">{r.id}</span></li>)}
                      {who.length > 6 && <li className="muted">+ {who.length - 6} more</li>}
                      {!who.length && <li className="muted">Nobody right now.</li>}
                    </ul>
                  </InfoTip>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card i={8}>
        <h3>
          <Ic n="target" />Outcome scorecard<span className="sp" />
          <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>Defined before building, checked every week</span>
        </h3>
        <div className="grid g3" style={{ gap: 10 }}>
          {[
            ["flag", "Outcome", "Partners open stores faster, and the right partners stay.", "Measure: weeks from application to open store."],
            ["bar", "Baseline", "Manual process: about 4 days to decide, about 25 weeks to open.", "Assumption. Check against the last 10 stores."],
            ["usercheck", "Workflow change", `You audit instead of judge. Review the shortlist, spot-check ${desk.guard.spot}% of decisions.`, `Spot-checks done: ${spotDone}.`],
            ["eye", "How we know", "Store open vs plan, 90-day sales vs payback, partner NPS.", "Logged in the world, not in the app."],
            ["alert", "Kill criterion", "If 3 of the first 10 Proceed partners drop out before signing, pause and recalibrate.", `So far: ${dropouts} drop-outs. ${dropouts >= 3 && desk.guard.kill ? "Pause and review." : "On track."}`],
          ].map(([ic, t, a, b], i) => (
            <div key={t} className="row pop" style={{ "--i": i, gap: 10, alignItems: "flex-start", padding: 12, borderRadius: "var(--r-sm)", background: "var(--surface2)" } as CSSProperties}>
              <span className="bucket"><span className="ic" style={{ width: 32, height: 32, fontSize: 16, color: "var(--accent)", background: "color-mix(in srgb,var(--accent) 14%,var(--surface))" }}><Ic n={ic} /></span></span>
              <div>
                <div className="eyebrow">{t}</div>
                <b>{a}</b>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{b}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Funnel({ steps }: { steps: [string, number][] }) {
  const top = Math.max(1, steps[0]?.[1] ?? 1);
  return (
    <div className="funnel">
      {steps.map(([label, n], i) => {
        const w = Math.max(10, (n / top) * 100);
        const next = i < steps.length - 1 ? Math.max(8, (steps[i + 1][1] / top) * 100) : w * 0.82;
        const inset = Math.max(0, ((w - Math.min(w, next)) / 2 / w) * 100);
        const pc = i && steps[i - 1][1] ? Math.round((n / steps[i - 1][1]) * 100) : null;
        return (
          <div key={label} className="fstep" style={{ "--i": i } as CSSProperties}>
            <span className="flabel">{label}</span>
            <span className="farea">
              <span className="fbar" style={{ width: `${w}%`, clipPath: `polygon(0 0, 100% 0, ${100 - inset}% 100%, ${inset}% 100%)`, opacity: 1 - i * 0.06 } as CSSProperties}>
                <b>{n}</b>
              </span>
            </span>
            <span className={`fpc${pc !== null && pc < 50 ? " low" : ""}`}>{pc !== null ? `${pc}%` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
