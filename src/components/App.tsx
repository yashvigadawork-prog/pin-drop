"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { Drawer } from "./Drawer";
import { Ic, Logo } from "./Icon";
import { Landing } from "./Landing";
import { ModalHost } from "./Modals";
import { OnboardingView } from "./OnboardingView";
import { OverviewView } from "./OverviewView";
import { PipelineView } from "./PipelineView";
import { PlacesView } from "./PlacesView";
import { RankingMenu } from "./RankingMenu";
import { SettingsView } from "./SettingsView";
import { UiCtx, type DrawerTab, type ModalState, type NavState, type ReviewBucket, type Ui, type View } from "./kit";
import { useWorkspace } from "./useWorkspace";
import { exportWorkbook } from "@/lib/export";
import { active } from "@/lib/desk/model";
import type { UiStatus } from "@/lib/desk/types";

const NAV: [View, string, string][] = [
  ["overview", "bar", "Overview"],
  ["pipeline", "list", "Pipeline"],
  ["onboarding", "clip", "Onboarding"],
  ["places", "map", "Places"],
  ["settings", "sliders", "Rules and settings"],
];
const TITLES: Record<View, [string, string]> = {
  overview: ["Overview", "What needs you, and how we are doing"],
  pipeline: ["Pipeline", "Applicants still being decided"],
  onboarding: ["Onboarding", "From yes to open store"],
  places: ["Places", "Map, territories and the expansion list"],
  settings: ["Rules and settings", "Areas, checks, email and the rulebook"],
};
const NAV0: NavState = { filter: "all", q: "", sort: "fit", showMoved: false, terrF: null, pick: {}, setting: "areas", onb: "", expF: null, expCity: "", city: null, layers: { app: true, store: true, exp: true }, period: "week", ovTab: "now", placesTab: "terr" };

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let t: string | null = null;
    try {
      t = localStorage.getItem("pd-theme");
    } catch {}
    const d = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (t) document.documentElement.dataset.theme = t;
    const id = setTimeout(() => setDark(d), 0);
    return () => clearTimeout(id);
  }, []);
  const toggle = useCallback(() => {
    const n = dark ? "light" : "dark";
    document.documentElement.dataset.theme = n;
    try {
      localStorage.setItem("pd-theme", n);
    } catch {}
    setDark(!dark);
  }, [dark]);
  return { dark, toggle };
}

