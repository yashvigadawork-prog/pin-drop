import type { Update } from "../engine/updates";

export type PasteField = [label: string, value: string];

// Reads a pasted reply (email, WhatsApp, note) and returns the facts we can act on.
export function readPaste(t: string): { fields: PasteField[]; updates: Omit<Update, "appId">[] } {
  const fields: PasteField[] = [];
  const updates: Omit<Update, "appId">[] = [];
  const src = { source: "owner" as const, text: t };
  let m: RegExpMatchArray | null;
  if ((m = t.match(/(ground|mall)/i))) {
    const v = m[1].toLowerCase() === "mall" ? "Mall unit" : "Ground";
    fields.push(["Floor", v]);
    updates.push({ field: "floor", value: v, ...src });
  }
  if ((m = t.match(/(\d{3,4})\s*(sq\.? ?ft|sqft|square)/i))) {
    fields.push(["Size", `${m[1]} sq ft`]);
    updates.push({ field: "sizeSqft", value: Number(m[1]), ...src });
  }
  const loan = t.match(/(mudra|loan|sanction)/i);
  const funds = t.match(/₹?\s*(\d+(?:\.\d+)?)\s*(lakh|lac)\b/i);
  if (loan) {
    const sanctioned = /sanction/i.test(t);
    fields.push(["Loan", sanctioned ? "Sanctioned" : "Applied"]);
    updates.push({ field: "financing", value: sanctioned ? "sanctioned" : "applied", ...src });
  } else if (funds) {
    fields.push(["Funds", `₹${funds[1]}L extra`]);
    updates.push({ field: "extraCapital", value: Number(funds[1]), ...src });
  }
  if ((m = t.match(/\b(\d{6})\b/))) {
    fields.push(["Pin", m[1]]);
    updates.push({ field: "pin", value: m[1], ...src });
  }
  if (/(government|salaried|notice period|my job)/i.test(t)) fields.push(["Employment", "Mentioned. Worth a question"]);
  return { fields, updates };
}
