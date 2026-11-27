# Ponytail Debt Ledger — Frontend

Tracked deferrals and intentional simplifications across `frontend/src`.

| File | Shortcut | Limit | Trigger |
| --- | --- | --- | --- |
| `src/components/NavBar.tsx` | Static pathname equality check | Only checks exact `"/"` and `"/feed"` paths | If nested `/feed/[id]` or query params are introduced |
| `src/lib/data-source/sample.ts` | Sample submit ignores input text and content kind | Selects between `sample-i-wrote-this` and `sample-all-verdicts` solely via `iWroteThis` switch | When the real API replaces it |
| `src/lib/data-source/live.ts` | Live `submitCheck` throws error | Submissions are not sent to any backend pipeline | When the backend pipeline exists |
| `src/lib/data-source/live.ts` | Live `getReport` throws error | Reports are not queried from any database or backend | When the backend pipeline exists |
| `src/app/feed/page.tsx` | Hotlinked Cover Images | The Publisher or Feed host sees the reader's IP | Before any public deploy: proxy or cache images |
