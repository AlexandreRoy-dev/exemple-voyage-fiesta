#!/usr/bin/env python3
"""Import Anny Blondeau clients → GHL create-only, assignedTo Anny. Skip existing."""
from __future__ import annotations

import importlib.util
import json
import re
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CONTACTS_JSON = (
    ROOT
    / "imports"
    / "email-audience-extraction"
    / "batch-2026-09"
    / "anny_blondeau_contacts.json"
)
REPORT = (
    ROOT
    / "imports"
    / "email-audience-extraction"
    / "batch-2026-09"
    / "anny_blondeau_import_report.json"
)

ANNY_USER_ID = "o6Mx5Liscw7hC4govkws"
LOCATION_ID = "V90iyFBbBrCg3tpctRjc"

spec = importlib.util.spec_from_file_location(
    "deploy", HERE / "deploy-reservation-api-vps.py"
)
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)


def norm_key(k: str) -> str:
    return (
        k.lower()
        .replace("é", "e")
        .replace("è", "e")
        .replace("ê", "e")
        .replace("à", "a")
        .replace("ô", "o")
        .strip()
    )


def pick(row: dict, *names: str) -> str:
    want = {norm_key(n) for n in names}
    for k, v in row.items():
        nk = norm_key(k)
        # mojibake-tolerant: strip non-ascii letters for compare
        nk_ascii = re.sub(r"[^a-z0-9. ()#]+", "", nk)
        if nk in want or nk_ascii in want or any(n in nk or n in nk_ascii for n in want):
            if v is None:
                continue
            s = str(v).strip()
            if s and s.lower() not in ("none", "null"):
                return s
    return ""


def pick_contains(row: dict, *needles: str) -> str:
    for k, v in row.items():
        nk = norm_key(k)
        nk_ascii = re.sub(r"[^a-z0-9. ()#]+", "", nk)
        if all(n in nk or n in nk_ascii for n in needles):
            if v is None:
                continue
            s = str(v).strip()
            if s and s.lower() not in ("none", "null"):
                return s
    return ""


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return ""
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if raw.strip().startswith("+"):
        return "+" + digits
    return f"+{digits}" if digits else ""


def normalize_email(raw: str) -> str:
    return str(raw or "").strip().lower()


def build_payloads(rows: list[dict]) -> list[dict]:
    out = []
    for row in rows:
        last = ""
        first = ""
        for k, v in row.items():
            nk = re.sub(r"[^a-z]", "", norm_key(k))
            if nk == "nom":
                last = str(v or "").strip()
            elif nk in ("prenom", "prnom") or (nk.startswith("pr") and nk.endswith("nom") and nk != "nom"):
                first = str(v or "").strip()
        email = normalize_email(pick(row, "courriel", "email"))
        p1 = normalize_phone(pick_contains(row, "principal") or pick(row, "tel. (principal)"))
        p2 = normalize_phone(pick_contains(row, "cell") or pick(row, "tel. (cell)"))
        phone = p1 or p2
        if not email and not phone:
            continue
        address = pick(row, "adresse")
        city = pick(row, "ville")
        state = pick(row, "province")
        postal = pick(row, "postal")
        comments = pick(row, "commentaires")
        profil = pick(row, "profil")
        notes_bits = [b for b in (comments, profil) if b]
        payload = {
            "firstName": first.title() if first else "",
            "lastName": last.title() if last else "",
            "email": email or None,
            "phone": phone or None,
            "address1": address or None,
            "city": city.title() if city else None,
            "state": state or None,
            "postalCode": postal.replace(" ", "") if postal else None,
            "country": "CA",
            "source": "Import Anny Blondeau 2026-09",
            "assignedTo": ANNY_USER_ID,
            "tags": ["import-conseiller", "import-anny-blondeau"],
            "notes": "\n".join(notes_bits) if notes_bits else None,
        }
        payload = {k: v for k, v in payload.items() if v not in (None, "")}
        out.append(payload)
    return out


