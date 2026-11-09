import os
import sys
import time
import json
import asyncio
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import httpx

from app.config import settings
from app.extraction.article_text import ArticleTextExtractor
from app.feeds.hackernews import HackerNewsFeed
from app.trusted_sources import TRUSTED_SOURCES, is_trusted_domain

# Google News RSS endpoint
GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search"

# GDELT DOC API endpoint
GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

# Fixed test queries
FIXED_QUERIES = [
    "NIST post-quantum cryptography standards",
    "US midterm elections 2026 House results",
    "FactCheck.org viral claim",
    "Linux kernel Rust drivers",
    "MiniCheck fact-checking model",
    "Reuters Commerce Department export rules chips",
    "claude code security leak github",
]


async def fetch_hn_queries() -> List[str]:
    """Fetch top 5 HN story titles, strip Show/Ask prefix, and truncate to 12 words."""
    queries = []
    try:
        feed = HackerNewsFeed(settings=settings)
        articles = await feed.fetch_articles(limit=5)
        for art in articles:
            title = art.title.strip()
            # Remove leading Show HN: or Ask HN:
            for prefix in ("show hn:", "show hn -", "ask hn:", "ask hn -", "tell hn:", "tell hn -"):
                if title.lower().startswith(prefix):
                    title = title[len(prefix):].strip()
                    break
            words = title.split()
            truncated = " ".join(words[:12])
            if truncated:
                queries.append(truncated)
    except Exception as e:
        print(f"Warning: Failed to fetch Hacker News feed: {e}")

    # Fallback if HN feed is offline or returned fewer than 5
    fallback_queries = [
        "OpenAI releases new reasoning model update",
        "Python steering council discusses GIL removal",
        "PostgreSQL 17 performance improvements benchmark",
        "CrowdStrike update causes Windows systems outage",
        "DeepSeek open weights model architecture details",
    ]
    idx = 0
    while len(queries) < 5 and idx < len(fallback_queries):
        queries.append(fallback_queries[idx])
        idx += 1

    return queries[:5]


def build_google_news_query(query_text: str) -> str:
    """Build query with site: restrictions across all 8 trusted domains."""
    site_filter = " OR ".join(f"site:{src.domain}" for src in TRUSTED_SOURCES)
    return f"{query_text} ({site_filter})"


def build_gdelt_query(query_text: str) -> str:
    """Build query with domain: restrictions across all 8 trusted domains."""
    domain_filter = " OR ".join(f"domain:{src.domain}" for src in TRUSTED_SOURCES)
    return f"{query_text} ({domain_filter})"


async def resolve_and_extract(
    url: str,
    extractor: ArticleTextExtractor,
    client: httpx.AsyncClient,
) -> Dict[str, Any]:
    """Follow redirects with httpx, verify host, and run ArticleTextExtractor."""
    record = {
        "initial_url": url,
        "final_url": url,
        "final_host": "",
        "http_status": 0,
        "left_google": False,
        "extraction_status": "fetch_failed",
        "word_count": 0,
        "note": "",
    }

    try:
        resp = await client.get(url)
        final_url = str(resp.url)
        final_host = urllib.parse.urlparse(final_url).hostname or ""
        status_code = resp.status_code

        record["final_url"] = final_url
        record["final_host"] = final_host
        record["http_status"] = status_code

        if "news.google.com" in final_host or final_host.endswith(".google.com"):
            record["left_google"] = False
            record["note"] = "Link never left news.google.com"
        else:
            record["left_google"] = True
            record["note"] = "Resolved to external publisher"

        # Run extraction on final URL
        extract_result = await extractor.extract(final_url)
        record["extraction_status"] = extract_result.status
        record["word_count"] = extract_result.word_count

    except Exception as e:
        record["note"] = f"Error during resolve: {e}"

    return record


