import json
import urllib.error
import urllib.request

payload = {
    "payload": {
        "p1_prenom": "Testeur",
        "p1_nom": "CRM",
        "p1_email": "alexandre.roy.97@hotmail.com",
        "p1_phone": "5145550100",
        "p1_dob": "01/01/1980",
        "address": "123 rue Test",
        "city": "Montreal",
        "province": "QC",
        "postal_code": "H2X1Y3",
        "credit_card_address": "123 rue Test\nMontreal, QC H2X1Y3",
        "assurance_medicale": "Oui",
        "passeport_valide": "Oui",
        "assurance_annulation": "Non",
        "terms_and_conditions": "true",
        "forfait_name": "Probe fetch",
        "forfait_slug": "probe-fetch",
        "occupation": "Occ. double",
        "nombre_adultes": "2",
        "nombre_enfants": "1",
        "kid_1_prenom": "Leo",
        "kid_1_nom": "CRM",
        "kid_1_dob": "02/02/2018",
        "notes_extra": "probe only",
    }
}
req = urllib.request.Request(
    "https://hart-intelligence-footwear-underground.trycloudflare.com/",
    data=json.dumps(payload).encode("utf-8"),
    method="POST",
    headers={
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://aubaineexpress.voyagefiesta.ca",
        "User-Agent": "Mozilla/5.0",
    },
)
try:
    with urllib.request.urlopen(req, timeout=40) as res:
        print(res.status, res.read()[:500])
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read()[:500])
except Exception as e:
    print(type(e).__name__, e)
