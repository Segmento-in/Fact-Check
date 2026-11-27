# Additional Feed providers

Implemented on 2026-11-27. These adapters extend the current ingestion seam;
they do not import Pulse's database, validation gates or verification answers.

| Feed | Pulse implementation reused as the reference | Fact Checker adaptation |
| --- | --- | --- |
| Google News | `app/services/news_providers.py:GoogleNewsRSSProvider`, `app/services/rss_parser.py:RSSParser` | Same RSS search parameters and media/enclosure/HTML image fallback. Parse XML with ElementTree; keep the RSS Publisher separate from the Feed. |
| NewsAPI.org | `app/services/news_providers.py:NewsAPIProvider` | Same `/v2/everything`, language, newest-first ordering and article fields. Use documented header authentication; store the response's source name as Publisher. |
| NewsData.io | `app/services/news_providers.py:NewsDataProvider` | Same bounded single-request ingestion and key setting. Update Pulse's legacy URL and flat fields to documented `/api/2/news`, `url`, `published_at`, `media.image_url` and `source.name`. |

Pulse's broad `magazines` topic previously used `technology`. This is the
configurable default query here. The full category taxonomy and hourly query
rotation depend on Pulse's `data_validation.py`, which is deliberately outside
Fact Checker's domain. Existing Hacker News and Medium coverage stays intact.

## Agreed behavior

- All enabled providers run alongside each other, rather than using key-based
  providers only as fallback. Missing keys result in zero provider requests.
- Results are interleaved and deduplicated by URL. The total remains 60 by
  default, with an API maximum of 100. Actual counts depend on provider results.
- Each new provider makes at most one request per uncached call. Defaults are
  20 NewsAPI Articles and 10 NewsData.io Articles per request. Increase supported
  page-size settings only to values your provider plan allows.
- A 429 starts a bounded cooldown based on Pulse's backoff approach and numeric
  Retry-After when supplied. A cached service retains cooldowns across requests.
- Feed Card responses still use `extract_text=false`, `not_requested` extraction
  state and `checked=false`. No provider's sentiment, ranking or AI summaries
  become verification results.
- Article `publisher` is optional and additive. `source` remains the Feed name.
  The frontend prefers the Publisher label, retaining its existing fallbacks.
- Missing or malformed dates remain null. Invalid images use the existing
  Cover Tile. IDs are deterministic from the actual Article URL.

Google RSS supplies a Google story URL. This implementation preserves it and
does not pretend the Publisher homepage is the Article. Full-text extraction
requires resolving that story URL separately; RSS descriptions are not Evidence.
Google News is not added to the Trusted Source List.

## Environment files

`backend/.env` and `backend/.env.example` contain blank `NEWSAPI_API_KEY` and
`NEWSDATA_API_KEY` entries. Google RSS needs no key. Enter keys locally, then
restart the backend. Never commit the `.env` file. Keys are masked in settings
representations and are not part of the Article response.

`frontend/.env` and `frontend/.env.example` contain only:

```dotenv
NEXT_PUBLIC_DATA_SOURCE=live
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Provider keys never belong in NEXT_PUBLIC variables or browser code. A browser
build must be restarted/rebuilt after changing its public settings. Live mode's
Submit/Report operations remain pending the Verification Pipeline.

To pause a Feed, remove its ID from the JSON `ENABLED_FEEDS` list in the backend
environment file. The known IDs are `hackernews`, `medium`, `google_news`,
`newsdata` and `newsapi`. An explicit disabled Feed returns no Articles.

The installer creates environment files only if absent. It never reads, hashes,
backs up or replaces an existing `.env` file. Existing env files can be updated
manually using the provided examples. No original secret environment file was
read during implementation; tests use dummy credentials and mocked HTTP.

Application error logs omit exception text and raw provider response bodies,
which can contain credentials. NewsData authenticates via its documented query
parameter; deployments that log complete outbound URLs must redact credentials.

## Provider documentation checked

- [NewsData.io v2 News endpoint and response fields](https://newsdata.io/documentation/news-api)
- [NewsData.io response object](https://newsdata.io/documentation/response-object)
- [NewsAPI Everything](https://newsapi.org/docs/endpoints/everything)
- [NewsAPI header authentication](https://newsapi.org/docs/authentication)

These are Feed integrations, not evidence retrieval. Live credential-backed
requests need to be verified after the user adds keys; no paid quota was used
during development.
