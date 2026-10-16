"""Shared endpoint handling for DashScope compatible and native APIs."""

import os
from urllib.parse import urlsplit, urlunsplit


def dashscope_base_url(base_url=None, *, native=False):
    value = base_url or os.getenv("DASHSCOPE_BASE_URL")
    if not value:
        raise ValueError("Set DASHSCOPE_BASE_URL or the DashScope provider's base_url")
    parts = urlsplit(value.strip().rstrip("/"))
    if parts.scheme not in {"http", "https"} or not parts.hostname or parts.username or parts.password:
        raise ValueError("DASHSCOPE_BASE_URL must be an HTTP(S) URL without credentials")
    if parts.query or parts.fragment:
        raise ValueError("DASHSCOPE_BASE_URL must not contain a query or fragment")
    path = parts.path.rstrip("/")
    if path in {"/api/v1", "/compatible-mode/v1"}:
        path = ""
    elif path:
        raise ValueError("DASHSCOPE_BASE_URL must end in /api/v1, /compatible-mode/v1, or the host root")
    return urlunsplit((parts.scheme, parts.netloc, "/api/v1" if native else "/compatible-mode/v1", "", ""))


def dashscope_api_key(api_key=None):
    value = api_key or os.getenv("DASHSCOPE_API_KEY")
    if not value:
        raise ValueError("Set DASHSCOPE_API_KEY or the DashScope provider's api_key")
    return value
