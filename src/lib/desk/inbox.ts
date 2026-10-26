// Reads a partner's email (.eml or pasted text), finds which onboarding documents it carries,
// and keeps the attachments for this session so the owner can open them and click Verify.

export interface InboundAttachment { name: string; type: string; url?: string }
export interface InboundMail { from: string; subject: string; date: string; body: string; attachments: InboundAttachment[] }
export interface DocHit { key: string; label: string; file: string }

const ATT = new Map<string, string>(); // `${appId}:${checkKey}` -> object URL, this session only
export const rememberAttachment = (id: string, key: string, url: string) => ATT.set(`${id}:${key}`, url);
export const attachmentUrl = (id: string, key: string) => ATT.get(`${id}:${key}`);

const RULES: [string, string, RegExp][] = [
  ["pan", "PAN card", /\bpan\b/i],
  ["kyc", "Aadhaar / KYC", /aadhaar|aadhar|\bkyc\b/i],
  ["gst", "GST registration", /\bgst/i],
  ["bank", "6-month bank statements", /bank\s*statement|statement/i],
  ["pof", "Proof of funds", /proof of funds|fixed deposit|\bfd\b|sanction|pof/i],
  ["src", "Source of funds", /source of funds/i],
  ["idadd", "Identity and address", /address proof|identity|voter|passport|driving|utility bill|electricity/i],
  ["court", "Court and litigation search", /litigation|court|no[- ]?dues|noc/i],
  ["credit", "Credit report", /cibil|credit (report|score)/i],
  ["refs", "Two references", /reference/i],
];

/** Which documents does this email carry? Attachment names count most, then the subject and the text. */
export function detectDocs(m: InboundMail): DocHit[] {
  const hits = new Map<string, DocHit>();
  for (const a of m.attachments) {
    for (const [key, label, re] of RULES) if (re.test(a.name) && !hits.has(key)) hits.set(key, { key, label, file: a.name });
  }
  const text = `${m.subject}\n${m.body}`;
  for (const [key, label, re] of RULES) {
    if (hits.has(key)) continue;
    if (m.attachments.length === 0 && !/attach|enclosed|find|sharing|sending|sent|here is|please find/i.test(text)) continue;
    if (re.test(text)) hits.set(key, { key, label, file: m.attachments[0]?.name ?? "In the email text" });
  }
  return [...hits.values()];
}

