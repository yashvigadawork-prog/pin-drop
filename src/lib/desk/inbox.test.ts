import { describe, expect, it } from "vitest";
import { detectDocs, gmailLink, parseEml, parsePasted } from "./inbox";

const eml = [
  "From: Ravi Kumar <ravi@example.com>",
  "Subject: Documents for franchise",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="BB"',
  "",
  "--BB",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Please find my PAN card and bank statements attached.",
  "--BB",
  'Content-Type: application/pdf; name="PAN_card.pdf"',
  'Content-Disposition: attachment; filename="PAN_card.pdf"',
  "Content-Transfer-Encoding: base64",
  "",
  "JVBERi0xLjQK",
  "--BB",
  'Content-Type: application/pdf; name="Bank_statement_Apr-Sep.pdf"',
  'Content-Disposition: attachment; filename="Bank_statement_Apr-Sep.pdf"',
  "Content-Transfer-Encoding: base64",
  "",
  "JVBERi0xLjQK",
  "--BB--",
].join("\r\n");

describe("partner inbox", () => {
  it("reads sender, subject, text and attachments from an .eml", () => {
    const m = parseEml(eml);
    expect(m.from).toContain("ravi@example.com");
    expect(m.subject).toBe("Documents for franchise");
    expect(m.body).toContain("PAN card");
    expect(m.attachments.map((a) => a.name)).toEqual(["PAN_card.pdf", "Bank_statement_Apr-Sep.pdf"]);
  });

  it("finds the documents an email carries", () => {
    const keys = detectDocs(parseEml(eml)).map((d) => d.key).sort();
    expect(keys).toEqual(["bank", "pan"]);
  });

  it("reads pasted text with an Attachments line", () => {
    const m = parsePasted("From: A <a@b.com>\nSubject: KYC\nAttachments: Aadhaar.pdf, GST_certificate.pdf\n\nHere you go");
    expect(detectDocs(m).map((d) => d.key).sort()).toEqual(["gst", "kyc"]);
  });

  it("finds nothing in a chatty email without documents", () => {
    expect(detectDocs(parsePasted("Hi, when can we talk about the store?"))).toEqual([]);
  });

  it("links to the exact email in Gmail", () => {
    expect(gmailLink({ from: "Ravi <ravi@example.com>", subject: "Docs" })).toContain("from%3Aravi%40example.com");
  });
});