export default function App() {
  const ws = useWorkspace();
  const { result, input, rows, desk } = ws;
  const theme = useTheme();
  const [view, setView] = useState<View>("overview");
  const [nav, setNavState] = useState<NavState>(NAV0);
  const [drawer, setDrawer] = useState<{ id: string; tab: DrawerTab; paste?: string } | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [seed, setSeed] = useState<{ text: string; n: number } | null>(null);
  const [toast, setToastState] = useState<{ text: string; act?: { label: string; run: () => void } } | null>(null);
  const [now, setNow] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seedN = useRef(0);
  const content = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    const iv = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, []);

  const setNav = useCallback((n: Partial<NavState>) => setNavState((s) => ({ ...s, ...n })), []);
  const showToast = useCallback((text: string, act?: { label: string; run: () => void }) => {
    setToastState({ text, act });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState(null), act ? 6500 : 2800);
  }, []);
  const closeAll = useCallback(() => {
    setDrawer(null);
    setModal(null);
  }, []);

  const go = useCallback<Ui["go"]>(
    (target, o = {}) => {
      const v: View = target === "today" ? "overview" : target === "map" || target === "expansion" ? "places" : target;
      setView(v);
      closeAll();
      setNavState((s) => ({
        ...s,
        ...(target === "today" ? { ovTab: "now" as const } : {}),
        ...(target === "map" ? { placesTab: "terr" as const } : {}),
        ...(target === "expansion" ? { placesTab: "exp" as const } : {}),
        ...(o.placesTab ? { placesTab: o.placesTab } : {}),
        ...(o.filter !== undefined ? { filter: o.filter as UiStatus | "all", terrF: null } : {}),
        ...(o.terr !== undefined ? { terrF: o.terr, filter: "all" as const } : {}),
        ...(o.showMoved !== undefined ? { showMoved: o.showMoved } : {}),
        ...(o.onb ? { onb: o.onb } : {}),
        ...(o.settings ? { setting: o.settings } : {}),
        ...(o.expF !== undefined ? { expF: o.expF } : {}),
        ...(o.expCity ? { expCity: o.expCity } : {}),
      }));
      content.current?.scrollTo({ top: 0 });
      if (v === "places" && target !== "map") setTimeout(() => document.getElementById("places-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    },
    [closeAll],
  );

  const ui: Ui = useMemo(
    () => ({
      ws,
      now,
      view,
      go,
      open: (id, tab = "why", paste) => {
        setModal(null);
        setDrawer({ id, tab, paste });
      },
      mail: (id) => setModal({ kind: "mail", id }),
      move: (ids, o) => setModal({ kind: "move", ids, spot: o?.spot, target: o?.target }),
      review: (b: ReviewBucket) => setModal({ kind: "review", b }),
      modal: (m) => setModal(m),
      toast: showToast,
      chat: (q) => {
        setChatOpen(true);
        if (q) setSeed({ text: q, n: ++seedN.current });
      },
      nav,
      setNav,
    }),
    [ws, now, view, go, showToast, nav, setNav],
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (modal) setModal(null);
      else if (drawer) setDrawer(null);
      else if (chatOpen) setChatOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [modal, drawer, chatOpen]);

  if (!result || !input) return <div className="pdapp"><Landing onFile={ws.uploadFile} onSample={ws.loadSample} loading={ws.loading} error={ws.error} dark={theme.dark} onTheme={theme.toggle} /></div>;

  const t = TITLES[view];
  const badge = (v: View) => (v === "overview" ? active(rows).filter((r) => r.ui === "adv" || r.ui === "redir").length + desk.replies.length : v === "pipeline" ? active(rows).length : v === "places" ? ws.expList.length : v === "onboarding" ? Object.keys(desk.onb).length : null);
  const body = { overview: <OverviewView />, pipeline: <PipelineView />, onboarding: <OnboardingView />, places: <PlacesView />, settings: <SettingsView /> }[view];

  return (
    <UiCtx.Provider value={ui}>
      <div className="pdapp">
        <aside className="side">
          <div className="brand"><Logo />Pin Drop</div>
          {NAV.map(([v, ic, l]) => {
            const b = badge(v);
            return (
              <button key={v} className={`nav${view === v ? " on" : ""}`} onClick={() => go(v)}>
                <Ic n={ic} />
                <span>{l}</span>
                {b !== null && <span className="badge">{b}</span>}
              </button>
            );
          })}
          <div className="grow" />
          <div className="filecard">
            <b style={{ wordBreak: "break-all" }}>{ws.state.fileName}</b>
            <div className="muted">{input.applications.length} applications · {input.territories.length} territories</div>
            <div className="row" style={{ marginTop: 6 }}>
              <span className="dot" data-s="adv" />
              <span className="muted">Read OK{result.health.warnings.length ? ` · ${result.health.warnings.length} note${result.health.warnings.length > 1 ? "s" : ""}` : ""}</span>
            </div>
            <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && ws.uploadFile(e.target.files[0])} />
              <button className="btn sm" onClick={() => fileRef.current?.click()}><Ic n="upload" />New file</button>
              <button className="btn sm ghost" onClick={ws.reset}>Start over</button>
            </div>
          </div>
        </aside>

        <div className="main">
          <div className="top">
            <div>
              <div className="crumb">{t[1]}</div>
              <h1>{t[0]}</h1>
            </div>
            <span className="sp" />
            <RankingMenu />
            <button className="btn round" aria-label="Switch light and dark theme" onClick={theme.toggle}><Ic n={theme.dark ? "sun" : "moon"} /></button>
            <button className="btn" title="Decisions, territories, onboarding, expansion list and history as one Excel file" onClick={() => { exportWorkbook(result, input, ws.state.audit, ws.state.fileName, rows, desk, ws.expList); showToast("Excel downloaded: decisions, territories, onboarding, expansion list, history"); }}>
              <Ic n="down" />
              <span className="exp-l">Download Excel</span>
            </button>
          </div>
          <div className="content" ref={content}>
            {ws.error && <p className="tag warn" style={{ whiteSpace: "normal", marginBottom: 12 }}>{ws.error}</p>}
            {body}
            <p className="muted" style={{ textAlign: "center", fontSize: 12, marginTop: 24 }}>Recommendations only. You confirm or move every decision.</p>
          </div>
        </div>

        <nav className="tabbar" aria-label="Main">
          {NAV.map(([v, ic, l]) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => go(v)}><Ic n={ic} />{v === "settings" ? "Rules" : l}</button>
          ))}
        </nav>

        {!chatOpen && <button className="fab" onClick={() => setChatOpen(true)}><Ic n="spark" />Ask</button>}

        <div>
          {(drawer || modal) && <div className="scrim still" onClick={closeAll} />}
          {drawer && <Drawer id={drawer.id} tab={drawer.tab} paste={drawer.paste} setTab={(tab) => setDrawer({ ...drawer, tab })} onClose={() => setDrawer(null)} />}
          {modal && <ModalHost modal={modal} onClose={() => setModal(null)} />}
          {chatOpen && <ChatPanel seed={seed} onClose={() => setChatOpen(false)} />}
          {toast && (
            <div className="toast" role="status">
              <Ic n="check" />
              {toast.text}
              {toast.act && <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => { toast.act!.run(); setToastState(null); }}>{toast.act.label}</button>}
            </div>
          )}
        </div>
      </div>
    </UiCtx.Provider>
  );
}
