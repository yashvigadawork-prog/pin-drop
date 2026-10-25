"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/engine/engine";
import type { Application, Decision, EngineResult, OwnerAction, Status } from "@/lib/engine/types";
import { Bar, Card, GateIcon, RuleLink, SectionTitle, STATUS_META, STATUS_ORDER, StatusChip, fmtL } from "./ui";

const GATE_NAME = { data: "0 · Application", place: "1 · Place", partner: "2 · Partner", premises: "3 · Premises", pace: "4 · Pace" } as const;
const GATE_Q = {
  data: "Is the form complete and consistent?",
  place: "Is this a place we want to grow, and is the pin free?",
  partner: "Can they fund it and run it?",
  premises: "Is the shop fit for our format?",
  pace: "Can they open when they say?",
} as const;
const SIGNAL_LABEL: Record<string, string> = {
  owner_not_operator: "May not run the store personally",
  funding_conditional: "Funding depends on a loan / event",
  relevant_retail: "Same-category retail experience",
  adjacent_retail: "Has run / worked in a shop",
  multi_unit_operator: "Multi-outlet / franchise operator",
  festival_deadline: "Festival deadline",
  floor_mentioned_upper: "Notes mention an upper floor",
  floor_mentioned_ground: "Notes mention ground floor / road-facing",
  experience_in_text: "Experience mentioned in text",
  space_in_text: "Space size mentioned in notes",
  other_funds: "Mentions additional funds",
};

