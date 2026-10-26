# Pin Drop

Franchise partner screening, slot allocation and onboarding for a growing retail brand. Built for the Ops Hackathon, Case 1.

Upload the Case 1 Excel file (Applications, Territories, Existing stores). Pin Drop reads it, decides every applicant with a reason, never puts two stores in one pin, and then helps the expansion owner act on the decisions.

## What it does

- **Decides with reasons.** Five gates per applicant (application, place, partner, premises, pace), a score you can inspect, and a plain-words explanation. Contradictions become questions, not rejections.
- **Today.** What needs you now: people waiting for your yes, replies to read, a spot-check of the engine, pin problems, slow replies. Every bulk email opens a review list first.
- **You stay the judge.** Move anyone to another bucket with a reason. Proceed needs a free pin, so one store per pin always holds.
- **Expansion list.** Valid pins we do not serve yet are kept, not rejected. Send "we'll keep you on file" now and "we're expanding" later.
- **Onboarding.** People you email next steps leave the Pipeline and appear here with documents, funds, background, conflict and validation checks, a pin hold countdown and a 90-day support plan.
- **Overview.** Accepted, pending and not accepted, a funnel, days at each step against targets, the biggest bottleneck, and an emailable summary for your boss.
- **Ask.** A chat that answers counts, lists, comparisons and "why" from the records, and re-decides when you give it new facts. Works without AI; Gemini handles other phrasing.
- Light and dark themes. Works on a phone.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # engine and workflow tests
npm run build
```

## Settings (all optional)

| Variable | What it does |
| --- | --- |
| `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` | AI for free-form chat. Keys are tried in order. Without them the chat still answers from the records. |
| `DATABASE_URL` or `POSTGRES_URL` | Saves runs so a link can be shared. The app works fully without it. |
| `RESEND_API_KEY`, `TEST_INBOX`, `MAIL_FROM` | "Real send" for demos. Every email goes to the one test inbox, never to an applicant. |

Never commit keys. Set them in your host's environment settings.

## Layout

- `src/lib/engine` rules engine (decisions, allocation, plans) and its tests
- `src/lib/desk` owner workflow on top of the engine: buckets, moves, emails, onboarding, metrics
- `src/components` screens
