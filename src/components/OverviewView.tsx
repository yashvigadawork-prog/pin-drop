"use client";

import type { CSSProperties } from "react";
import { Ic } from "./Icon";
import { BucketIcon, Card, CountUp, Delta, Meter, useUi } from "./kit";
import { countBy } from "@/lib/desk/model";
import { SAMPLE_TREND, REASON_META, funnel, reasonCounts, stageTimes, type ReasonKey } from "@/lib/desk/metrics";
import { daysSince } from "@/lib/desk/time";

export function OverviewView() {
  const ui = useUi();
  const { ws, now, nav, setNav } = ui;
  const { rows, desk, result } = ws;
  if (!result) return null;
  const c = countBy(rows);
  const all = rows.length;
  const acc = c.adv + c.redir;
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

  const K: { icon: string; s: "redir" | "adv" | "wait" | "exp"; n: number; label: string; sub: React.ReactNode; go: () => void }[] = [
    { icon: "users", s: "redir", n: all, label: "Applications in", sub: desk.sample ? <Delta v={all} prev={23} /> : <span className="dl">this file</span>, go: () => ui.go("pipeline", { filter: "all", showMoved: true }) },
    { icon: "check", s: "adv", n: acc, label: "Accepted", sub: <span className="dl">{Math.round((acc / Math.max(1, all)) * 100)}% of all</span>, go: () => ui.go("pipeline", { filter: "adv", showMoved: true }) },
    { icon: "clock", s: "wait", n: c.info + c.wait, label: "Pending", sub: <span className="dl">{c.info} need info · {c.wait} waitlist</span>, go: () => ui.go("pipeline", { filter: "info" }) },
    { icon: "globe", s: "exp", n: c.no + c.exp, label: "Not accepted, kept", sub: <span className="dl">{c.exp} on Expansion list</span>, go: () => ui.go("expansion") },
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

      <div className="grid g4">
        {K.map((k, i) => (
          <button key={k.label} className="card hov rise bucket" data-s={k.s} style={{ "--i": i + 2, textAlign: "left" } as CSSProperties} onClick={k.go}>
            <div className="row">
              <span className="ic"><Ic n={k.icon} /></span>
              <span className="sp" />
              <span className="eyebrow">{k.label}</span>
            </div>
            <CountUp className="num" to={k.n} />
            {k.sub}
          </button>
        ))}
      </div>

      <div className="grid g2">
        <Card i={3}>
          <h3><Ic n="filter" />From application to open store</h3>
          <div className="stack" style={{ gap: 8 }}>
            {fun.map(([label, n], i) => {
              const prev = i ? fun[i - 1][1] : n;
              const pc = prev ? Math.round((n / prev) * 100) : 0;
              return (
                <div key={label} className="row" style={{ gap: 10 }}>
                  <span style={{ width: 150, fontSize: 12.5 }}>{label}</span>
                  <Meter pct={(n / Math.max(1, all)) * 100} color="var(--accent)" i={i} style={{ flex: 1 }} />
                  <b className="mono" style={{ width: 26, textAlign: "right" }}>{n}</b>
                  <span className="mono muted" style={{ width: 38, fontSize: 11 }}>{i ? `${pc}%` : ""}</span>
                </div>
              );
            })}
          </div>
          <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>The % is how many made it from the step before.</p>
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

        <Card i={6}>
          <h3><Ic n="help" />Why people are not proceeding</h3>
          <div className="stack" style={{ gap: 10 }}>
            {(Object.keys(REASON_META) as ReasonKey[]).map((k, i) => (
              <button key={k} className="row" style={{ gap: 10, textAlign: "left" }} onClick={() => ui.go("pipeline", { filter: "all" })}>
                <span className="bucket"><span className="ic" style={{ width: 30, height: 30, fontSize: 15, color: "var(--ink)", background: "var(--surface2)" }}><Ic n={REASON_META[k][0]} /></span></span>
                <span style={{ flex: 1, fontSize: 12.5 }}>{REASON_META[k][1]}</span>
                <Meter pct={(rc[k] / rmax) * 100} color="var(--accent)" i={i} style={{ width: 70 }} />
                <b className="mono" style={{ width: 18 }}>{rc[k]}</b>
              </button>
            ))}
          </div>
        </Card>

        <Card i={7}>
          <h3><Ic n="layers" />Territory slots filled</h3>
          <div className="stack" style={{ gap: 8 }}>
            {result.territories.map((t, i) => {
              const al = rows.filter((r) => r.slotTerr === t.territory.id && (r.ui === "adv" || r.ui === "redir")).length;
              const slots = t.territory.slots;
              return (
                <div key={t.territory.id} className="row" style={{ gap: 8 }}>
                  <span className="mono" style={{ width: 62, fontSize: 12 }}>{t.territory.id}</span>
                  <span style={{ width: 96, fontSize: 12.5 }}>{t.territory.city}</span>
                  <span className="row" style={{ gap: 3, flex: 1 }}>
                    {Array.from({ length: Math.max(slots, 1) }).map((_, k) => (
                      <span key={k} className="pop" style={{ "--i": i + k, width: 18, height: 8, borderRadius: 99, background: k < al ? "var(--s-adv)" : "var(--line)" } as CSSProperties} />
                    ))}
                  </span>
                  <b className="mono" style={{ fontSize: 12 }}>{al}/{slots}</b>
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