export function DetailDrawer({
  d,
  app,
  result,
  onClose,
  onRule,
  onOwner,
  onClearOwner,
  onAsk,
}: {
  d: Decision;
  app: Application;
  result: EngineResult;
  onClose: () => void;
  onRule: (id: string) => void;
  onOwner: (a: OwnerAction) => void;
  onClearOwner: (id: string) => void;
  onAsk: (q: string) => void;
}) {
  const [overriding, setOverriding] = useState(false);
  const [ovStatus, setOvStatus] = useState<Status>("HOLD");
  const [reason, setReason] = useState("");
  const w = result.config.weights;
  const wsum = w.partner + w.premises + w.place + w.pace || 1;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono">{d.id}</span>
                <span>·</span>
                <span>sheet row {app.rowNumber}</span>
                {d.territoryId && (
                  <>
                    <span>·</span>
                    <span>{d.territoryId}</span>
                  </>
                )}
              </div>
              <h2 className="mt-0.5 truncate text-lg font-semibold text-slate-900">{app.name || "(no name)"}</h2>
              <div className="mt-1 text-sm text-slate-500">
                {app.city ?? (app.cityRaw || "city?")} · pin {app.pin ?? (app.pinRaw || "?")}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusChip status={d.status} size="md" />
              {d.score && (
                <div className="text-right">
                  <div className="text-2xl font-semibold tabular-nums text-slate-900">{d.score.total.toFixed(0)}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">fit score{d.ownPinScore !== undefined ? " (if moved)" : ""}</div>
                </div>
              )}
            </div>
            <button onClick={onClose} className="-mr-2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Recommendation */}
          <Card className="p-4">
            <SectionTitle hint={d.ownerOverride ? `Owner ${d.ownerOverride.action === "confirm" ? "confirmed" : "override"}` : "Engine recommendation — owner decides"}>Recommendation</SectionTitle>
            <p className="font-medium text-slate-900">{d.headline}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{d.explanation}</p>
            {d.nextSteps.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-semibold text-slate-700">What happens next</div>
                <ol className="space-y-1.5 text-sm text-slate-700">
                  {d.nextSteps.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-indigo-50 text-[10px] font-semibold text-indigo-700">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {d.alternatives.length > 0 && <p className="mt-2 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">{d.alternatives.join(" ")}</p>}

            {/* Owner controls */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              {d.ownerOverride ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-800">
                    Owner {d.ownerOverride.action === "confirm" ? "confirmed" : `set ${STATUS_META[d.ownerOverride.status!].label}`}: “{d.ownerOverride.reason}”
                  </span>
                  <button onClick={() => onClearOwner(d.id)} className="text-xs text-slate-500 underline hover:text-slate-800">
                    Remove owner decision
                  </button>
                </div>
              ) : !overriding ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onOwner({ appId: d.id, action: "confirm", allocation: d.allocation ? { territoryId: d.allocation.territoryId, pin: d.allocation.pin, kind: d.allocation.kind } : undefined, reason: "Agree with recommendation", at: new Date().toISOString() })}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    {d.allocation ? `Confirm & lock ${d.allocation.pin}` : "Agree with recommendation"}
                  </button>
                  <button onClick={() => setOverriding(true)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Override…
                  </button>
                  <button onClick={() => onAsk(`Why is ${d.id} ${STATUS_META[d.status].label.toLowerCase()}?`)} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
                    Ask about this
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_ORDER.filter((s) => s !== "WITHDRAWN" && s !== "REDIRECT").map((s) => (
                      <button key={s} onClick={() => setOvStatus(s)} className={`rounded-full px-2.5 py-1 text-xs ring-1 ${ovStatus === s ? STATUS_META[s].cls + " ring-2" : "bg-white text-slate-600 ring-slate-200"}`}>
                        {STATUS_META[s].label}
                      </button>
                    ))}
                  </div>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required) — e.g. 'Met in person, strong local network'" className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-indigo-500 focus:outline-none" rows={2} />
                  <div className="flex gap-2">
                    <button
                      disabled={reason.trim().length < 3}
                      onClick={() => {
                        onOwner({ appId: d.id, action: "override", status: ovStatus, reason: reason.trim(), at: new Date().toISOString() });
                        setOverriding(false);
                        setReason("");
                      }}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                    >
                      Save override
                    </button>
                    <button onClick={() => setOverriding(false)} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Gates */}
          <Card className="p-4">
            <SectionTitle hint="every check, in order">The five checks</SectionTitle>
            <ul className="divide-y divide-slate-100">
              {d.gates.map((g) => {
                const issues = d.issues.filter((i) => i.gate === g.gate);
                return (
                  <li key={g.gate} className="py-2.5">
                    <div className="flex items-start gap-3">
                      <GateIcon state={g.state} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-800">{GATE_NAME[g.gate]}</span>
                          <span className="text-xs text-slate-400">{GATE_Q[g.gate]}</span>
                        </div>
                        {issues.length === 0 ? (
                          <p className="text-sm text-slate-600">{g.summary}</p>
                        ) : (
                          <ul className="mt-1 space-y-1.5">
                            {issues.map((i, k) => (
                              <li key={k} className="text-sm">
                                <span className={i.severity === "block" ? "text-rose-700" : i.severity === "warn" ? "text-amber-700" : "text-slate-600"}>{i.message}</span>
                                {i.evidence && <span className="mt-0.5 block text-xs italic text-slate-500">Their words: “{i.evidence}”</span>}
                                {i.fix && <span className="mt-0.5 block text-xs text-slate-500">→ {i.fix}</span>}
                                <span className="ml-0 block">
                                  <RuleLink ruleId={i.ruleId} onOpen={onRule} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Score */}
          {d.score && (
            <Card className="p-4">
              <SectionTitle hint={`weights: ${result.config.phaseName}`}>How the fit score is built</SectionTitle>
              <div className="space-y-3">
                {(["partner", "premises", "place", "pace"] as const).map((k) => (
                  <div key={k}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium capitalize text-slate-700">{k}</span>
                      <span className="tabular-nums text-slate-500">
                        {(d.score![k] * 100).toFixed(0)}% × weight {Math.round((w[k] / wsum) * 100)} = <b className="text-slate-800">{((d.score![k] * w[k]) / wsum * 100).toFixed(1)}</b>
                      </span>
                    </div>
                    <Bar value={d.score![k]} />
                    <div className="mt-1 text-xs text-slate-500">{d.score!.notes[k].join(" ")}</div>
                  </div>
                ))}
              </div>
              {d.ownPinScore !== undefined && <p className="mt-3 text-xs text-slate-500">Score at the pin they applied for: {d.ownPinScore.toFixed(0)}. The score above is for moving to another pin (new site needed, may decline).</p>}
              <p className="mt-3 text-xs text-slate-400">The score only ranks applicants competing for the same slots. It never overrides a hard rule.</p>
            </Card>
          )}

          {/* Competition */}
          {d.competition && (
            <Card className="p-4">
              <SectionTitle>Competition in {d.competition.territoryId}</SectionTitle>
              <p className="text-sm text-slate-700">
                Rank <b>#{d.competition.rank}</b> of {d.competition.contenders} for <b>{d.competition.capacity}</b> real slot{d.competition.capacity === 1 ? "" : "s"}
                {d.status === "HOLD" ? " — if the hold is resolved" : ""}.
              </p>
              {(() => {
                const tv = result.territories.find((t) => t.territory.id === d.competition!.territoryId);
                if (!tv) return null;
                return (
                  <ul className="mt-2 space-y-1 text-sm">
                    {tv.allocated.map((a) => {
                      const o = result.decisions[a.appId];
                      return (
                        <li key={a.appId} className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500">{a.appId}</span>
                          <span className="text-slate-700">pin {a.pin}</span>
                          <span className="text-slate-400">score {o.score?.total.toFixed(0)}</span>
                          {a.locked && <span className="rounded bg-indigo-50 px-1.5 text-[10px] font-semibold text-indigo-700">LOCKED</span>}
                          {a.appId === d.id && <span className="text-xs font-medium text-emerald-700">← this applicant</span>}
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </Card>
          )}

          {/* Signals from their own words */}
          {d.signals.length > 0 && (
            <Card className="p-4">
              <SectionTitle hint="read from free-text answers">What their own words tell us</SectionTitle>
              <ul className="space-y-1.5 text-sm">
                {d.signals.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium text-slate-800">{SIGNAL_LABEL[s.kind] ?? s.kind}</span>
                    {s.kind === "festival_deadline" && <span className="text-slate-500"> — {String(s.value)}</span>}
                    <span className="block text-xs italic text-slate-500">“{s.quote}”</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-400">Signals can only raise a question or nudge the score. They never reject anyone.</p>
            </Card>
          )}

          {/* Plan */}
          {d.plan && (
            <Card className="p-4">
              <SectionTitle hint={`plan opens ${fmtDate(d.plan.plannedOpen)}`}>Path to opening</SectionTitle>
              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Earliest realistic" value={`${d.plan.feasibleMonths} mo`} />
                <Stat label="They asked for" value={d.plan.targetMonths ? `${d.plan.targetMonths} mo` : "—"} />
                <Stat label="Indicative payback" value={d.plan.payback ? `~${d.plan.payback.months} mo` : "—"} />
              </div>
              <Timeline steps={d.plan.steps} />
              {d.plan.conditions.length > 0 && (
                <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide">Conditions to clear during onboarding</div>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {d.plan.conditions.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {d.plan && (
            <Card className="p-4">
              <SectionTitle hint={d.plan.training.extended ? "extended track" : "standard track"}>How they'll be prepared to run the store</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="text-xs font-semibold text-slate-500">Training language</div>
                  <div className="font-medium text-slate-800">{d.plan.training.languages.join(" + ")}</div>
                  {d.plan.training.languageNote && <div className="mt-1 text-xs text-slate-500">{d.plan.training.languageNote}</div>}
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="text-xs font-semibold text-slate-500">Mentor store (shadowing {d.plan.training.shadowDays} days)</div>
                  <div className="font-medium text-slate-800">
                    {d.plan.training.mentorStore.id} · {d.plan.training.mentorStore.city} {d.plan.training.mentorStore.pin}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{d.plan.training.mentorStore.why}</div>
                </div>
              </div>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {d.plan.training.modules.map((m) => (
                    <tr key={m.name} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2 text-slate-800">{m.name}</td>
                      <td className="py-1.5 pr-2 text-slate-500">{m.mode}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-600">{m.days}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* Facts */}
          <Card className="p-4">
            <SectionTitle hint="what we read vs what they wrote">Application facts</SectionTitle>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <Fact k="Investment" v={fmtL(app.investment)} raw={app.investmentRaw} extra={app.extra.extraCapital ? `+ ${fmtL(app.extra.extraCapital)} committed later` : undefined} />
              <Fact k="Needed for tier" v={fmtL(d.requiredCapital)} />
              <Fact k="Retail experience" v={app.experience === null ? "—" : `${app.experience} yrs`} raw={app.experienceRaw} />
              <Fact k="Space" v={app.space ?? "—"} raw={app.spaceRaw} />
              <Fact k="Size" v={app.sizeSqft === null ? "—" : `${app.sizeSqft} sq ft`} raw={app.sizeRaw} />
              <Fact k="Floor" v={app.floor ?? "—"} raw={app.floorRaw} />
              <Fact k="Target launch" v={app.targetMonths === null ? "—" : `${app.targetMonths} months`} raw={app.targetRaw} />
              <Fact k="Language" v={app.languages.join(", ") || "—"} raw={app.languageRaw} />
              <Fact k="Loan" v={app.extra.financing ?? "—"} />
              <Fact k="State" v={app.state || "—"} />
            </dl>
            {app.business && <p className="mt-3 text-sm text-slate-600"><span className="font-medium text-slate-700">Business: </span>{app.business}</p>}
            {app.notes && <p className="mt-1 text-sm text-slate-600"><span className="font-medium text-slate-700">Notes: </span>{app.notes}</p>}
            {app.extra.infoNotes?.map((n, i) => (
              <p key={i} className="mt-1 text-xs text-slate-500">{n}</p>
            ))}
          </Card>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <div className="text-base font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function Fact({ k, v, raw, extra }: { k: string; v: string; raw?: string; extra?: string }) {
  const showRaw = raw && raw.trim() !== "" && raw.trim().toLowerCase() !== v.toLowerCase().replace(/^₹|l$| yrs| sq ft| months/g, "");
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-slate-100 py-0.5">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right text-slate-800">
        {v}
        {showRaw && <span className="block text-[11px] text-slate-400">wrote “{raw}”</span>}
        {extra && <span className="block text-[11px] text-emerald-700">{extra}</span>}
      </dd>
    </div>
  );
}

function Timeline({ steps }: { steps: { week: number; weeks: number; title: string; owner: string; detail: string }[] }) {
  const end = Math.max(...steps.map((s) => s.week + s.weeks), 1);
  const color: Record<string, string> = { Partner: "bg-indigo-500", "Expansion team": "bg-teal-500", "Training team": "bg-violet-500", Owner: "bg-slate-700" };
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
        {Object.entries(color).map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-sm ${c}`} />
            {k}
          </span>
        ))}
      </div>
      <ul className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="group">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-40 shrink-0 truncate font-medium text-slate-700" title={s.title}>{s.title}</span>
              <div className="relative h-3 flex-1 rounded bg-slate-100">
                <div className={`absolute top-0 h-3 rounded ${color[s.owner] ?? "bg-slate-400"}`} style={{ left: `${(s.week / end) * 100}%`, width: `${Math.max((s.weeks / end) * 100, 1.5)}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right tabular-nums text-slate-400">wk {s.week}</span>
            </div>
            <div className="hidden pl-42 text-[11px] text-slate-500 group-hover:block">{s.detail}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
