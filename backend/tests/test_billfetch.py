import httpx
import pytest

from app import billfetch

FORM = '''<form method="post" action="./lescobill" id="SubmitForm">
<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="VS" />
<input name="__RequestVerificationToken" type="hidden" value="TOKEN" />
<input name="searchTextBox" type="text" maxlength="14" />
<!-- CAPTCHA Section -->
</form>'''
BILL = "<table><tr><td>UNITS CONSUMED</td><td>520</td></tr><tr><td>PAYABLE WITHIN DUE DATE</td><td>30,678</td></tr></table>"


def client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler), base_url=billfetch.BASE)


def test_hidden_fields_any_attribute_order():
    f = billfetch._hidden_fields(FORM)
    assert f == {"__VIEWSTATE": "VS", "__RequestVerificationToken": "TOKEN"}


def test_empty_captcha_comment_is_not_a_captcha():
    assert not billfetch._has_captcha(FORM)
    assert billfetch._has_captcha('<img class="captcha-img" src="/captcha.ashx">')
    assert billfetch._has_captcha('<div class="g-recaptcha" data-sitekey="x"></div>')


def test_successful_lookup_posts_tokens_and_reference():
    seen = {}

    def handler(req: httpx.Request):
        if req.method == "GET":
            return httpx.Response(200, text=FORM)
        seen["body"] = req.content.decode()
        return httpx.Response(200, text=BILL)

    text = billfetch.fetch_bill_html("lesco", "12 11234 5678901 U", client=client(handler))
    assert "UNITS CONSUMED" in text and "520" in text
    assert "searchTextBox=12112345678901" in seen["body"] and "__RequestVerificationToken=TOKEN" in seen["body"]


def test_captcha_stops_without_submitting():
    posted = []

    def handler(req):
        if req.method == "POST":
            posted.append(1)
        return httpx.Response(200, text=FORM.replace("<!-- CAPTCHA Section -->", '<img src="/CaptchaImage.axd">'))

    with pytest.raises(billfetch.LookupError_) as e:
        billfetch.fetch_bill_html("IESCO", "01234567890123", client=client(handler))
    assert e.value.code == "captcha" and not posted


def test_invalid_reference_and_unsupported():
    with pytest.raises(billfetch.LookupError_) as e:
        billfetch.normalise_ref("123")
    assert e.value.code == "invalid_ref"
    with pytest.raises(billfetch.LookupError_) as e:
        billfetch.fetch_bill_html("K-Electric", "01234567890123")
    assert e.value.code == "unsupported"

    def handler(req):
        return httpx.Response(200, text=FORM if req.method == "GET" else "Given Ref/App No is invalid")
    with pytest.raises(billfetch.LookupError_) as e:
        billfetch.fetch_bill_html("LESCO", "01234567890123", client=client(handler))
    assert e.value.code == "not_found"


def test_rate_limit():
    for _ in range(billfetch.LIMIT):
        billfetch.rate_limit("test-client")
    with pytest.raises(billfetch.LookupError_) as e:
        billfetch.rate_limit("test-client")
    assert e.value.code == "rate_limited"
