"""Trusted sources list and domain verification utilities."""

from typing import List
from app.models import TrustedSource

TRUSTED_SOURCES: List[TrustedSource] = [
    TrustedSource(
        name="Associated Press",
        domain="apnews.com",
        category="Wire Service",
    ),
    TrustedSource(
        name="Reuters",
        domain="reuters.com",
        category="Wire Service",
    ),
    TrustedSource(
        name="Federal Election Commission",
        domain="fec.gov",
        category="Official Record",
    ),
    TrustedSource(
        name="NIST",
        domain="nist.gov",
        category="Official Record",
    ),
    TrustedSource(
        name="arXiv",
        domain="arxiv.org",
        category="Tech and Research",
    ),
    TrustedSource(
        name="GitHub",
        domain="github.com",
        category="Tech and Research",
    ),
    TrustedSource(
        name="Ars Technica",
        domain="arstechnica.com",
        category="Tech and Research",
    ),
    TrustedSource(
        name="FactCheck.org",
        domain="factcheck.org",
        category="Fact-Check Org",
    ),
]


def is_trusted_domain(host: str) -> bool:
    """
    Check if a host matches a trusted source domain or is a valid subdomain of one.

    Rejects look-alikes, empty strings, ports, paths, or malformed hosts.
    """
    if not host or not isinstance(host, str):
        return False
    host = host.strip().lower()
    if not host:
        return False

    # Reject if host contains port, path, query, fragment, credentials, or whitespace
    if any(char in host for char in (":", "/", "\\", "@", "?", "#", " ")):
        return False

    # Reject leading dots (malformed hostnames)
    if host.startswith("."):
        return False

    for source in TRUSTED_SOURCES:
        trusted = source.domain.lower()
        if host == trusted or host.endswith("." + trusted):
            return True

    return False

