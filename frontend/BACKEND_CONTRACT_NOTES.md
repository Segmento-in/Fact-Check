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

