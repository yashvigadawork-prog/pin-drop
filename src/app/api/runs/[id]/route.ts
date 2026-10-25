import { db } from "@/lib/db";

const KINDS = new Set(["update", "owner", "weights", "config", "chat"]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const d = db();
  if (!d) return Response.json({ disabled: true }, { status: 503 });
  const { id } = await params;
  await d.ready;
  const runs = await d.sql`SELECT id, created_at, file_name, input, config FROM runs WHERE id = ${id}`;
  if (!runs.length) return Response.json({ error: "not found" }, { status: 404 });
  const events = await d.sql`SELECT id, at, kind, payload FROM run_events WHERE run_id = ${id} ORDER BY id`;
  return Response.json({ run: runs[0], events });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const d = db();
  if (!d) return Response.json({ disabled: true }, { status: 503 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !KINDS.has(body.kind)) return Response.json({ error: "bad request" }, { status: 400 });
  const payload = JSON.stringify(body.payload ?? {});
  if (payload.length > 50_000) return Response.json({ error: "too large" }, { status: 413 });
  await d.ready;
  const r = await d.sql`INSERT INTO run_events (run_id, kind, payload) SELECT ${id}, ${body.kind}, ${payload}::jsonb WHERE EXISTS (SELECT 1 FROM runs WHERE id = ${id}) RETURNING id, at`;
  if (!r.length) return Response.json({ error: "run not found" }, { status: 404 });
  return Response.json(r[0]);
}