export function gmailLink(m: { from: string; subject: string }): string {
  const addr = /<([^>]+)>/.exec(m.from)?.[1] ?? m.from;
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`from:${addr} subject:"${m.subject}"`)}`;
}

function unfold(h: string) {
  return h.replace(/\r?\n[ \t]+/g, " ");
}
function headers(block: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const line of unfold(block).split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) o[line.slice(0, i).toLowerCase()] = line.slice(i + 1).trim();
  }
  return o;
}
function qp(s: string) {
  return s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function b64ToBlobUrl(b64: string, type: string): string | undefined {
  try {
    const bin = atob(b64.replace(/\s+/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: type || "application/octet-stream" }));
  } catch {
    return undefined;
  }
}

function walk(raw: string, out: { body: string; attachments: InboundAttachment[] }, depth = 0) {
  const split = raw.search(/\r?\n\r?\n/);
  const head = headers(split < 0 ? raw : raw.slice(0, split));
  const body = split < 0 ? "" : raw.slice(split).replace(/^\r?\n\r?\n/, "");
  const ct = head["content-type"] ?? "text/plain";
  const boundary = /boundary="?([^";]+)"?/i.exec(ct)?.[1];
  if (/multipart\//i.test(ct) && boundary && depth < 4) {
    for (const part of body.split(`--${boundary}`).slice(1)) {
      if (part.startsWith("--")) break;
      walk(part.replace(/^\r?\n/, ""), out, depth + 1);
    }
    return;
  }
  const disp = head["content-disposition"] ?? "";
  const name = /filename\*?="?([^";]+)"?/i.exec(disp)?.[1] ?? /name="?([^";]+)"?/i.exec(ct)?.[1];
  const enc = (head["content-transfer-encoding"] ?? "").toLowerCase();
  if (name && (/attachment/i.test(disp) || !/^text\//i.test(ct))) {
    out.attachments.push({ name, type: ct.split(";")[0], url: enc === "base64" ? b64ToBlobUrl(body, ct.split(";")[0]) : undefined });
    return;
  }
  if (/^text\/plain/i.test(ct) || !head["content-type"]) {
    let t = body;
    if (enc === "base64") {
      try { t = atob(body.replace(/\s+/g, "")); } catch {}
    } else if (enc === "quoted-printable") t = qp(body);
    out.body += (out.body ? "\n" : "") + t.trim();
  }
}

export function parseEml(text: string): InboundMail {
  const split = text.search(/\r?\n\r?\n/);
  const h = headers(split < 0 ? text : text.slice(0, split));
  const out = { body: "", attachments: [] as InboundAttachment[] };
  walk(text, out);
  return { from: h["from"] ?? "Unknown sender", subject: h["subject"] ?? "(no subject)", date: h["date"] ?? new Date().toISOString(), body: out.body, attachments: out.attachments };
}

/** Plain pasted text: "From:", "Subject:" lines are optional. Attachment names can be listed as "Attachments: a.pdf, b.pdf". */
export function parsePasted(text: string): InboundMail {
  const pick = (k: string) => new RegExp(`^${k}:\\s*(.+)$`, "im").exec(text)?.[1]?.trim();
  const files = (pick("attachments?") ?? "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  return { from: pick("from") ?? "Pasted email", subject: pick("subject") ?? "(no subject)", date: new Date().toISOString(), body: text, attachments: files.map((name) => ({ name, type: "" })) };
}

const DEMO_FILES: Record<string, [string, string]> = {
  pan: ["PAN_card.png", "PAN CARD"],
  kyc: ["Aadhaar_card.png", "AADHAAR"],
  gst: ["GST_certificate.png", "GST CERTIFICATE"],
  bank: ["Bank_statements_6_months.png", "BANK STATEMENT"],
  pof: ["Proof_of_funds_FD.png", "PROOF OF FUNDS"],
  src: ["Source_of_funds_letter.png", "SOURCE OF FUNDS"],
  idadd: ["Address_proof.png", "ADDRESS PROOF"],
  court: ["Court_search_report.png", "COURT SEARCH"],
  credit: ["CIBIL_report.png", "CREDIT REPORT"],
  refs: ["References.png", "REFERENCES"],
};

/** A demo partner email carrying documents this partner still owes, drawn as simple images so there is something to open. */
export function demoMail(name: string, want: string[]): InboundMail {
  const svg = (title: string, line: string) =>
    URL.createObjectURL(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#f4f1e8"/><rect x="18" y="18" width="604" height="364" fill="none" stroke="#888" stroke-dasharray="6 6"/><text x="40" y="80" font-family="monospace" font-size="26" fill="#222">SAMPLE · ${title}</text><text x="40" y="150" font-family="monospace" font-size="22" fill="#222">${line}</text><text x="40" y="360" font-family="monospace" font-size="16" fill="#777">Demo attachment. Not a real document.</text></svg>`], { type: "image/svg+xml" }));
  const first = name.split(" ")[0];
  const keys = want.filter((k) => DEMO_FILES[k]).slice(0, 3);
  return {
    from: `${name} <${first.toLowerCase()}@example.com>`,
    subject: "Documents for the franchise agreement",
    date: new Date().toISOString(),
    body: `Hi team,\n\nPlease find the documents you asked for attached.\n\nRegards,\n${name}`,
    attachments: keys.map((k) => ({ name: DEMO_FILES[k][0], type: "image/svg+xml", url: svg(DEMO_FILES[k][1], `Name: ${name}`) })),
  };
}
