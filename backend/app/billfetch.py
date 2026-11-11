"""Fetch a duplicate electricity bill from the official PITC web-bill portal (bill.pitc.com.pk) by reference number.

Behaviour, on purpose:
- One request per user action, at human pace, identified as Roshni; small per-client rate limit.
- Never solves, bypasses or works around a CAPTCHA. If the portal asks for one, we stop and tell the user to
  upload a photo of the bill instead (or open the official portal themselves).
- The reference number is sent only to the official portal; it is not stored or logged by Roshni.
- K-Electric is not on the PITC portal; Karachi users upload a photo.
"""
import re
import time
from collections import defaultdict, deque

import httpx

BASE = "https://bill.pitc.com.pk"
DISCOS = {
    "LESCO": "lescobill", "IESCO": "iescobill", "FESCO": "fescobill", "GEPCO": "gepcobill", "MEPCO": "mepcobill",
    "PESCO": "pescobill", "HESCO": "hescobill", "SEPCO": "sepcobill", "QESCO": "qescobill", "TESCO": "tescobill",
    "HAZECO": "hazecobill",
}
UA = "Mozilla/5.0 (compatible; RoshniBillLookup/0.2; consumer-initiated duplicate bill request)"
_hits: dict[str, deque] = defaultdict(deque)
LIMIT, WINDOW = 5, 300  # 5 lookups per 5 minutes per client


class LookupError_(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def rate_limit(client_id: str):
    q = _hits[client_id]
    now = time.time()
    while q and now - q[0] > WINDOW:
        q.popleft()
    if len(q) >= LIMIT:
        raise LookupError_("rate_limited", "Too many bill lookups. Please wait a few minutes or upload a photo of your bill.")
    q.append(now)


def normalise_ref(ref: str) -> str:
    digits = re.sub(r"\D", "", ref or "")
    if len(digits) == 15:  # some bills print a trailing digit where others print a letter (e.g. "U"); the reference is the first 14
        digits = digits[:14]
    if len(digits) != 14:
        raise LookupError_("invalid_ref", "The reference number must have 14 digits (as printed on your bill, ignore letters like 'U').")
    return digits


def _hidden_fields(html: str) -> dict:
    fields = {}
    for tag in re.findall(r"<input\b[^>]*>", html, re.I):
        if not re.search(r'type\s*=\s*"hidden"', tag, re.I):
            continue
        name = re.search(r'name\s*=\s*"([^"]+)"', tag)
        value = re.search(r'value\s*=\s*"([^"]*)"', tag)
        if name:
            fields[name.group(1)] = value.group(1) if value else ""
    return fields


def _has_captcha(html: str) -> bool:
    # Only real CAPTCHA widgets count (the portal keeps an empty "CAPTCHA Section" comment when disabled)
    return bool(re.search(r'<img[^>]*captcha|name\s*=\s*"[^"]*captcha[^"]*"|g-recaptcha|cf-turnstile|hcaptcha', html, re.I))


def html_to_text(html: str) -> str:
    t = re.sub(r"<(script|style)\b.*?</\1>", " ", html, flags=re.S | re.I)
    t = re.sub(r"<br\s*/?>|</(tr|p|div|h\d)>", "\n", t, flags=re.I)
    t = re.sub(r"</t[dh]>", " | ", t, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"&nbsp;", " ", t)
    t = re.sub(r"[ \t]+", " ", t)
    return re.sub(r"\n\s*\n+", "\n", t).strip()


def fetch_bill_html(disco: str, ref: str, client: httpx.Client | None = None) -> str:
    disco = disco.upper()
    if disco == "K-ELECTRIC" or disco == "KE":
        raise LookupError_("unsupported", "K-Electric bills are not on the PITC portal. Please upload a photo of your bill.")
    path = DISCOS.get(disco)
    if not path:
        raise LookupError_("unsupported", f"Unknown company '{disco}'.")
    ref = normalise_ref(ref)
    own = client is None
    client = client or httpx.Client(timeout=30, follow_redirects=True, headers={"User-Agent": UA})
    try:
        url = f"{BASE}/{path}"
        page = client.get(url)
        page.raise_for_status()
        if _has_captcha(page.text):
            raise LookupError_("captcha", "The official portal is asking for a CAPTCHA, which Roshni does not bypass. "
                                          "Please upload a photo of your bill, or download it yourself from bill.pitc.com.pk.")
        form = _hidden_fields(page.text)
        form.update({"rbSearchByList": "refno", "searchTextBox": ref, "btnSearch": "Search"})
        res = client.post(url, data=form)
        res.raise_for_status()
        html = res.text
        if _has_captcha(html):
            raise LookupError_("captcha", "The official portal is asking for a CAPTCHA, which Roshni does not bypass. "
                                          "Please upload a photo of your bill instead.")
        text = html_to_text(html)
        if re.search(r"is invalid|not found|no record", text, re.I) and not re.search(r"units|kwh", text, re.I):
            raise LookupError_("not_found", f"The {disco} portal says this reference number is invalid. Check the number and company.")
        if re.search(r"anti-forgery|RequestVerificationToken", text, re.I):
            raise LookupError_("portal_error", "The official portal rejected the request. Please try again or upload a photo.")
        # Some portals return a page that links to the printable bill; follow one same-site link if present
        m = re.search(r'(?:href|src|action)\s*=\s*"([^"]*(?:general|bill)[^"]*refno=[^"]*)"', html, re.I)
        if m and not re.search(r"units?\s+consumed|current bill", text, re.I):
            nxt = httpx.URL(url).join(m.group(1).replace("&amp;", "&"))
            if nxt.host == "bill.pitc.com.pk":
                html = client.get(nxt).text
                text = html_to_text(html)
        if not re.search(r"unit|kwh|amount|payable", text, re.I):
            raise LookupError_("portal_error", "Could not read a bill from the official portal. Please upload a photo instead.")
        return text[:60000]
    except httpx.HTTPError:
        raise LookupError_("portal_down", "The official bill portal is not responding. Please try later or upload a photo.")
    finally:
        if own:
            client.close()
