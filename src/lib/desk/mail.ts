import type { Row } from "./model";
import type { ExpPerson, MailType, UiStatus } from "./types";

export interface MailCtx {
  name: string;
  city: string;
  pin: string;
  asks: string[];
  why: string;
  alt?: string;
  offerPin?: string;
  req?: number | null;
  reason?: string;
}

export function ctxFromRow(r: Row): MailCtx {
  return {
    name: r.app.name,
    city: r.app.city ?? r.app.cityRaw,
    pin: r.app.pin ?? r.app.pinRaw,
    asks: r.asks,
    why: r.d.issues.find((i) => i.severity === "block")?.message ?? r.d.headline,
    alt: r.d.alternatives[0],
    offerPin: r.slotPin,
    req: r.d.requiredCapital,
  };
}
export function ctxFromExp(e: ExpPerson): MailCtx {
  return { name: e.name, city: e.city, pin: e.pin, asks: [], why: e.reason, reason: e.reason };
}

export function defaultMailType(ui: UiStatus, tag?: "pin" | "dup"): MailType {
  if (ui === "info") return tag === "pin" ? "pin" : tag === "dup" ? "dup" : "info";
  return { adv: "next", redir: "offer", wait: "line", no: "notnow", exp: "keep", info: "info" }[ui] as MailType;
}

export interface Mail {
  to: string;
  sub: string;
  html: string;
}

function first(n: string) {
  return n.split(" ")[0];
}
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const li = (xs: string[], fallback: string) => (xs.length ? xs : [fallback]).map((q) => `<li>${esc(q)}</li>`).join("");

export function mailFor(x: MailCtx, type: MailType, area?: string): Mail {
  const f = esc(first(x.name));
  const req = x.req ?? 25;
  const cityPlace = x.reason?.startsWith("City") ? x.city : `pin ${x.pin}`;
  const T: Record<MailType, [string, string]> = {
    next: [`Next steps for your store at pin ${x.offerPin ?? x.pin}`, `<p>Hi ${f},</p><p>Good news. We want to move forward with you at pin ${x.offerPin ?? x.pin} (${esc(x.city)}).</p><ul><li>Send PAN, Aadhaar and 6-month bank statements</li><li>Share proof of funds (₹${req}L)</li><li>Book your site visit in week 1</li></ul><p>Reply within 7 days. We hold your pin for 30 days.</p>`],
    offer: ["An offer for a different pin", `<p>Hi ${f},</p><p>Pin ${x.pin} is not available. We can offer you pin ${x.offerPin ?? "nearby"} instead.</p><p>Reply YES to continue, or NO and we keep you in line for ${esc(x.city)}.</p>`],
    info: ["A few details to finish your application", `<p>Hi ${f},</p><p>You are close. Please send:</p><ul>${li(x.asks, "The missing details on your form")}</ul><p>We will update your application within 2 working days.</p>`],
    pin: ["Please confirm your pin code", `<p>Hi ${f},</p><ul>${li(x.asks, "The 6-digit pin of the shop")}</ul><p>Reply with the 6-digit pin of the shop and we re-check straight away.</p>`],
    dup: ["We received your application twice", `<p>Hi ${f},</p><p>We found two forms from you. We kept the latest one. Reply only if something changed.</p>`],
    line: [`You are in line for ${x.city}`, `<p>Hi ${f},</p><p>You qualify, but every slot in your area is taken right now. You are first in line when one opens.</p>`],
    notnow: ["Your application: not right now", `<p>Hi ${f},</p><p>Thanks for applying. We cannot move ahead now.</p><ul><li>${esc(x.why)}</li></ul><p>${esc(x.alt ?? "Reply any time if this changes.")} We keep your details on file.</p>`],
    keep: [`We are not in ${cityPlace} yet`, `<p>Hi ${f},</p><p>We are not opening stores in ${esc(cityPlace)} right now. We added you to our expansion list.</p><p>When we expand there, you hear from us first.</p>`],
    exp2: [`We are expanding to ${area ?? x.city}`, `<p>Hi ${f},</p><p>You asked about a store in pin ${x.pin}. We are now expanding to ${esc(area ?? x.city)}.</p><p>Still interested? Reply YES and we restart your application with your earlier details.</p>`],
    remind: ["Reminder: we still need a few things", `<p>Hi ${f},</p><p>A quick reminder. We are still waiting for:</p><ul>${li(x.asks, "The details we asked for")}</ul><p>Reply when you can. Your place is held.</p>`],
  };
  const [sub, html] = T[type];
  return { to: `${first(x.name).toLowerCase().replace(/[^a-z]/g, "") || "applicant"}@example.com`, sub, html };
}

export function toText(html: string): string {
  return html.replace(/<li>/g, "- ").replace(/<\/li>|<\/p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();
}
