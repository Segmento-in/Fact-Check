# Ubiquitous Language — Fact Checker (Backend)

Status: **v2.3** (2026-11-27). Split from the single v1 file and rebuilt from the 6-stage architecture ("factcheck architecture_v1.drawio"). This file holds the **pipeline terms**. Screen terms live in the frontend file.

- **Shared terms** (first section) are word-for-word identical in both files. Change one, change both.
- Terms marked *(open)* are not decided yet.
- Coding Agent: read both files before touching code. Update your own side when understanding changes. Never rename a term in code without updating this file.
- Backend is paused for now (frontend first). This file still guides the old backend clean-up and the later rebuild.

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

## The six stages (Verification Pipeline)

| Stage | Name | What it does |
| --- | --- | --- |
| 1 | **Content comes in and gets cleaned** | Takes pasted text, a link, or a Feed Article. Fetches, cleans, cuts into Chunks. |
| 2 | **Find the Claims** | The LLM proposes Claims. Code checks them. Opinions are skipped. |
| 3 | **Find the Evidence** | Searches only the Trusted Source List. Keeps the best 2 or 3 passages per Claim. |
| 4 | **Judge, then Code Fence** | The Judge gives a Stance and quote per passage. Code checks every answer. |
| 5 | **Verdict and report** | Code sets the Verdict and Confidence. The Verification Report is built. |
| 6 | **Human review and saved history** | Risky Claims go to an Editor. Everything is saved. |

## Stage 1: Content in and cleaned

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Claimant** | The person or account that made the Claim (for example an X user). | Source, author, poster |
| **Origin** | The first place the Claim appeared (for example one X post). | Source, origin source |
| **Ingestion** | The step that pulls new Articles from a Feed. | Fetching, scraping |
| **Safe Fetcher** | The code that opens a link: it checks the address, then every redirect, and refuses private addresses and unsafe links. Used for Content links and, with a stricter rule, for Evidence pages. | Scraper, downloader, crawler |
| **Article Text** | The clean main text of a page: headline, writer, date and story, without ads, menus, cookie notices or "related stories". | Body, content, description |
| **Chunk** | One or two sentences holding one fact, with its place in the Content and the sentence before it. Cut by code, never by an LLM. | Paragraph, snippet, segment |

