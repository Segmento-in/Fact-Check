# Ubiquitous Language — Fact Checker (Frontend)

Status: **v2.7** (2026-11-27). Split from the single v1 file. This file holds the **screens and what the User sees**. Pipeline terms live in the backend file.

- **Shared terms** (first section) are word-for-word identical in both files. Change one, change both.
- Terms marked *(open)* are not decided yet.
- Coding Agent: read both files before touching code. Update your own side when understanding changes. Never rename a term in code without updating this file.

## Shared terms (identical in both files)

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Content** | Any text, post, article or link that enters the system to be checked, either submitted by a User or delivered by a Feed. | News, post, info, AI content |
| **Content Kind** | What sort of Content the User says they are giving: Claim or text, Article link, Social post, or Headline. A hint that helps the pipeline. It never changes a Verdict, and the pipeline still checks the Content itself. | Tab, Mode, Tool, Type |
| **Claim** | One single, checkable statement about the world, pulled out of Content. | Fact, news, statement, info |
| **Source** | A site on the Trusted Source List that can give Evidence. | Blogs, news, website |
| **Trusted Source List** | The hand-picked list of 8 Sources allowed to give Evidence. Nothing else ever counts as proof. | Whitelist, allowlist, source pool |
| **Evidence** | A passage fetched from a real page of a Source, kept with its link, the page date and the date we fetched it. Never hand-written, seeded or recalled from an LLM's memory. | Proof (code and data), data, reference, snippet from memory |
| **Stance** | How one piece of Evidence relates to a Claim: supports, opposes, supports only part, or says nothing. | Side, direction, refutes, neutral |
| **Judge** | The Groq LLM step that gives a Stance and an exact quote for each passage. It never picks the Verdict. | LLM judge, verdict model, validator |
| **Verdict** | The final label on a Claim, set by our code from the Stances. Four kinds: Supported, Refuted, Mixed, Not Enough Evidence. The User sees plain words, never these names. | Result, answer, fact-or-hype |
| **Confidence** | How sure we are about a Verdict, shown in words only: Very sure, Fairly sure, Not very sure. | Accuracy, certainty, sureness, percent, Low/Medium/High, "highly sure" |
| **Verification Report** | The result for one Content: its Claims, each with a Verdict, a Confidence and its proof. | Output, result page, analysis |
| **Warning Sign** | A pattern found by code (urgency, SHOUTING, a big number with no source, clickbait). It is not a Verdict. | Red flag, risk score, manipulation score |
| **Sensitive Domain** | A subject area (health, elections, money, safety) where a wrong Verdict can cause serious harm. | Sensitive area, risky topic |
| **Feed** | A stream of Articles delivered by Hacker News, Medium, Google News, NewsData.io or NewsAPI; it never supplies Evidence merely by delivering an Article. | News platform, RSS, API |
| **Article** | One item that arrives from a Feed. It is a kind of Content. | News, story, post |
| **Publisher** | The organisation that published an Article, kept separate from the Feed that delivered it. | Source, outlet, aggregator |
| **Triage** | An internal priority (High, Medium, Low) that sorts the editor queue. The User never sees it. | Risk score, severity |
| **Editor** | A person who reviews risky Claims. After they confirm or change one, the User sees "checked by a person". | Admin, moderator |
| **Could Not Finish** | A check that stopped. The User sees a plain reason and a Try again button. Never a Verdict. | Error, failed verdict |

## Screens (routes)

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Content Kind Selector** | The group of four options above the Check Box where the User picks a Content Kind. Not tabs: every kind uses the same pipeline and shows the same Report. | Tabs, Tool picker |
| **Check Page** | The `/` screen: a Content Kind Selector, one box for text or a link, the "I wrote this" switch and one button. | Home, chatbot, analyzer |
| **Report Dashboard** | The `/report/[id]` screen that shows one Verification Report. Its own route, never shown below the Check Box. Try again re-loads the report. | Result page, results panel |
| **Live Feed Page** | The `/feed` screen: Articles the platform checks by itself. The User only reads and cannot control it. | News page, ticker |
| **Feed Card** | One Article on the Live Feed Page: a Cover Image or Cover Tile, a Feed Pill and date, a headline, a Feed Card State area pinned at the bottom, and a byline with Publisher and Feed Score when available. Cards in a row have equal height. | Article tile, news card |
| **Feed Score** | The Feed's own popularity number for an Article, shown only for a Feed that has one. It says nothing about truth. | Score (alone), truth score, rank |
| **Cover Image** | The decorative image at the top of a Feed Card. Live image links use HTTPS only. It is never Evidence. | Thumbnail, proof image |
| **Cover Tile** | The icon-only replacement for a missing or broken Cover Image. It has no text and is hidden from assistive technology. | Placeholder image |
| **Feed Pill** | The pill on a Feed Card that shows the Feed name. It is not the Publisher and not a category. | Publisher badge, category tag |
| **Claim Tally** | On a Feed Card: how many Claims got each Verdict, shown as small Verdict Chips with counts. Never one Verdict for the whole Article. | Article verdict, overall verdict, score |
| **Check Box** | The one input on the Check Page. It takes pasted text or a link, as the Content Kind says. | Chat box, textarea, search bar |
| **"I wrote this" Switch** | Tells the app the User wrote the Content, so the Report adds a Fix List. | Author mode |
| **Fix List** | In a Report on the User's own writing: the places where the writing disagrees with Evidence. | Corrections, suggestions |

