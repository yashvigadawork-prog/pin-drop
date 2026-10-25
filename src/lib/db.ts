import { neon } from "@neondatabase/serverless";

// Optional persistence: every upload becomes a "run" and every owner decision or update an
// event, giving the team an audit trail and a shareable link. The app works fully without it.

let ready: Promise<void> | null = null;

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const sql = neon(url);
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        file_name TEXT,
        input JSONB NOT NULL,
        config JSONB NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS run_events (
        id BIGSERIAL PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        at TIMESTAMPTZ NOT NULL DEFAULT now(),
        kind TEXT NOT NULL,
        payload JSONB NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS run_events_run ON run_events(run_id, id)`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return { sql, ready };
}