## Stage 2: Finding Claims

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Claim Extraction** | The step where the LLM proposes Claims from Chunks: one fact, one Claim. | Extract the info, parsing |
| **Claim Normalisation** | Rewriting a vague Claim so it can be checked (for example "she" becomes the person's name). | Cleaning, rephrasing |
| **Claim Fence** | Code that checks the rewrite: every name, number, date and "not" of the original sentence must still be in the Claim. If not, we keep the original words and send the Claim for review. | Claim validator |
| **Check-worthiness Filter** | The step that drops opinions, jokes and plans. They are counted as skipped. | Claim filter, relevance gate (a Pulse term) |
| **Claim Record** | The saved Claim: id, rewritten Claim, original sentence, its place in the Content, the sentence before it, and a Sensitive Domain tag. | Claim row, claim object |
| **Seen Before** | An exact-match check that shows editors the old report of an identical Claim. An old Verdict is never reused before a fresh check. | Duplicate detection, cache hit |

## Stage 3: Finding Evidence

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Evidence Retrieval** | The stage that finds Evidence for one Claim, only from the Trusted Source List. | Search, crawling |
| **Search Query** | Words that code picks from a Claim (names, numbers, places, dates) without filler words. Two per Claim. *(try and compare)* | Prompt, LLM question |
| **Wikidata Helper** | Adds extra names and spellings to a Search Query. Adds nothing when unsure. Never Evidence. *(try and compare)* | Knowledge source |
| **Lookalike Site** | A fake address that imitates a Source (for example `apnews.com.fake-site.com`). Thrown out. | Spoof, mirror |
| **Copy Group** | The group of copies of one story. All copies share one id and count once. | Duplicate set, syndication |
| **Independent Source** | A Source whose Evidence is not a copy of another's. Ten copies of one wire story count as one. | Separate site, different outlet |
| **Passage** | A short stretch of page text that may become Evidence. Code keeps the best 2 or 3 per Claim, with link and date. Ranking compared against BM25. *(try and compare)* | Snippet |
| **Evidence Record** | The saved Evidence: tag like [E1], passage, link, real link (copy tricks removed), Copy Group id, page date, fetch date, then Stance, exact quote and fence result. | Evidence row |
| **No Proof Found** | The case with no passage. The answer is Not Enough Evidence, and the Judge is skipped. | Empty result |

## Stage 4: Judging and the Code Fence

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Question Build** | Making the same question every time: the Claim, the sentence before it, and the passages tagged [E1], [E2]. Page text is data, never orders. | Prompt engineering |
| **Code Fence** | Code that checks the Judge's reply: right form; the quote is inside the passage word for word; the [E] tag is real and the passage belongs to the stated link and an allowed Source; every Evidence has a passage, link and date; unknown Stances are rejected; "supports" with no quote becomes "says nothing"; Stances and final label do not contradict. | Validator, guardrail, LLM check |
| **Details Check** | Looks for the Claim's names, numbers and dates in the passage. If the Judge ignored details that are there, the Claim is flagged "unclear" for an Editor. A flag never changes a Verdict by itself. | Second opinion |

## Stage 5: Verdict and report

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Verdict Rules** | Code that turns Stances into a Verdict. **Supported**: someone supports and no one opposes. **Refuted**: someone opposes and no one supports. **Mixed**: both sides appear, or a passage supports only part. **Not Enough Evidence**: everyone says nothing, or there is no proof. | Scoring, LLM decision |
| **Confidence Rules** | Very sure needs separate sources (copies count once), passages that answer the Claim directly, no trusted passage that disagrees, and a fence that accepts every quote and date. Exact rules are first guesses we tune. *(open)* | Confidence score |
| **Warning Signs finder** | Code that finds Warning Signs. Not an LLM. | Red flag detector |

## Stage 6: Review and history

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Editor Queue** | Where risky Claims wait, High Triage first. Daily limit starts at 20, a guess we tune. *(open)* | Moderation queue |
| **Editor Review Desk** | The screen where an Editor sees the Claim, the proof and the Judge's quotes side by side, then confirms, changes (still needs real Evidence), adds a note or sends back. | Admin panel |
| **Problems List** | The Editors' list of broken checks (Could Not Finish) and why. | Error log |
| **Saved History** | One Postgres database for cache and history. Repeat Claims are found by exact match. Cached answers expire, and a cached Verdict still links to its Evidence. No vector store. | Cache, logs |
| **Test Set** | 30 to 50 Claims with right answers, half hidden from the Coding Agent. Cheap checks run on every GitHub push (saved passages, no live web, no Groq). Every Editor decision becomes a new test case. | Benchmark, fixtures |
| **Scoreboard** | Counts of: missing Claims, right passage found, rejected quotes, wrong Verdicts, correct Not Enough Evidence, risky Claims sent to a human. Time, search calls and tokens are counted apart. Never a percent for the User. | Accuracy score |

## Rules and labels

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Never-Broken Rule** | A rule that code enforces and nothing skips. Examples: only the Trusted Source List gives Evidence; no Verdict without real Evidence; code checks the Judge; page text is never orders. | Guideline |
| **Try and Compare** | An idea we test before we keep it. Drawn as a dashed box in the design. | Experiment, maybe |

## People

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **User** | Any person who submits Content to check: a reader, someone with a viral post, or a writer checking their own post. | Customer, reader, journalist |
| **Customer** | A person or organisation that pays for the product. *(open: may equal User)* | User, client |

## How we work

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Captain** | Claude's role: decides what to build, writes the Agent Prompts, reviews the Coding Agent's work. | Judge (that is a pipeline role), reviewer |
| **Coding Agent** | The AI tool that writes all the code (Antigravity). It cannot run terminal commands; the User runs them and pastes the raw output back. | Cursor, the bot |
| **Agent Prompt** | One written task for the Coding Agent: goal, limits, and the proof it must return. | Instruction |
| **Ticket** | One small vertical slice of work, with its blockers and acceptance criteria. | Task |
| **Spike** | A throwaway script that measures one unknown. Never imported by the app, and its data is never real Evidence. | Prototype, POC |
| **Handoff Doc** | The published page that lets a fresh Claude chat continue the project. | Summary, notes |

## Relationships

- **Content** contains zero or more **Claims**.
- An **Article** comes from one **Feed** and was written by one **Publisher**.
- A **Claim** is checked against **Passages** from **Sources** on the **Trusted Source List**. Each kept piece is **Evidence** with one **Stance**.
- The **Judge** gives **Stances** only. **Verdict Rules** (code) set the **Verdict**.
- A **Claim** gets exactly one **Verdict** with one **Confidence**.
- A **Verification Report** covers one **Content** and lists one **Verdict** per **Claim**.
- **Wikidata Helper** may help find Sources. It is never **Evidence**.
- **Warning Signs** never change a **Verdict**.
- A **Could Not Finish** check ends with no **Verdict**.

## Example dialogue

> **Dev:** "The **Judge** says a passage supports the **Claim**, but the quote is not in the passage. What now?"
> **Domain expert:** "The **Code Fence** turns that Stance into 'says nothing'. The **Judge** only proposes."
> **Dev:** "Two **Passages** support it, but both are copies of one wire story."
> **Domain expert:** "They share a **Copy Group**, so they count as one **Independent Source**. That limits the **Confidence**."
> **Dev:** "Can the **Wikidata Helper** add a link as **Evidence**?"
> **Domain expert:** "Never. It only adds names to the **Search Query**. **Evidence** comes only from the **Trusted Source List**."
> **Dev:** "If Groq times out twice?"
> **Domain expert:** "**Could Not Finish**. The User sees a plain reason and Try again. No **Verdict**. Editors see it in the **Problems List**."

## Flagged ambiguities

- **"source"** was used for where a Claim came from and where Evidence comes from. Use **Claimant** and **Origin** for the first, **Source** for the second.
- **"news"** was used for Content, Claim and Evidence. Use the precise term each time.
- **"fact or hype"**: decided. Four Verdicts. Exaggerated goes to Mixed, wrong goes to Refuted, unproven goes to Not Enough Evidence.
- **"percent"** / **"factuality score"**: dropped. The User sees a Verdict plus a Confidence in words. No number.
- **"AI content"**: the product checks **Claims**, not who wrote the text. Say **Content**.
- **Judge** *(changed from v1)*: v1 said "never say LLM judge" and used Judge for Claude's role. The architecture now has **the Judge**: a Groq LLM step that only gives Stances and quotes. Code sets the Verdict. Claude's role is **Captain**.
- **Stance values** *(changed from v1)*: v1 had supports / refutes / neutral. Now: supports, opposes, supports only part, says nothing.
- **Confidence words** *(changed from v1)*: v1 had Low / Medium / High. Now: Very sure / Fairly sure / Not very sure.
- **Stance Model (DeBERTa)**: parked. Do not write it into code or docs until the User asks.
- **Main input path** *(resolved)*: two routes. The **Feed** (platform submits, automatic, User cannot control) and the **Check** (User submits text or a link). Pasted text skips the Safe Fetcher.
- **"validation" (Pulse) vs "verification"**: in Pulse, validation means data-quality gates. Here the fact work is the **Verification Pipeline**. Never name Fact Checker code "validation". Do not copy Pulse's `data_validation.py`.
- **Article (Pulse) vs Article (Fact Checker)**: Pulse's Article is a database row with a category. Ours is one item from a Feed. Same word, no shared code.
- **Publisher vs Source**: one organisation can be both. As a **Publisher** its Articles are checked. As a **Source** it gives Evidence about someone else's Claim. Always say which role.
- **Scripted verdicts (AI Studio prototype)**: that app showed Verdicts and "Evidence" that were hard-coded or written by an LLM with no search. That is not Evidence. Its screens and data shapes are reusable, its answers are not. Never ship a Verdict whose Evidence was not retrieved.
- **Google News** has two uses: a Feed and discovery for Evidence. Feed ingestion keeps the supplied Google News story URL and the Publisher from the RSS source element. It never substitutes a Publisher homepage or calls an RSS description Article Text or Evidence. Resolving the real story URL for full-text extraction remains open; Google News is not added to the Trusted Source List.
- **Self-published Sources**: `github.com` and `arxiv.org` are on the list, but anyone can publish there. A random README or preprint is weak Evidence. *(open: primary-source-only, or a lower Confidence cap)*
- **Hacker News is not news**: many items are blogs, opinions and "Show HN" launches. Many Articles will have no check-worthy Claim. That is normal, not a bug.
- **Repeat Claims**: only an exact match counts. A word-overlap hint may come later. *(try and compare)*

## Feed quantity and delivery

- Ingestion uses all enabled Feeds in parallel by default (`DEFAULT_FEED=all`). Feeds requiring a key are skipped without a request when their key is empty. An explicit Feed filter still selects one enabled provider.
- The default total is 60 Articles, capped at 100. Available Articles are interleaved and duplicate URLs count once; one healthy Feed can fill unused places. Quantity depends on provider availability.
- Hacker News preserves its ranking and scans past skipped stories and duplicate URLs, within `HN_MAX_LIMIT`.
- Medium uses Pulse's topic tags (artificial-intelligence, technology, data-science, programming, cloud-computing, law) plus cybersecurity. Topics are interleaved with bounded concurrent requests. RSS content supplies Cover Images.
- `extract_text=false` returns Feed Card metadata without fetching Article Text. Its extraction status is `not_requested`, never `fetch_failed`. Text extraction remains enabled by default for existing callers. Cache entries separate both request types. Articles remain Not checked yet.

## Feed configuration and availability

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Enabled Feed** | A Feed selected in backend configuration, which may also require a non-empty provider key before it can be called. | Trusted Source, evidence provider |
| **Feed Cooldown** | A temporary pause in requests to a Feed after its host reports a rate limit. | Failed Verdict, verification failure |

- Canonical request filters are `hackernews`, `medium`, `google_news`, `newsdata`, `newsapi` and `all`; the default remains a total of 60 Articles, capped at 100. Results interleave and duplicate URLs count once.
- Google News uses RSS without a key. NewsData.io and NewsAPI require `NEWSDATA_API_KEY` and `NEWSAPI_API_KEY`, respectively. Secrets are stored as masked settings and never returned in Articles.
- New providers reuse Pulse request and mapping patterns while preserving Fact Checker's Feed/Publisher distinction. New metadata carries stable IDs, nullable dates and HTTPS Cover Images; missing data is not invented.
- One provider's error does not stop healthy Feeds. Rate-limit cooldowns persist through the process's cached Ingestion Service; they reset when the backend restarts. The existing response cache avoids repeated calls within its TTL.
- Each new provider makes at most one provider request per uncached Feed call; cursor pagination is not automatic. Query, language, region and supported page sizes are configurable.