REMOTE_JS = r"""
import { readFileSync, writeFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('/opt/voyage-fiesta-reservation/.env', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[t.slice(0, i).trim()] = v;
}
const key = env.GHL_API_KEY;
const loc = env.GHL_LOCATION_ID || 'V90iyFBbBrCg3tpctRjc';
const HDR = {
  Authorization: `Bearer ${key}`,
  Version: '2021-07-28',
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'voyage-fiesta-import/1.0'
};
const contacts = JSON.parse(readFileSync('/tmp/anny_import_payloads.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchDuplicate(email, phone) {
  // contacts/search with filters
  const filters = [];
  if (email) filters.push({ field: 'email', operator: 'eq', value: email });
  const body = { locationId: loc, pageLimit: 5, filters };
  if (!email && phone) {
    body.filters = [{ field: 'phone', operator: 'eq', value: phone }];
  }
  const res = await fetch('https://services.leadconnectorhq.com/contacts/search', {
    method: 'POST',
    headers: HDR,
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  const list = data.contacts || [];
  if (list.length) return list[0];
  // if email search empty and we have phone, try phone
  if (email && phone) {
    const res2 = await fetch('https://services.leadconnectorhq.com/contacts/search', {
      method: 'POST',
      headers: HDR,
      body: JSON.stringify({
        locationId: loc,
        pageLimit: 5,
        filters: [{ field: 'phone', operator: 'eq', value: phone }]
      })
    });
    const t2 = await res2.text();
    let d2;
    try { d2 = JSON.parse(t2); } catch { d2 = {}; }
    return (d2.contacts || [])[0] || null;
  }
  return null;
}

async function createContact(payload) {
  const body = { ...payload, locationId: loc };
  const notes = body.notes;
  delete body.notes;
  const res = await fetch('https://services.leadconnectorhq.com/contacts/', {
    method: 'POST',
    headers: HDR,
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    return { ok: false, status: res.status, error: data.message || data.msg || text.slice(0, 300), data };
  }
  const contactId = data.contact?.id || data.id;
  if (contactId && notes) {
    await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: HDR,
      body: JSON.stringify({ body: notes })
    });
  }
  return { ok: true, contactId, status: res.status };
}

const report = { created: [], skipped: [], errors: [] };
for (let i = 0; i < contacts.length; i++) {
  const p = contacts[i];
  const label = `${p.firstName || ''} ${p.lastName || ''} <${p.email || p.phone || ''}>`.trim();
  try {
    const existing = await searchDuplicate(p.email || '', p.phone || '');
    if (existing?.id) {
      report.skipped.push({ label, contactId: existing.id, email: p.email, phone: p.phone });
      console.log('SKIP', i + 1, label, existing.id);
    } else {
      const result = await createContact(p);
      if (result.ok) {
        report.created.push({ label, contactId: result.contactId, email: p.email, phone: p.phone });
        console.log('CREATE', i + 1, label, result.contactId);
      } else {
        // duplicate race / 400 often means exists
        const err = String(result.error || '');
        if (result.status === 400 && /duplicate|exist/i.test(err)) {
          report.skipped.push({ label, reason: err, email: p.email, phone: p.phone });
          console.log('SKIP_DUP', i + 1, label, err.slice(0, 120));
        } else {
          report.errors.push({ label, status: result.status, error: err, email: p.email });
          console.log('ERR', i + 1, label, result.status, err.slice(0, 200));
        }
      }
    }
  } catch (e) {
    report.errors.push({ label, error: String(e) });
    console.log('EXC', i + 1, label, e);
  }
  await sleep(250);
}

report.summary = {
  total: contacts.length,
  created: report.created.length,
  skipped: report.skipped.length,
  errors: report.errors.length,
  assignedTo: 'o6Mx5Liscw7hC4govkws'
};
writeFileSync('/tmp/anny_import_report.json', JSON.stringify(report, null, 2));
console.log('SUMMARY', JSON.stringify(report.summary));
"""


def main() -> None:
    rows = json.loads(CONTACTS_JSON.read_text(encoding="utf-8"))
    payloads = build_payloads(rows)
    print(f"payloads: {len(payloads)} from {len(rows)} rows")
    local_payloads = CONTACTS_JSON.parent / "anny_blondeau_payloads.json"
    local_payloads.write_text(json.dumps(payloads, ensure_ascii=False, indent=2), encoding="utf-8")

    c = d.connect()
    try:
        sftp = c.open_sftp()
        sftp.put(str(local_payloads), "/tmp/anny_import_payloads.json")
        with sftp.file("/tmp/anny_import.mjs", "w") as f:
            f.write(REMOTE_JS)
        sftp.close()
        code, out, err = d.run(c, "node /tmp/anny_import.mjs", timeout=600)
        print(out[-4000:] if len(out) > 4000 else out)
        if err:
            print(err[-1000:])
        sftp = c.open_sftp()
        sftp.get("/tmp/anny_import_report.json", str(REPORT))
        sftp.close()
        report = json.loads(REPORT.read_text(encoding="utf-8"))
        print("REPORT", report.get("summary"))
    finally:
        c.close()


if __name__ == "__main__":
    main()