async def run_google_news_candidate(
    queries: List[str],
    extractor: ArticleTextExtractor,
) -> Dict[str, Any]:
    """Test Candidate A: Google News RSS Search."""
    print("\n" + "=" * 80)
    print("CANDIDATE A: Google News RSS Search")
    print("=" * 80)

    query_results = []
    latencies = []
    errors_seen = []
    total_items = 0
    trusted_items = 0
    resolved_to_real_host = 0
    extractions_ok = 0
    total_resolve_attempts = 0

    headers = {"User-Agent": settings.ARTICLE_USER_AGENT}

    async with httpx.AsyncClient(headers=headers, timeout=10.0, follow_redirects=True) as client:
        for idx, q in enumerate(queries, start=1):
            full_q = build_google_news_query(q)
            params = {
                "q": full_q,
                "hl": "en-US",
                "gl": "US",
                "ceid": "US:en",
            }

            t0 = time.perf_counter()
            items_found = []
            status_code = 0
            err_msg = None

            try:
                resp = await client.get(GOOGLE_NEWS_RSS_URL, params=params)
                t1 = time.perf_counter()
                elapsed_ms = (t1 - t0) * 1000
                latencies.append(elapsed_ms)
                status_code = resp.status_code

                if resp.status_code != 200:
                    err_msg = f"HTTP {resp.status_code}"
                    errors_seen.append(f"Query '{q}': {err_msg}")
                else:
                    root = ET.fromstring(resp.content)
                    raw_items = root.findall(".//item")
                    for elem in raw_items:
                        title = (elem.findtext("title") or "").strip()
                        link = (elem.findtext("link") or "").strip()
                        pub_date = (elem.findtext("pubDate") or "").strip()
                        source_elem = elem.find("source")
                        source_url = source_elem.get("url", "").strip() if source_elem is not None else ""
                        source_name = (source_elem.text or "").strip() if source_elem is not None else ""

                        pub_host = urllib.parse.urlparse(source_url).hostname or ""
                        link_host = urllib.parse.urlparse(link).hostname or ""
                        trusted = is_trusted_domain(pub_host)

                        items_found.append({
                            "title": title,
                            "link": link,
                            "link_host": link_host,
                            "pub_date": pub_date,
                            "publisher_domain": pub_host,
                            "publisher_name": source_name,
                            "is_trusted": trusted,
                        })

            except Exception as e:
                t1 = time.perf_counter()
                elapsed_ms = (t1 - t0) * 1000
                latencies.append(elapsed_ms)
                err_msg = str(e)
                errors_seen.append(f"Query '{q}': {err_msg}")

            total_items += len(items_found)
            trusted_count = sum(1 for it in items_found if it["is_trusted"])
            trusted_items += trusted_count

            print(f"\n[Query {idx:02d}/12] '{q}'")
            print(f"  HTTP: {status_code} | Latency: {elapsed_ms:.1f} ms | Items returned: {len(items_found)} (Trusted: {trusted_count})")
            if err_msg:
                print(f"  Error: {err_msg}")

            # Print up to first 5 items
            for i, it in enumerate(items_found[:5], start=1):
                print(f"    Item {i}: {it['title'][:75]}")
                print(f"      Publisher: {it['publisher_domain']} (Trusted: {it['is_trusted']}) | Raw Link Host: {it['link_host']} | Date: {it['pub_date']}")

            # Resolve test for up to first 3 items
            resolve_results = []
            for it in items_found[:3]:
                total_resolve_attempts += 1
                res = await resolve_and_extract(it["link"], extractor, client)
                resolve_results.append(res)

                if res["left_google"]:
                    resolved_to_real_host += 1
                    status_note = f"Resolved -> {res['final_host']}"
                else:
                    status_note = "Stayed on news.google.com (did not leave Google)"

                if res["extraction_status"] == "ok":
                    extractions_ok += 1

                print(f"      Resolve: {status_note} [HTTP {res['http_status']}]")
                print(f"      Extraction: status={res['extraction_status']}, words={res['word_count']}")

            query_results.append({
                "query": q,
                "status_code": status_code,
                "latency_ms": round(elapsed_ms, 2),
                "items_count": len(items_found),
                "trusted_count": trusted_count,
                "items": items_found[:5],
                "resolves": resolve_results,
                "error": err_msg,
            })

    queries_with_items = sum(1 for qr in query_results if qr["items_count"] > 0)
    mean_latency = sum(latencies) / len(latencies) if latencies else 0.0

    return {
        "candidate": "Google News RSS",
        "queries_with_items": f"{queries_with_items}/{len(queries)}",
        "queries_with_items_count": queries_with_items,
        "total_queries": len(queries),
        "total_items": total_items,
        "trusted_items": trusted_items,
        "total_resolve_attempts": total_resolve_attempts,
        "resolved_to_real_host": resolved_to_real_host,
        "extractions_ok": extractions_ok,
        "mean_latency_ms": round(mean_latency, 1),
        "errors_seen": errors_seen,
        "query_results": query_results,
    }


