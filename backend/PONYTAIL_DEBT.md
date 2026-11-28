# Backend extraction debt

Recorded: 2026-11-28. Paths are relative to backend/.

| Location | Deliberate limit | Trigger and upgrade |
| --- | --- | --- |
| app/content_extraction.py:84 | Per-process worker capacity; no shared per-client quota | Multiple API replicas or evidence that one client starves others: add a shared quota |
| app/extraction/safe_fetcher.py:105 | One validated public address, preferring IPv4 | A representative publisher fails because its first address is unavailable: add validated address fallback |
| app/extraction/article_text.py:99 | Static HTML extraction only | Representative publisher failures justify the cost: evaluate an approved renderer; never invent blocked content |

Markers: 3. Markers without a revisit trigger: 0.

Separate existing scope limit: the legacy GET /api/articles fetch path has not
been migrated to SafeFetcher. It requires its own Feed extraction hardening work.
