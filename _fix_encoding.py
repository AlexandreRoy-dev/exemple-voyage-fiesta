import glob, os, extract_msg
temp = os.environ.get("TEMP")
path = glob.glob(os.path.join(temp, "*incication*.msg"))[0]
msg = extract_msg.Message(path)
body = msg.body
# try cp1252 fix if mojibake
if body and "Ac" in body:
    try:
        body_fixed = body.encode("latin-1", errors="replace").decode("cp1252", errors="replace")
    except Exception:
        body_fixed = body
else:
    body_fixed = body
out = os.path.join(os.path.dirname(__file__), "_msg_output_utf8.txt")
with open(out, "w", encoding="utf-8") as f:
    f.write(f"=== SUBJECT ===\n{msg.subject}\n\n=== FROM ===\n{msg.sender}\n\n=== TO ===\n{msg.to}\n\n=== DATE ===\n{msg.date}\n\n=== BODY ===\n{body_fixed}\n")
msg.close()
print("done")
