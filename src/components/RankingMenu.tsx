"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Ic } from "./Icon";
import { ChangeList, useUi } from "./kit";
import { PHASE_PRESETS } from "@/lib/engine/config";
import { diffResults, runEngine } from "@/lib/engine/engine";
import type { Weights } from "@/lib/engine/types";

const W: [keyof Weights, string][] = [["partner", "Partner"], ["premises", "Premises"], ["place", "Place"], ["pace", "Pace"]];

// Ranking lives in the top bar so it can be changed from any page.
// Nothing changes until Apply. The preview shows who would move first.
export function RankingMenu() {
  const ui = useUi();
  const { ws } = ui;
  const { result, input, state } = ws;
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [custom, setCustom] = useState<Weights | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const cfg = result?.config;

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const candidate: Weights | null = custom ?? (pick ? PHASE_PRESETS.find((p) => p.name === pick)?.weights ?? null : null);
  const preview = useMemo(() => {
    if (!open || !input || !result || !candidate || !cfg) return null;
    const next = runEngine(input, { ...cfg, weights: candidate }, { owner: state.owner });
    return diffResults(result, next).filter((c) => c.from !== c.to || c.fromAlloc !== c.toAlloc);
  }, [open, input, result, cfg, candidate, state.owner]);

  if (!cfg || !result) return null;
  const live = custom ?? candidate ?? cfg.weights;
  const dirty = !!candidate && (!!custom || pick !== cfg.phaseName);
  const close = () => {
    setOpen(false);
    setPick(null);
    setCustom(null);
  };
  const apply = () => {
    if (!candidate) return;
    const name = custom ? "Custom" : pick!;
    ws.setConfig({ ...cfg, weights: candidate, phaseName: name }, `Ranking set to ${name}`, "weights");
    ui.toast(`Ranking: ${name}`);
    close();
  };

  return (
    <div className="rankbox" ref={box}>
      <button className={`pill${open ? " on" : ""}`} aria-haspopup="dialog" aria-expanded={open} title="How people competing for the same slot are ranked" onClick={() => (open ? close() : setOpen(true))}>
        <Ic n="sliders" /><span className="pill-l">Ranking:</span><span className="pill-n">{cfg.phaseName}</span><Ic n="chev" />
      </button>
      {open && (
        <div className="rankmenu" role="dialog" aria-label="Ranking">
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Ranking only decides who wins when people want the same slot. The hard rules never change.</p>
          <div className="eyebrow">Presets</div>
          <div className="stack" style={{ gap: 6 }}>
            {PHASE_PRESETS.map((p) => {
              const on = !custom && (pick ?? cfg.phaseName) === p.name;
              return (
                <button key={p.name} className={`phase${on ? " on" : ""}`} onClick={() => { setPick(p.name); setCustom(null); }}>
                  <div className="row"><b>{p.name}</b><span className="sp" />{cfg.phaseName === p.name && <span className="tag">Active</span>}</div>
                  <div className="wbar">{[p.weights.partner, p.weights.premises, p.weights.place, p.weights.pace].map((x, k) => <i key={k} style={{ width: `${x}%`, background: `color-mix(in srgb,var(--ink) ${100 - k * 22}%,transparent)` } as CSSProperties} />)}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{p.when}</div>
                </button>
              );
            })}
          </div>
          <div className="eyebrow">Or set your own</div>
          <div className="stack" style={{ gap: 8 }}>
            {W.map(([key, label]) => (
              <label key={key} className="row">
                <span style={{ width: 78, fontWeight: 600, fontSize: 13 }}>{label}</span>
                <input type="range" min={5} max={70} value={live[key]} style={{ flex: 1 }} onChange={(e) => setCustom({ ...live, [key]: Number(e.target.value) })} />
                <b className="mono" style={{ width: 28, textAlign: "right" }}>{live[key]}</b>
              </label>
            ))}
          </div>
          {dirty && preview && (
            <div className="rankprev">
              <b>{preview.length ? `${preview.length} recommendation${preview.length === 1 ? "" : "s"} would change` : "Nobody moves"}</b>
              {preview.length > 0 && <ChangeList changes={preview} onOpen={(id) => { close(); ui.open(id); }} max={5} />}
            </div>
          )}
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={close}>{dirty ? "Cancel" : "Close"}</button>
            <button className="btn primary" disabled={!dirty} onClick={apply}>Apply and re-rank</button>
          </div>
        </div>
      )}
    </div>
  );
}
