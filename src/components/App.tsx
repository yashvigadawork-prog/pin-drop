"use client";

import { useEffect, useRef, useState } from "react";
import { exportWorkbook } from "@/lib/export";
import { ruleById } from "@/lib/engine/rulebook";
import { ChatPanel } from "./ChatPanel";
import { DecisionsTab } from "./DecisionsTab";
import { DetailDrawer } from "./DetailDrawer";
import { Landing } from "./Landing";
import { AuditTab, ChangeList, RulebookTab, TerritoriesTab } from "./OtherTabs";
import { EvidenceList, Modal } from "./ui";
import { useWorkspace } from "./useWorkspace";
import { WeightsPanel } from "./WeightsPanel";

type Tab = "decisions" | "territories" | "rulebook" | "audit";

export default function App() {
  const ws = useWorkspace();
  const { result, input, state } = ws;
  const [tab, setTab] = useState<Tab>("decisions");
  const [openId, setOpenId] = useState<string | null>(null);
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [inject, setInject] = useState<{ text: string; n: number } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ws.lastChanges) return;
    const t = setTimeout(() => ws.clearLastChanges(), 9000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.lastChanges?.at]);

  const rule = ruleById(ruleId ?? undefined);
  const openApp = openId && result?.decisions[openId] ? openId : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2.5">
          <button onClick={() => (result ? setTab("decisions") : null)} className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20V10l8-6 8 6v10M9 20v-6h6v6" /></svg>
            </span>
            <span className="text-left leading-tight">
              <span className="block font-semibold">PartnerPath</span>
              <span className="block text-[11px] text-slate-500">Franchise partner engine</span>
            </span>
          </button>
          {result && (
            <nav className="ml-2 hidden gap-1 md:flex">
              {(["decisions", "territories", "rulebook", "audit"] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                  {t === "audit" ? `Audit log (${state.audit.length})` : t}
                </button>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            {result && input && (
              <>
                <span className="hidden max-w-[14rem] truncate text-xs text-slate-500 lg:inline" title={state.fileName}>
                  {state.fileName}
                  {state.runId ? " · saved" : ""}
                </span>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && ws.uploadFile(e.target.files[0])} />
                <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Upload new file
                </button>
                <button onClick={() => exportWorkbook(result, input, state.audit, state.fileName)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Export
                </button>
                <button onClick={() => setChatOpen((v) => !v)} className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white lg:hidden">
                  Ask / update
                </button>
              </>
            )}
            {!result && (
              <button onClick={() => setRuleId("owner-decides")} className="text-sm text-slate-500 hover:text-slate-800">
                How it decides
              </button>
            )}
          </div>
        </div>
        {result && (
          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-1.5 md:hidden">
            {(["decisions", "territories", "rulebook", "audit"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-lg px-3 py-1 text-sm capitalize ${tab === t ? "bg-slate-900 text-white" : "text-slate-600"}`}>
                {t}
              </button>
            ))}
          </nav>
        )}
      </header>

      {!result || !input ? (
        <Landing onFile={ws.uploadFile} onSample={ws.loadSample} loading={ws.loading} error={ws.error} />
      ) : (
        <div className="mx-auto flex w-full max-w-[1500px] flex-1 gap-4 px-4 py-4">
          <main className="min-w-0 flex-1 space-y-4">
            {ws.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{ws.error}</p>}
            {tab === "decisions" && (
              <>
                <WeightsPanel config={result.config} onChange={(c, l) => ws.setConfig(c, l, "weights")} />
                <DecisionsTab result={result} input={input} onOpen={setOpenId} />
              </>
            )}
            {tab === "territories" && <TerritoriesTab result={result} onOpen={setOpenId} />}
            {tab === "rulebook" && <RulebookTab config={result.config} onConfig={(c, l) => ws.setConfig(c, l)} focus={ruleId} />}
            {tab === "audit" && <AuditTab audit={state.audit} onOpen={setOpenId} runId={state.runId} />}
            <p className="pb-6 text-center text-xs text-slate-400">
              Recommendations only — the expansion owner confirms or overrides every decision. ·{" "}
              <button onClick={ws.reset} className="underline hover:text-slate-600">
                Start over
              </button>
            </p>
          </main>
          <aside className={`${chatOpen ? "fixed inset-x-0 bottom-0 z-40 h-[75vh] rounded-t-2xl shadow-2xl" : "hidden"} border border-slate-200 bg-slate-50 lg:sticky lg:top-[4.5rem] lg:block lg:h-[calc(100vh-5.5rem)] lg:w-[360px] lg:shrink-0 lg:rounded-xl lg:shadow-none`}>
            {chatOpen && (
              <button onClick={() => setChatOpen(false)} className="absolute right-3 top-3 z-10 rounded-md p-1 text-slate-400 hover:bg-slate-200 lg:hidden" aria-label="Close chat">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            )}
            <ChatPanel ws={ws} onOpen={(id) => setOpenId(id)} injected={inject} />
          </aside>
        </div>
      )}

      {/* change toast */}
      {ws.lastChanges && ws.lastChanges.changes.length > 0 && (
        <div className="fixed bottom-4 left-4 z-50 w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium text-slate-900">{ws.lastChanges.changes.length} recommendation{ws.lastChanges.changes.length > 1 ? "s" : ""} changed</div>
            <button onClick={ws.clearLastChanges} className="text-slate-400 hover:text-slate-700" aria-label="Dismiss">
              ×
            </button>
          </div>
          <div className="text-xs text-slate-500">{ws.lastChanges.label}</div>
          <ChangeList changes={ws.lastChanges.changes} onOpen={setOpenId} max={5} />
        </div>
      )}

      {openApp && result && input && (
        <DetailDrawer
          d={result.decisions[openApp]}
          app={input.applications.find((a) => a.id === openApp)!}
          result={result}
          onClose={() => setOpenId(null)}
          onRule={(id) => setRuleId(id)}
          onOwner={(a) => ws.ownerAction(a)}
          onClearOwner={ws.clearOwner}
          onAsk={(q) => {
            setOpenId(null);
            setChatOpen(true);
            setInject({ text: q, n: Date.now() });
          }}
        />
      )}

      <Modal open={!!rule && tab !== "rulebook"} onClose={() => setRuleId(null)} title={rule?.title} wide>
        {rule && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">
              <b>Rule. </b>
              {rule.rule}
            </p>
            <p className="text-slate-600">
              <b>Why (first principles). </b>
              {rule.why}
            </p>
            {rule.assumption && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
                <b>Assumption &amp; how we&apos;d check it. </b>
                {rule.assumption}
              </p>
            )}
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">What real operators do</div>
            <EvidenceList ids={rule.evidence} />
          </div>
        )}
      </Modal>
    </div>
  );
}
