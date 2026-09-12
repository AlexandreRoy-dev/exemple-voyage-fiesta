import urllib.error
import urllib.request

urls = [
    "https://hart-intelligence-footwear-underground.trycloudflare.com/",
    "http://158.69.1.173:3847/",
]
for url in urls:
    print("\n==== POST", url)
    req = urllib.request.Request(
        url,
        data=b'{"payload":{}}',
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Origin": "https://aubaineexpress.voyagefiesta.ca",
            "User-Agent": "Mozilla/5.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            print(res.status, res.headers.get("Access-Control-Allow-Origin"), res.read()[:300])
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.headers.get("Access-Control-Allow-Origin"), e.read()[:300])
    except Exception as e:
        print(type(e).__name__, e)