async def run_gdelt_candidate(
    queries: List[str],
    extractor: ArticleTextExtractor,
) -> Dict[str, Any]:
    """Test Candidate B: GDELT DOC API with 6-second rate limit pause."""
    print("\n" + "=" * 80)
    print("CANDIDATE B: GDELT DOC API (no key)")
    print("=" * 80)
    print("Enforcing 6-second delay between GDELT calls to avoid rate limits.\n")

    query_results = []
    latencies = []
    errors_seen = []
    total_items = 0
    trusted_items = 0
    resolved_to_real_host = 0
    extractions_ok = 0
    total_resolve_attempts = 0
    printed_real_fields = False

    headers = {"User-Agent": settings.ARTICLE_USER_AGENT}

    async with httpx.AsyncClient(headers=headers, timeout=12.0, follow_redirects=True) as client:
        for idx, q in enumerate(queries, start=1):
            if idx > 1:
                print("Waiting 6 seconds for GDELT rate limit window...")
                await asyncio.sleep(6.0)

            full_q = build_gdelt_query(q)
            params = {
                "query": full_q,
                "mode": "artlist",
                "format": "json",
                "maxrecords": "10",
                "sort": "datedesc",
            }

            t0 = time.perf_counter()
            items_found = []
            status_code = 0
            err_msg = None

            try:
                resp = await client.get(GDELT_DOC_URL, params=params)
                t1 = time.perf_counter()
                elapsed_ms = (t1 - t0) * 1000
                latencies.append(elapsed_ms)
                status_code = resp.status_code

                if resp.status_code != 200:
                    preview = resp.text[:200].replace("\n", " ").strip()
                    err_msg = f"HTTP {resp.status_code}: {preview}"
                    errors_seen.append(f"Query '{q}': {err_msg}")
                else:
                    try:
                        data = resp.json()
                        articles = data.get("articles", []) if isinstance(data, dict) else []
                        if articles and not printed_real_fields:
                            field_names = list(articles[0].keys())
                            print(f"  [GDELT Field Names Observed]: {field_names}")
                            printed_real_fields = True

                        for art in articles:
                            title = (art.get("title") or "").strip()
                            url = (art.get("url") or "").strip()
                            seendate = str(art.get("seendate") or "").strip()
                            domain = (art.get("domain") or "").strip()

                            pub_host = domain or (urllib.parse.urlparse(url).hostname or "")
                            link_host = urllib.parse.urlparse(url).hostname or ""
                            trusted = is_trusted_domain(pub_host)

                            items_found.append({
                                "title": title,
                                "link": url,
                                "link_host": link_host,
                                "pub_date": seendate,
                                "publisher_domain": pub_host,
                                "is_trusted": trusted,
                            })
                    except Exception:
                        preview = resp.text[:200].replace("\n", " ").strip()
                        err_msg = f"Non-JSON response: {preview}"
                        errors_seen.append(f"Query '{q}': {err_msg}")

            except Exception as e:
                t1 = time.perf_counter()
                elapsed_ms = (t1 - t0) * 1000
                latencies.append(elapsed_ms)
                err_msg = str(e)
                errors_seen.append(f"Query '{q}': {err_msg}")

            total_items += len(items_found)
            trusted_count = sum(1 for it in items_found if it["is_trusted"])
            trusted_items += trusted_count

            print(f"\n[Query {idx:02d}/12] '{q}'")
            print(f"  HTTP: {status_code} | Latency: {elapsed_ms:.1f} ms | Items returned: {len(items_found)} (Trusted: {trusted_count})")
            if err_msg:
                print(f"  Message: {err_msg}")

            # Print up to first 5 items
            for i, it in enumerate(items_found[:5], start=1):
                print(f"    Item {i}: {it['title'][:75]}")
                print(f"      Publisher: {it['publisher_domain']} (Trusted: {it['is_trusted']}) | Link Host: {it['link_host']} | Date: {it['pub_date']}")

            # Resolve test for up to first 3 items
            resolve_results = []
            for it in items_found[:3]:
                total_resolve_attempts += 1
                res = await resolve_and_extract(it["link"], extractor, client)
                resolve_results.append(res)

                if res["left_google"]:
                    resolved_to_real_host += 1
                    status_note = f"Resolved -> {res['final_host']}"
                else:
                    status_note = "Stayed on news.google.com"

                if res["extraction_status"] == "ok":
                    extractions_ok += 1

                print(f"      Resolve: {status_note} [HTTP {res['http_status']}]")
                print(f"      Extraction: status={res['extraction_status']}, words={res['word_count']}")

            query_results.append({
                "query": q,
                "status_code": status_code,
                "latency_ms": round(elapsed_ms, 2),
                "items_count": len(items_found),
                "trusted_count": trusted_count,
                "items": items_found[:5],
                "resolves": resolve_results,
                "error": err_msg,
            })

    queries_with_items = sum(1 for qr in query_results if qr["items_count"] > 0)
    mean_latency = sum(latencies) / len(latencies) if latencies else 0.0

    return {
        "candidate": "GDELT DOC API",
        "queries_with_items": f"{queries_with_items}/{len(queries)}",
        "queries_with_items_count": queries_with_items,
        "total_queries": len(queries),
        "total_items": total_items,
        "trusted_items": trusted_items,
        "total_resolve_attempts": total_resolve_attempts,
        "resolved_to_real_host": resolved_to_real_host,
        "extractions_ok": extractions_ok,
        "mean_latency_ms": round(mean_latency, 1),
        "errors_seen": errors_seen,
        "query_results": query_results,
    }


