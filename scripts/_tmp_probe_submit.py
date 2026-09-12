import json
import urllib.error
import urllib.request

URLS = [
    "https://hart-intelligence-footwear-underground.trycloudflare.com/",
    "https://hart-intelligence-footwear-underground.trycloudflare.com/submit",
    "http://158.69.1.173:3847/",
    "http://158.69.1.173/reservation/",
]

payload = {
    "payload": {
        "p1_prenom": "Probe",
        "p1_nom": "Fetch",
        "p1_email": "probe-fetch-do-not-use@example.com",
        "p1_phone": "5145550100",
        "request_type": "reservation",
    }
}
body = json.dumps(payload).encode("utf-8")

for url in URLS:
    print("\n====", url)
    for method in ("OPTIONS", "GET"):
        req = urllib.request.Request(
            url,
            data=None,
            method=method,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Origin": "https://aubaineexpress.voyagefiesta.ca",
                "User-Agent": "Mozilla/5.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                raw = res.read()[:400]
                print(
                    method,
                    res.status,
                    "ACA-Origin=",
                    res.headers.get("Access-Control-Allow-Origin"),
                    "ACA-Methods=",
                    res.headers.get("Access-Control-Allow-Methods"),
                    raw[:180],
                )
        except urllib.error.HTTPError as e:
            print(method, "HTTP", e.code, e.headers.get("Access-Control-Allow-Origin"), e.read()[:220])
        except Exception as e:
            print(method, type(e).__name__, e)