## Report parts

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Count Tiles** | The top row of the Report Dashboard: the number of Claims per Verdict, plus skipped. | Stats, metrics, KPIs |
| **Claim List** | The left column: one row per Claim with its Verdict Chip. | Claims table, fact check points |
| **Selected Claim** | The Claim open in the centre column, with its Verdict Chip, Confidence Line and Proof Cards. | Active claim |
| **Verdict Chip** | A small label showing one Verdict as an icon plus words. Never colour alone. | Badge, tag, status pill |
| **Confidence Line** | The words Very sure / Fairly sure / Not very sure shown beside a Verdict Chip. | Confidence bar, sureness tag, percent |
| **Proof Card** | One piece of Evidence on screen: exact quote, link, page date, Stance. | Evidence card, source card, snippet |
| **Proof Groups** | The two groups of Proof Cards: Supports (supports and supports only part) and Challenges (opposes). Says nothing is a count only. | Pros and cons, credibility factors |
| **Next Steps** | The "what to do next" text in a Report. | Recommendation |
| **How We Checked** | One line saying how the check was done. | Methodology, analysis |
| **Checked by a Person** | A label shown after an Editor confirms or changes a Claim. | Verified by human, moderated |
| **Skipped Claims** | Opinions, jokes and plans the filter dropped, shown only as a count. | Ignored, filtered out |

## Screen states

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Loading Skeleton** | Grey shapes in the final layout's shape, shown while a check or the Feed loads. | Spinner |
| **Empty State** | A screen with nothing yet, with a clear next action. | Blank page, no data |
| **Could-Not-Finish Screen** | The screen for a Could Not Finish: a plain reason and a Try again button. | Error page |
| **Feed Card State** | What a Feed Card says about its check: Not checked yet, Checking, a Claim Tally, No checkable claims, or Could Not Finish. A Feed Card State other than a Claim Tally uses a neutral label, never a Verdict Chip. | Status |

## What the User sees for each Verdict

| Verdict (internal name) | Label shown to the User | Colour | Icon (lucide-react) |
| --- | --- | --- | --- |
| **Supported** | Verified with evidence | Green (added to the palette) | CircleCheck |
| **Refuted** | Evidence says this is false | Ruby `#ea2261` | CircleX |
| **Mixed** | Evidence shows only part of this is true | Lemon `#9b6829` | TriangleAlert |
| **Not Enough Evidence** | Not enough evidence yet | Ink-mute grey `#64748d` | CircleHelp |

Rules: say "false", never "fake". Colour is never the only signal: always icon plus words. Verdict colours are used only on Verdict Chips.

## Data in the UI

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Sample Data** | Hand-made reports and Feed Articles used while the backend is aside. Marked as sample in code, never presented as real Evidence. | Mock, fake, seeded evidence |
| **Data Source** | The one seam through which screens get Reports and Feed Articles: Sample Data now, the real API later. A single setting picks Sample Data (default) or live. No button on screen and no silent fallback. Live mode now works for the Feed (connecting to the backend Articles endpoint). Submit and Report in live mode remain pending the backend Verification Pipeline. | API layer, service |

## Look

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Palette** | The light colours of the Stripi-style design file: indigo `#533afd`, navy ink `#0d253d`, white and soft grey canvas, hairline `#e3e8ee`. | Theme, colour scheme |
| **Mesh** | The soft pastel gradient behind the Check Box. Used on the Check Page only. | Hero gradient, background |

## How we work

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Captain** | Claude's role: decides what to build, writes the Agent Prompts, reviews the Coding Agent's work. | Judge (that is a pipeline role), reviewer |
| **Coding Agent** | The AI tool that writes all the code (Antigravity). It cannot run terminal commands; the User runs them and pastes the raw output back. | Cursor, the bot |
| **Agent Prompt** | One written task for the Coding Agent: goal, limits, and the proof it must return. | Instruction |
| **Ticket** | One small vertical slice of work, with its blockers and acceptance criteria. | Task |

