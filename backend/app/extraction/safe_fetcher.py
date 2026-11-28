"""Bounded fetching of untrusted public Article links."""
import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
import ipaddress
import socket
from urllib.parse import urlsplit

import httpx

from app.config import Settings

REDIRECT_STATUSES = {301, 302, 303, 307, 308}
MAX_REDIRECTS = 5
# Do not permit addresses that can tunnel to an unvalidated IPv4 destination.
TRANSITION_NETWORKS = tuple(ipaddress.ip_network(value) for value in (
    "64:ff9b::/96", "64:ff9b:1::/48", "2002::/16", "2001::/32",
))


class FetchFailure(Exception):
    def __init__(self, status: str):
        super().__init__(status)
        self.status = status


@dataclass(frozen=True)
class FetchedHTML:
    content: bytes
    final_url: str


def validate_article_url(value: str) -> httpx.URL:
    """Validate syntax without resolving or opening the destination."""
    if not value or len(value) > 2048:
        raise ValueError("Enter an HTTP or HTTPS Article link, up to 2048 characters.")
    if "\\" in value or any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("The Article link contains unsupported characters.")
    try:
        parts = urlsplit(value)
        url = httpx.URL(value)
        if parts.username is not None or parts.password is not None:
            raise ValueError("Links containing credentials are not supported.")
        if url.scheme not in {"http", "https"} or not url.host:
            raise ValueError("Enter an HTTP or HTTPS Article link.")
        if url.port not in {None, 80 if url.scheme == "http" else 443}:
            raise ValueError("Article links must use the standard HTTP or HTTPS port.")
        if "%" in url.host:
            raise ValueError("Scoped network addresses are not supported.")
        return url.copy_with(fragment=None)
    except (httpx.InvalidURL, UnicodeError) as error:
        raise ValueError("Enter a valid HTTP or HTTPS Article link.") from error


def _is_public(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return False
    if isinstance(address, ipaddress.IPv6Address):
        if address.ipv4_mapped is not None:
            return _is_public(str(address.ipv4_mapped))
        if any(address in network for network in TRANSITION_NETWORKS):
            return False
    return address.is_global and not address.is_multicast and not address.is_reserved


async def resolve_addresses(host: str, port: int) -> list[str]:
    answers = await asyncio.get_running_loop().getaddrinfo(
        host, port, type=socket.SOCK_STREAM,
    )
    return list(dict.fromkeys(answer[4][0] for answer in answers))


class SafeFetcher:
    def __init__(
        self,
        settings: Settings,
        *,
        resolver: Callable[[str, int], Awaitable[list[str]]] = resolve_addresses,
        client_factory: Callable[..., httpx.AsyncClient] = httpx.AsyncClient,
    ):
        self.settings = settings
        self._resolve = resolver
        self._client_factory = client_factory

    async def _public_address(self, url: httpx.URL) -> str:
        host = url.host.rstrip(".")
        if host.lower() == "localhost" or host.lower().endswith(".localhost"):
            raise FetchFailure("blocked_url")
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            addresses = await self._resolve(host, url.port or (443 if url.scheme == "https" else 80))
        else:
            addresses = [str(address)]
        if not addresses or not all(_is_public(value) for value in addresses):
            raise FetchFailure("blocked_url")
        # Prefer IPv4 on hosts that do not provide outbound IPv6.
        return sorted(addresses, key=lambda value: ipaddress.ip_address(value).version)[0]

    async def fetch_html(self, value: str) -> FetchedHTML:
        try:
            url = validate_article_url(value)
            for hop in range(MAX_REDIRECTS + 1):
                address = await self._public_address(url)
                # Pin the connection to the checked IP; TLS still verifies the real
                # hostname. A fresh client per hop avoids cross-host pool/cookie reuse.
                target = url.copy_with(host=address)
                headers = {
                    "Host": url.netloc.decode("ascii"),
                    "User-Agent": self.settings.ARTICLE_USER_AGENT,
                    "Accept": "text/html, application/xhtml+xml",
                    "Accept-Encoding": "identity",
                }
                async with self._client_factory(
                    timeout=self.settings.ARTICLE_FETCH_TIMEOUT_SECONDS,
                    follow_redirects=False,
                    trust_env=False,
                ) as client:
                    async with client.stream(
                        "GET", target, headers=headers,
                        extensions={"sni_hostname": url.host},
                    ) as response:
                        if response.status_code in REDIRECT_STATUSES:
                            location = response.headers.get("location")
                            if not location or hop == MAX_REDIRECTS:
                                raise FetchFailure("fetch_failed")
                            try:
                                # Check the raw Location before URL joining can
                                # normalize control characters away.
                                if "\\" in location or any(
                                    ord(char) < 32 or ord(char) == 127 for char in location
                                ):
                                    raise ValueError("Invalid redirect")
                                redirected = validate_article_url(str(url.join(location)))
                            except (ValueError, httpx.InvalidURL) as error:
                                raise FetchFailure("blocked_url") from error
                            if url.scheme == "https" and redirected.scheme != "https":
                                raise FetchFailure("blocked_url")
                            url = redirected
                            continue
                        if response.status_code != 200:
                            raise FetchFailure("fetch_failed")
                        media_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
                        if media_type not in {"text/html", "application/xhtml+xml"}:
                            raise FetchFailure("not_html")
                        # Request identity encoding and reject unsolicited compression.
                        # This avoids unbounded decompression before enforcing the cap.
                        if response.headers.get("content-encoding", "identity").strip().lower() not in {"", "identity"}:
                            raise FetchFailure("unsupported_encoding")
                        limit = self.settings.ARTICLE_MAX_DOWNLOAD_BYTES
                        declared = response.headers.get("content-length")
                        if declared and declared.isdecimal() and int(declared) > limit:
                            raise FetchFailure("too_large")
                        content = bytearray()
                        async for chunk in response.aiter_bytes(chunk_size=65536):
                            if len(content) + len(chunk) > limit:
                                raise FetchFailure("too_large")
                            content.extend(chunk)
                        return FetchedHTML(bytes(content), str(url))
            raise FetchFailure("fetch_failed")
        except FetchFailure:
            raise
        except (httpx.TimeoutException, TimeoutError) as error:
            raise FetchFailure("timeout") from error
        except (ValueError, httpx.InvalidURL) as error:
            raise FetchFailure("blocked_url") from error
        except (httpx.HTTPError, OSError) as error:
            raise FetchFailure("fetch_failed") from error
