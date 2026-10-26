"use client";

import { useRef, useState, type CSSProperties } from "react";
import { Ic, Logo } from "./Icon";
import { MapCanvas } from "./MapCanvas";

const GATES: [string, string, string][] = [
  ["file", "Application", "Complete and consistent?"],
  ["pin", "Place", "Pin free and in a target area?"],
  ["wallet", "Partner", "Capital and experience?"],
  ["build", "Premises", "Space fits the format?"],
  ["clock", "Pace", "Realistic timeline?"],
];
const STEPS: [string, string, string, string][] = [
  ["upload", "redir", "1 · Drop the file", "We read it, flag gaps and skip the template example row."],
  ["target", "adv", "2 · Decide", "Five gates, one clear reason, a score you can inspect."],
  ["send", "info", "3 · Act", "Emails, onboarding checklist and an expansion list, all in one place."],
];

export function Landing({ onFile, onSample, loading, error, dark, onTheme }: { onFile: (f: File) => void; onSample: () => void; loading: boolean; error: string | null; dark: boolean; onTheme: () => void }) {
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="landing">
      <div className="lwrap">
        <header className="row">
          <div className="brand" style={{ padding: 0 }}><Logo />Pin Drop</div>
          <span className="sp" />
          <span className="tag"><Ic n="target" />Case 1 · Franchise partner engine</span>
          <button className="btn sm round" aria-label="Switch light and dark theme" onClick={onTheme}><Ic n={dark ? "sun" : "moon"} /></button>
        </header>
        <div className="lhero">
          <div className="stack" style={{ gap: 20 }}>
            <span className="eyebrow rise">Franchise expansion · Karnataka</span>
            <h1 className="rise" style={{ "--i": 1 } as CSSProperties}>Applications in. <em>Open stores</em> out.</h1>
            <p className="muted rise" style={{ "--i": 2, fontSize: 17, maxWidth: "42ch" } as CSSProperties}>Upload applications and territories. Get a decision, a reason and a plan for every partner.</p>
            <div
              className={`drop-zone rise${drag ? " over" : ""}`}
              style={{ "--i": 3 } as CSSProperties}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
            >
              <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              <div className="row" style={{ gap: 12 }}>
                <span className="bucket" data-s="redir"><span className="ic"><Ic n="upload" /></span></span>
                <div>
                  <b style={{ fontSize: 16 }}>{loading ? "Reading the file…" : "Drop your Excel file"}</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>Applications · Territories · Existing stores. Read in your browser. No login.</div>
                </div>
              </div>
              <div className="row wrap">
                <button className="btn" disabled={loading} onClick={() => input.current?.click()}><Ic n="file" />Choose file</button>
                <button className="btn primary" disabled={loading} onClick={onSample}><Ic n="spark" />Try the sample data</button>
                <a className="btn ghost" href="/Case1_Franchise_Test_Data_Format.xlsx">Download blank template</a>
              </div>
              {error && <p className="tag warn" style={{ whiteSpace: "normal" }}>{error}</p>}
            </div>
            <div className="row wrap rise" style={{ "--i": 4 } as CSSProperties}>
              <span className="tag"><Ic n="plus" />Extra columns picked up if present</span>
              <span className="tag"><Ic n="msg" />Paste any reply, we fill the fields</span>
              <span className="tag"><Ic n="globe" />Unserved pins kept for later</span>
            </div>
          </div>
          <div className="map rise" style={{ "--i": 2 } as CSSProperties}><MapCanvas compact /></div>
        </div>
        <div className="steps3">
          {STEPS.map(([ic, s, t, d], i) => (
            <div key={t} className="card rise" data-s={s} style={{ "--i": i + 4 } as CSSProperties}>
              <div className="bucket"><span className="ic"><Ic n={ic} /></span><h3 style={{ margin: 0 }}>{t}</h3><p>{d}</p></div>
            </div>
          ))}
        </div>
        <div className="card rise" style={{ "--i": 7 } as CSSProperties}>
          <h3><Ic n="shield" />Five gates every applicant passes</h3>
          <div className="gatesrow">
            {GATES.map(([ic, t, d], i) => (
              <div key={t} className="gate pop" data-g="p" style={{ "--i": i + 8 } as CSSProperties}>
                <span className="g"><Ic n={ic} /></span>
                <b>{t}</b>
                <span className="muted" style={{ fontWeight: 500 }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
