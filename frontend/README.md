# Fact Checker Frontend

- Install: `npm install`
- Run: `npm run dev` (http://localhost:3000)
- Test: `npm test` (unit) | `npm run test:e2e` (Playwright)
- Build & Lint: `npm run build` | `npm run lint`
- Settings:
  - `NEXT_PUBLIC_DATA_SOURCE`: `sample` (default) or `live`
  - `NEXT_PUBLIC_API_BASE_URL`: backend API URL (default `http://localhost:8000`)
- Live mode run: `$env:NEXT_PUBLIC_DATA_SOURCE="live"; npm run dev`
