// "Real send" for demos: every email goes to ONE test inbox, never to an applicant.
// Needs RESEND_API_KEY and TEST_INBOX on the server. Without them the app stays in demo mode.

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 40;
}

export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY;
  const inbox = process.env.TEST_INBOX;
  if (!key || !inbox) return Response.json({ disabled: true, error: "Real send is not set up" }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (limited(ip)) return Response.json({ error: "Too many emails, try again in a minute." }, { status: 429 });
  const body = await req.json().catch(() => null);
  const sub = String(body?.sub ?? "").slice(0, 200);
  const text = String(body?.text ?? "").slice(0, 8000);
  if (!sub || !text) return Response.json({ error: "bad request" }, { status: 400 });
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM ?? "Pin Drop <onboarding@resend.dev>", to: [inbox], subject: `[Pin Drop demo] ${sub}`, text: `Intended for: ${String(body?.to ?? "applicant")}\n\n${text}` }),
  });
  if (!r.ok) return Response.json({ error: "send failed" }, { status: 502 });
  return Response.json({ ok: true });
}
