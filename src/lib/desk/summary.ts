import type { Row } from "./model";
import { active, byCity, countBy } from "./model";
import { SAMPLE_TREND, funnel, stageTimes } from "./metrics";
import type { Workspace } from "@/components/useWorkspace";

// Who gets the weekly summary. Lower rank = more senior. If several people are picked,
// the email is written for the most senior one, and the others are copied.
export const STAKEHOLDERS = [
  { key: "ceo", name: "CEO", rank: 1, focus: "Outcome, risk and the one decision needed" },
  { key: "coo", name: "COO", rank: 2, focus: "Speed, bottlenecks and where work is stuck" },
  { key: "finance", name: "Finance lead", rank: 3, focus: "Capital committed, financing risk and payback" },
  { key: "expansion", name: "Head of Expansion", rank: 4, focus: "Territories, open pins and where to grow" },
  { key: "regional", name: "Regional manager", rank: 5, focus: "City by city: who is coming and what to prepare" },
] as const;
export type StakeKey = (typeof STAKEHOLDERS)[number]["key"];

export function seniorOf(keys: StakeKey[]): StakeKey {
  return [...keys].sort((a, b) => STAKEHOLDERS.find((s) => s.key === a)!.rank - STAKEHOLDERS.find((s) => s.key === b)!.rank)[0] ?? "ceo";
}

export interface Summary { sub: string; intro: string; lines: string[]; ask: string }

const lakh = (n: number) => `₹${Math.round(n * 10) / 10} lakh`;

export function buildSummary(key: StakeKey, ws: Workspace, now: number, copied: string[] = []): Summary {
  const { rows, desk, result, expList } = ws;
  const c = countBy(rows);
  const act = active(rows);
  const accepted = rows.filter((r) => r.ui === "adv" || r.ui === "redir");
  const waiting = act.filter((r) => r.ui === "adv" || r.ui === "redir").length;
  const times = stageTimes(desk, now);
  const worst = times.filter((t) => t.avg !== null).sort((a, b) => b.avg! - b.target - (a.avg! - a.target))[0];
  const bottleneck = worst && worst.avg! > worst.target ? `${worst.name}: ${worst.avg} days against a ${worst.target}-day target` : null;
  const terr = result?.territories ?? [];
  const slotsAll = terr.reduce((a, t) => a + t.territory.slots, 0);
  const slotsFilled = rows.filter((r) => r.slotTerr && (r.ui === "adv" || r.ui === "redir")).length;
  const onb = Object.keys(desk.onb).length;
  const fl = Object.values(desk.onb).reduce((a, o) => a + Object.values(o.chk).filter((v) => v === "flag").length, 0);
  const asked = act.filter((r) => r.ui === "info" && desk.mail[r.id] && !desk.replies.some((p) => p.id === r.id)).length;
  const days = desk.sample ? SAMPLE_TREND[3] : null;
  const cc = copied.length ? ` (copied: ${copied.join(", ")})` : "";
  const f = funnel(rows, desk);
  const sub = `Pin Drop weekly summary: ${STAKEHOLDERS.find((s) => s.key === key)!.name}${cc}`;

  if (key === "ceo") {
    const lines = [
      `${slotsFilled} of ${slotsAll} territory slots are filled. ${accepted.length} partners accepted out of ${rows.length} applications.`,
      `${onb} partners are in onboarding.${days ? ` Application to signed agreement now takes ${days} days.` : ""}`,
      bottleneck ? `Main risk: ${bottleneck}.` : "No bottleneck yet.",
      `${expList.length} people are kept on the expansion list for later.`,
    ];
    return { sub, intro: "Headline numbers and one decision.", lines, ask: waiting ? `Decision needed: ${waiting} proceed recommendations are waiting for approval.` : "No decision needed this week." };
  }
  if (key === "coo") {
    const steps = f.slice(1).map((s, i) => `${f[i][0]} → ${s[0]}: ${f[i][1] ? Math.round((s[1] / f[i][1]) * 100) : 0}%`).slice(1, 5);
    return {
      sub, intro: "Where the process is fast, and where it is stuck.",
      lines: [
        ...steps,
        bottleneck ? `Bottleneck: ${bottleneck}.` : "No bottleneck yet.",
        `${waiting} decisions are waiting on the owner. ${asked} partners are slow to reply.`,
        `${fl} onboarding check${fl === 1 ? " is" : "s are"} flagged.`,
      ],
      ask: asked ? `Ask: approve reminders to the ${asked} slow partners.` : "Ask: none.",
    };
  }
  if (key === "finance") {
    const committed = accepted.reduce((a, r) => a + (r.app.investment ?? 0), 0);
    const near = act.filter((r) => r.d.issues.some((i) => i.code === "FINANCING_PROBABLE")).length;
    const short = rows.filter((r) => r.d.issues.some((i) => i.code === "CAPITAL_SHORT")).length;
    return {
      sub, intro: "Capital committed and where financing is the risk.",
      lines: [
        `Capital committed by accepted partners: ${lakh(committed)} across ${accepted.length} partners.`,
        `${near} applicants are close on capital and depend on financing. ${short} did not meet the capital minimum.`,
        `${Object.values(desk.onb).filter((o) => o.chk.pof === "verified").length} of ${onb} onboarding partners have verified proof of funds.`,
        `Kill rule: pause if 3 of the first 10 partners drop out before signing.`,
      ],
      ask: near ? `Ask: confirm the financing approach for the ${near} close-on-capital applicants.` : "Ask: none.",
    };
  }
  if (key === "expansion") {
    const hot = byCity(expList).filter((x) => x[1] >= desk.expThreshold).map((x) => `${x[0]} (${x[1]})`);
    return {
      sub, intro: "Territory by territory, and where demand is outside our areas.",
      lines: [
        ...terr.map((t) => {
          const al = rows.filter((r) => r.slotTerr === t.territory.id && (r.ui === "adv" || r.ui === "redir")).length;
          return `${t.territory.city} ${t.territory.id}: ${al}/${t.territory.slots} slots filled${t.capacity < t.territory.slots ? `, only ${t.capacity} free pins` : ""}.`;
        }).slice(0, 8),
        `${c.wait} qualified applicants are on the waitlist because every slot is taken.`,
        hot.length ? `Areas worth opening: ${hot.join(", ")}.` : `No outside area has reached ${desk.expThreshold} people yet.`,
      ],
      ask: hot.length ? `Ask: decide whether to open ${hot[0].split(" (")[0]}.` : "Ask: none.",
    };
  }
  const cities = [...new Set(rows.map((r) => r.app.city ?? r.app.cityRaw).filter(Boolean))].slice(0, 8);
  return {
    sub, intro: "City by city: who is coming and what to prepare.",
    lines: cities.map((city) => {
      const here = rows.filter((r) => (r.app.city ?? r.app.cityRaw) === city);
      const acc = here.filter((r) => r.ui === "adv" || r.ui === "redir").length;
      const inO = here.filter((r) => desk.onb[r.id]).length;
      return `${city}: ${acc} accepted, ${inO} in onboarding, ${here.filter((r) => r.ui === "wait").length} waitlisted.`;
    }),
    ask: "Ask: line up site visits for the partners in onboarding.",
  };
}

export function summaryText(s: Summary): string {
  return [s.intro, ...s.lines.map((l) => `- ${l}`), s.ask].join("\n");
}
export type { Row };