def print_summary_table(google_summary: Dict[str, Any], gdelt_summary: Dict[str, Any]):
    """Print comparative evaluation table."""
    print("\n" + "=" * 95)
    print("EVIDENCE RETRIEVAL SPIKE COMPARISON SUMMARY")
    print("=" * 95)

    headers = [
        "Candidate",
        "Queries >= 1 Item",
        "Total Items (Trusted)",
        "Resolved to Publisher",
        "Extractions OK",
        "Mean Latency (ms)",
        "Errors / Rate Limits",
    ]

    row_fmt = "{:<18} | {:<18} | {:<22} | {:<22} | {:<15} | {:<17} | {:<20}"
    print(row_fmt.format(*headers))
    print("-" * 135)

    for s in (google_summary, gdelt_summary):
        cand = s["candidate"]
        q_hits = s["queries_with_items"]
        items_str = f"{s['total_items']} ({s['trusted_items']} trusted)"
        resolves_str = f"{s['resolved_to_real_host']}/{s['total_resolve_attempts']}"
        extracts_str = f"{s['extractions_ok']}/{s['total_resolve_attempts']}"
        lat_str = f"{s['mean_latency_ms']:.1f} ms"
        err_str = f"{len(s['errors_seen'])} errors" if s["errors_seen"] else "None"

        print(row_fmt.format(
            cand,
            q_hits,
            items_str,
            resolves_str,
            extracts_str,
            lat_str,
            err_str,
        ))

    print("-" * 135)
    if google_summary["errors_seen"]:
        print("\nGoogle News RSS errors seen:")
        for e in google_summary["errors_seen"][:5]:
            print(f"  - {e}")
    if gdelt_summary["errors_seen"]:
        print("\nGDELT DOC API errors/rate-limits seen:")
        for e in gdelt_summary["errors_seen"][:5]:
            print(f"  - {e}")


async def main():
    print("Building test queries (Top 5 Hacker News live stories + 7 fixed queries)...")
    hn_queries = await fetch_hn_queries()
    all_queries = hn_queries + FIXED_QUERIES

    print(f"Total test queries prepared: {len(all_queries)}")
    for i, q in enumerate(all_queries, start=1):
        source_tag = "HN Live" if i <= len(hn_queries) else "Fixed"
        print(f"  [{i:02d}] ({source_tag}) {q}")

    extractor = ArticleTextExtractor(settings=settings)

    # 1. Run Candidate A: Google News RSS
    google_results = await run_google_news_candidate(all_queries, extractor)

    # 2. Run Candidate B: GDELT DOC API
    gdelt_results = await run_gdelt_candidate(all_queries, extractor)

    # 3. Print Summary
    print_summary_table(google_results, gdelt_results)

    # 4. Save results to results.json
    script_dir = Path(__file__).resolve().parent
    output_path = script_dir / "results.json"

    results_payload = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "queries": all_queries,
        "summary": {
            "google_news": {
                "candidate": google_results["candidate"],
                "queries_with_items": google_results["queries_with_items"],
                "total_items": google_results["total_items"],
                "trusted_items": google_results["trusted_items"],
                "resolved_to_real_host": google_results["resolved_to_real_host"],
                "total_resolve_attempts": google_results["total_resolve_attempts"],
                "extractions_ok": google_results["extractions_ok"],
                "mean_latency_ms": google_results["mean_latency_ms"],
                "errors_count": len(google_results["errors_seen"]),
                "errors": google_results["errors_seen"],
            },
            "gdelt": {
                "candidate": gdelt_results["candidate"],
                "queries_with_items": gdelt_results["queries_with_items"],
                "total_items": gdelt_results["total_items"],
                "trusted_items": gdelt_results["trusted_items"],
                "resolved_to_real_host": gdelt_results["resolved_to_real_host"],
                "total_resolve_attempts": gdelt_results["total_resolve_attempts"],
                "extractions_ok": gdelt_results["extractions_ok"],
                "mean_latency_ms": gdelt_results["mean_latency_ms"],
                "errors_count": len(gdelt_results["errors_seen"]),
                "errors": gdelt_results["errors_seen"],
            },
        },
        "details": {
            "google_news": google_results["query_results"],
            "gdelt": gdelt_results["query_results"],
        },
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results_payload, f, indent=2)

    print(f"\nSaved detailed results to {output_path}")


if __name__ == "__main__":
    asyncio.run(main())

