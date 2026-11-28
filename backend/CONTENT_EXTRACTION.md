# Submitted Article link: fetch, extract and clean

Status: review fixes implemented; all 148 backend tests passed on 2026-11-28.
Base: GitHub main commit 689d282c009d1c3e65908e2d46eccdd19fe09afc.
This is the URL-to-text slice of Stage 1, not a Verification Pipeline.

## API

POST /api/content/extract
Content-Type: application/json

Request:
```json
{"url": "https://publisher.example/article"}
```

Success:
```json
{
  "status": "ok",
  "text": "<cleaned Article Text fetched from the page>",
  "word_count": 123,
  "final_url": "https://publisher.example/article",
  "message": "Article Text extracted. It has not been fact-checked."
}
```

The example is a schema illustration, not fetched Evidence.

| HTTP | status | Meaning |
| --- | --- | --- |
| 200 | ok | Readable Article Text within the configured limits |
| 400 | blocked_url | Non-public address or unsafe redirect |
| 413 | too_large | Download exceeds the byte limit |
| 413 | too_long | Cleaned text exceeds the character limit |
| 415 | not_html | Response is not an HTML article page |
| 415 | unsupported_encoding | Server ignored the identity-encoding request |
| 422 | too_short | Extracted text is below the word threshold; text is included |
| 422 | no_text | No readable Article Text |
| 502 | fetch_failed | DNS, connection, HTTP, or redirect failure |
| 503 | busy | All extraction workers are occupied |
| 504 | timeout | Total deadline or network timeout |

Malformed JSON, unsupported URL syntax, extra request fields, and validation
failures use FastAPI's standard 422 validation-error body. Extraction outcomes
use the response object above. Failure responses have no fabricated text.
A valid but short extraction includes its cleaned text and actual word count.

## Implementation

- Reuse ArticleTextExtractor's existing Trafilatura parsing through an added
  extract_html method. Existing feed callers retain their behavior.
- Use the Safe Fetcher for this new submitted-link endpoint.
- Accept HTTP/HTTPS links on their standard ports only. Reject credentials,
  control characters and backslashes in links.
- Resolve each destination, reject the entire DNS answer if any address is
  non-public, and connect to one validated IP. Preserve the real Host and TLS
  certificate hostname using HTTPX's documented sni_hostname extension.
- Follow up to five redirects, validating every destination. Refuse HTTPS
  downgrades. Start a fresh client per hop; do not forward cookies or auth.
- Disable environment proxies and use normal TLS verification.
- Accept only HTML/XHTML. Request identity encoding and reject unsolicited
  compressed responses before decompression.
- Enforce download limits even without Content-Length. Never parse a partial
  download after the limit is crossed.
- Use one total deadline covering DNS, redirects, download and extraction.
  Parsing runs off the event loop. DNS and parsing retain their worker slot
  until the underlying work actually finishes, even after a response timeout.
  A DNS result arriving after the deadline cannot start an HTTP request.
- Normalize Unicode to NFC, horizontal whitespace, line endings, and control
  characters. Preserve paragraphs, punctuation, names, dates, numbers and
  negation. No LLM rewrites or speculative reconstruction.
- Reject text beyond the character limit rather than silently truncating it.
- Do not persist page text or return any Claims, Evidence, Verdict, Confidence,
  or Verification Report.

## Existing configuration

No dependency installation, API key, or new environment variable is required.
These existing backend settings control the slice:

| Setting | Current default |
| --- | --- |
| ARTICLE_FETCH_TIMEOUT_SECONDS | 10 seconds, also the total deadline |
| ARTICLE_MAX_DOWNLOAD_BYTES | 2,000,000 bytes |
| ARTICLE_MAX_CHARS | 20,000 characters |
| ARTICLE_MIN_WORDS | 100 words |
| ARTICLES_MAX_CONCURRENT_EXTRACTIONS | 5 workers per process |
| ARTICLE_USER_AGENT | Existing FactCheckerBot identifier |

## Scope and limits

