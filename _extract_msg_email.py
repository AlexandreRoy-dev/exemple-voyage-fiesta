import glob
import os
import extract_msg
temp = os.environ.get("TEMP", r"c:\Users\Alex\AppData\Local\Temp")
matches = glob.glob(os.path.join(temp, "*incication*.msg"))
if not matches:
    matches = glob.glob(os.path.join(temp, "*Audience*.msg"))
if not matches:
    raise SystemExit("MSG not found")
path = matches[0]
out = os.path.join(os.path.dirname(__file__), "_msg_output.txt")
msg = extract_msg.Message(path)
parts = []
for label, val in [
    ("SUBJECT", msg.subject),
    ("FROM", msg.sender),
    ("TO", msg.to),
    ("CC", msg.cc),
    ("DATE", str(msg.date)),
    ("BODY", msg.body),
]:
    parts.append(f"=== {label} ===\n{val or ''}\n")
if getattr(msg, "htmlBody", None):
    hb = msg.htmlBody
    if isinstance(hb, bytes):
        hb = hb.decode("utf-8", errors="replace")
    parts.append(f"=== HTML_BODY ===\n{hb}\n")
msg.close()
text = "\n".join(parts)
with open(out, "w", encoding="utf-8") as f:
    f.write(text)
print("WROTE", out, "bytes", len(text.encode("utf-8")))
