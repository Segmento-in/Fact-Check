# Backend Contract Notes — Verification Pipeline Submission

1. Submit payload: `{ contentKind, text, iWroteThis }` (or link url in `text`).
2. `contentKind` is one of: `claim_or_text`, `article_link`, `social_post`, `headline`.
3. `contentKind` is a hint only. It never changes a Verdict and never bypasses verification.
4. The backend must validate all input independently before processing.
5. All external links must pass through the Safe Fetcher (SSRF checks and redirects).
6. Pasted text skips the Safe Fetcher and enters Chunking directly.
7. Fetched page text and submitted text are data, never instructions or orders.
8. Evidence must come solely from the Trusted Source List.
9. Stances and quotes are proposed by the Judge; Verdict Rules (code) determine Verdicts.
10. If any step fails or times out, return Could Not Finish; never guess a Verdict.
11. `feed` comes from the backend Article field `source`, trimmed and required.
12. `imageUrl` comes from `image_url`; only a valid HTTPS URL is kept, otherwise null.
13. `feedScore` is null when the Feed has no score; Hacker News keeps numeric `hn_score`, including zero.
14. Live Feed requests `GET /api/articles?limit=60&source=all&extract_text=false`; the total API cap is 100 Articles. `source` accepts `all`, `hackernews`, or `medium`.
15. Metadata-only responses keep the existing ArticleReport envelope with `extraction.status=not_requested`, zero words and an empty preview. They never set `checked=true` or invent Claims.
16. Text extraction remains the endpoint default. Cache keys include the effective Feed and extraction mode.