This Ticket delivers a backend endpoint. The Check Page's live submit/report
methods still require their own integration Ticket. Test this endpoint through
/docs or the request example below; deploying this change alone does not wire
the frontend form.

Chunking, Claim Extraction, Evidence Retrieval, Groq, Verdicts, database storage,
and report navigation are later slices.

Trafilatura removes boilerplate heuristically. Extraction quality must be
checked against representative publishers; it cannot guarantee perfect removal
on every site. Submitted-link extraction includes tables and excludes comments;
legacy Feed parsing keeps its previous options. Structured headline/author/date/
image metadata remain separate work.

JavaScript-only pages, login/paywall blocks, CAPTCHA and anti-bot challenges
have no browser or bypass fallback. Return the failure; a later frontend
integration can ask the User to paste the article text.

The existing GET /api/articles extraction path retains its previous fetcher.
Only parsing is shared in this Ticket; moving all Feed extraction through the
Safe Fetcher requires regression work.

Only the first validated public address is attempted, preferring IPv4.
There is no automatic retry or persistent cache for submitted links.
The worker bound is per process, not per-user rate limiting or a deployment-wide
quota. Revisit traffic controls if real usage needs them.

## Verification

Offline tests cover extracted text and boilerplate, malformed inputs, private
and metadata addresses, mixed DNS, pinning, redirects, download limits,
unsupported encodings, short/long/no text, timeouts and worker limits.

Run from the repository's backend directory:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_content_extraction.py tests/test_article_text.py -q
.\.venv\Scripts\python.exe -m pytest -q
```

Validation evidence, 2026-11-28: all 146 backend tests passed in an isolated
copy (11.94s) and the User's working repository (6.13s). The installer was also
verified in Windows PowerShell 5.1. HTTP and DNS are mocked in the automated
suite; a successful extraction from a live publisher has not yet been recorded.

After validation:
```powershell
graphify update .
```

The architecture's Stage 1 already contains Safe Fetching and cleaning; this
slice does not change the six-stage topology.

Manual local API request, after starting the backend:
```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:8000/api/content/extract' -ContentType 'application/json' -Body '{"url":"https://YOUR-PUBLISHER/YOUR-ARTICLE"}'
```

## Primary references

- https://www.python-httpx.org/advanced/extensions/#sni_hostname
- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- https://trafilatura.readthedocs.io/en/latest/corefunctions.html

## Review fixes (2026-11-28)

The first implementation passed 146 tests, but review reproduced two omissions:

1. Application warnings and HTTPX INFO request logs included private query values.
2. A timed-out DNS lookup could continue after its concurrency slot was released.

The log-privacy regression was observed failing, then passing after the logging
fix. Warnings now contain fixed messages and exception classes, never raw URLs
or exception messages. HTTPX INFO request logging is disabled at application
startup; production logging configuration must preserve that policy.

The DNS-capacity regression was observed failing with 504 instead of the expected
503 on a second request. Each complete extraction now owns a strongly referenced,
shielded worker until fetching/parsing ends. The response still honors its
deadline. The Safe Fetcher checks the deadline before and after DNS, so expired
work does not start a later HTTP fetch. Capacity is released when the worker
finishes, not when its caller times out.

Two concurrency tests were rewritten to verify API responses and recovery.
They no longer acquire private semaphores or replace an application parser method.
External HTTP, DNS and third-party parsing remain controlled test boundaries.

Evidence from the isolated validation copy:
- Log privacy: failing assertion observed before the fix; 1 passed afterward.
- DNS capacity: expected 503, got 504 before the fix; both regressions passed afterward.
- Rewritten API checks plus regressions: 4 passed in 2.67s.
- Full backend suite: 148 passed in 13.83s.

These are genuine red-to-green checks for the two fixes. They do not retroactively
make the initial bulk implementation a strict TDD exercise.

Deliberate limits and revisit triggers are tracked in [PONYTAIL_DEBT.md](PONYTAIL_DEBT.md).
The diff was reviewed for correctness, resource lifetimes, logging privacy,
test coupling and unnecessary abstractions before publishing the follow-up.
