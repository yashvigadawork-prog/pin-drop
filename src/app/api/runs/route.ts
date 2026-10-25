import { db } from "@/lib/db";

export async function POST(req: Request) {
  const d = db();
  if (!d) return Response.json({ disabled: true }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.input || !body?.config) return Response.json({ error: "bad request" }, { status: 400 });
  const raw = JSON.stringify(body.input);
  if (raw.length > 2_000_000) return Response.json({ error: "file too large" }, { status: 413 });
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  await d.ready;
  await d.sql`INSERT INTO runs (id, file_name, input, config) VALUES (${id}, ${String(body.fileName ?? "").slice(0, 200)}, ${raw}::jsonb, ${JSON.stringify(body.config)}::jsonb)`;
  return Response.json({ id });
}