## Relationships

- The app has two routes for getting Content in: the **Check Page** (the User submits) and the **Live Feed Page** (the platform submits).
- The Check Page sends a Content Kind with the Content. The Content Kind is a hint, never a Verdict.
- A **Report Dashboard** shows exactly one **Verification Report**.
- A **Verification Report** lists one **Verdict** per **Claim**, never one per Article.
- A **Claim** shows one **Verdict Chip**, one **Confidence Line** and zero or more **Proof Cards**, in two **Proof Groups**.
- A **Feed Card** opens the same **Report Dashboard** that the Check Page opens.
- A **Feed Card** shows a **Claim Tally**, never one **Verdict** for the **Article**.
- **Warning Signs** are shown beside a Report. They never change a **Verdict**.
- **Triage** is never shown to the User.

## Example dialogue

> **Dev:** "The User pastes a link on the **Check Page**. Where does the result appear?"
> **Domain expert:** "On the **Report Dashboard**, its own route. Never under the **Check Box**."
> **Dev:** "The article has three **Claims**. Which **Verdict Chip** do I show at the top?"
> **Domain expert:** "None. The **Count Tiles** show how many **Claims** got each **Verdict**, and the **Claim List** shows one **Verdict Chip** per **Claim**."
> **Dev:** "On a **Feed Card** I see 'Score 642'. Is that how true it is?"
> **Domain expert:** "No. That is the **Feed Score**, how popular the **Article** is. It says nothing about truth. Keep it away from the **Verdict Chip**."
> **Dev:** "And while the backend is aside?"
> **Domain expert:** "We read **Sample Data** through the **Data Source**. Every sample is marked, so nobody mistakes it for real **Evidence**."

## Flagged ambiguities

- Feed Pill is the Feed name, not the Publisher and not a category.

- **Content Kind Selector vs tabs**: the old "five tabs" idea is replaced by the Content Kind Selector with four kinds; AI Text Detector and Compare Stories stay dropped (opinions without Evidence).
- **"Article link" vs Article**: "Article link" is a Content Kind label for a link to a news page. The Content is not an Article (an Article is a Feed item).
- **"result page" / "results"**: use **Verification Report** for the content and **Report Dashboard** for the screen.
- **"Score"**: the Hacker News number on a Feed Card is the **Feed Score**. Never call it a truth score, never put it next to a Verdict as if related. The old prototype printed "Score 642 (Rank 0.006)" beside the Verdict; that confusion is why.
- **"sureness" / "highly sure"** (old prototype): use **Confidence** with Very sure / Fairly sure / Not very sure.
- **Metrics from the TruthLens inspiration** (percent confidence, manipulation 1/10, virality risk, severity, bias indicators, motive, target audience, logical fallacies, alternative perspectives): dropped. They are LLM opinions with no Evidence. **Warning Signs** found by code replace the useful part.
- **"fake"**: say "false". "Fake" claims someone lied on purpose; we only know a Claim is wrong.
- **"proof"**: allowed in words the User reads (Proof Card, "show the proof"). In code and data, say **Evidence**.
- **Feed vs Live Feed Page**: **Feed** is the stream (backend). **Live Feed Page** is the screen.
- **Judge**: in v1 this meant Claude's role. Now **Judge** is the Groq LLM step. Claude's role is **Captain**.
- **Verdict on a Feed Card**: decided 2026-11-20. A Verdict belongs to a Claim, so a Feed Card shows a **Claim Tally**.
- **Claim Record / Evidence Record / Copy Group**: defined in the backend UL. The frontend contract types use the same names.
- **Icon library** *(open, default lucide-react per the PRD)*: one family only.

## Live Feed quantity

- Live mode requests up to 60 Articles with `source=all` and `extract_text=false`, so all configured Feeds are requested even when the backend default selects one.
- Feed Cards retain the current Cover Image or Cover Tile, Feed Pill, Publisher, date, Feed Score and Feed Card State. An Article awaiting verification stays Not checked yet.
- The request timeout is 30 seconds. Sample Data stays at eight Articles; use `NEXT_PUBLIC_DATA_SOURCE=live` to load real Articles.

## Additional Feeds

- Google News, NewsData.io and NewsAPI use the same Feed Cards as Hacker News and Medium. `source` remains the Feed name; optional `publisher` holds the Publisher label. The frontend prefers that label and retains its existing domain fallback.
- Only Hacker News has a Feed Score. Publisher popularity, provider rankings, sentiment and API-generated summaries never become Verdicts, Confidence or Evidence.
- The frontend environment file contains public Data Source and API URL settings only. Provider credentials belong only in the backend environment file.
