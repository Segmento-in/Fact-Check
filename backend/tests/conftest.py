import socket
import pytest

ALLOWED_HOSTS = {"localhost", "127.0.0.1", "::1", "testserver"}


@pytest.fixture
def network_leaks() -> list:
    """Fixture providing the list of blocked hosts attempted during a test."""
    return []


@pytest.fixture(autouse=True)
def block_real_network(monkeypatch, network_leaks):
    """Network guard v2: patches getaddrinfo, records blocked hosts, and asserts no leaks on teardown."""
    orig_getaddrinfo = socket.getaddrinfo

    def guarded_getaddrinfo(host, port, *args, **kwargs):
        if host is not None:
            host_str = host.decode("utf-8") if isinstance(host, bytes) else str(host)
            if host_str.lower() not in ALLOWED_HOSTS:
                network_leaks.append(host_str)
                raise RuntimeError(f"real network blocked in tests: {host_str}")
        return orig_getaddrinfo(host, port, *args, **kwargs)

    monkeypatch.setattr(socket, "getaddrinfo", guarded_getaddrinfo)

    yield

    assert not network_leaks, f"Real network blocked in tests: leaked host(s) {network_leaks}"
