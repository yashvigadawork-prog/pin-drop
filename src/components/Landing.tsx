"use client";

import { useRef, useState } from "react";

export function Landing({ onFile, onSample, loading, error }: { onFile: (f: File) => void; onSample: () => void; loading: boolean; error: string | null }) {
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">Franchise expansion · Karnataka</div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">From application to an open, trained store — every decision explained.</h1>
        <p className="mt-3 text-base text-slate-600">
          Upload the applications and territories sheet. PartnerPath checks every applicant against five gates, gives each territory&apos;s slots to the strongest partners without ever putting two stores in one pin, and builds an opening and training plan for each partner who moves forward. The expansion owner makes the final call.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={`mt-8 rounded-2xl border-2 border-dashed p-8 text-center transition ${drag ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white"}`}
      >
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
        </div>
        <p className="mt-3 font-medium text-slate-900">{loading ? "Reading the file…" : "Drop the Excel file here"}</p>
        <p className="text-sm text-slate-500">The Case 1 template: Applications, Territories, Existing stores</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button onClick={() => input.current?.click()} disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            Choose file
          </button>
          <button onClick={onSample} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Try with messy sample data
          </button>
          <a href="/Case1_Franchise_Test_Data_Format.xlsx" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
            Download blank template
          </a>
        </div>
        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <p className="mt-4 text-xs text-slate-400">The file is read in your browser. No login needed.</p>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-5">
        {[
          ["0", "Application", "Complete and consistent? Contradictions become questions, not rejections."],
          ["1", "Place", "Inside a target territory? Pin free of existing stores?"],
          ["2", "Partner", "Capital for the city tier? Will they run it themselves?"],
          ["3", "Premises", "Ground floor or mall, at least 250 sq ft?"],
          ["4", "Pace", "Can they really open when they say?"],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold text-indigo-600">Gate {n}</div>
            <div className="mt-1 font-semibold text-slate-900">{t}</div>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Then: <b className="text-slate-700">competition</b> (best fit score wins a contested slot, one store per pin) → <b className="text-slate-700">readiness plan</b> (opening path, training in their language, mentor store) → <b className="text-slate-700">owner sign-off</b>.
      </p>
    </div>
  );
}
