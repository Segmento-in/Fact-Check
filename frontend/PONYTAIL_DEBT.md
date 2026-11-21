# Ponytail Debt Ledger — Frontend

Tracked deferrals and intentional simplifications across `frontend/src`.

## Ledger

### `src/lib/data-source/sample.ts`
- `src/lib/data-source/sample.ts:23` — The sample submit ignores input text and picks by the switch only.
  - **ceiling**: Selects between `sample-i-wrote-this` and `sample-all-verdicts` solely via `iWroteThis`.
  - **upgrade**: When the real API replaces it.

### `src/components/NavBar.tsx`
- `src/components/NavBar.tsx:9` — Static pathname comparison is minimal and fast.
  - **ceiling**: Direct string equality check for `"/"` and `"/feed"`.
  - **upgrade**: If nested `/feed/[id]` or query params are introduced.

### `src/lib/data-source/live.ts`
- `src/lib/data-source/live.ts:12` — Submit check not available in live mode yet.
  - **ceiling**: Live `submitCheck` throws error rather than connecting to ingestion pipeline.
  - **upgrade**: When the backend pipeline exists.
- `src/lib/data-source/live.ts:17` — Get report not available in live mode yet.
  - **ceiling**: Live `getReport` throws error rather than querying database report storage.
  - **upgrade**: When the backend pipeline exists.

---

**Summary**: 4 markers tracked across 3 files. 0 markers lack a trigger.

