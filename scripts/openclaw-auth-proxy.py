#!/usr/bin/env python3
"""Restore Authorization after OpenShell service routing strips it.

OpenShell's gateway drops Authorization (and other gateway-auth headers) before
relaying HTTP to an exposed sandbox service:
https://github.com/NVIDIA/OpenShell/issues/1794

nginx copies the client Bearer token to X-OpenClaw-Authorization. This proxy
listens on a second loopback port, restores Authorization, and forwards to
the OpenClaw gateway on 127.0.0.1:18789.
"""
from __future__ import annotations

import argparse
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

RESTORE_HEADER = "x-openclaw-authorization"
HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}


class RestoreAuthHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    upstream_host = "127.0.0.1"
    upstream_port = 18789
    timeout = 180

    def log_message(self, fmt: str, *args) -> None:
        sys_stderr = __import__("sys").stderr
        sys_stderr.write("[auth-proxy] " + (fmt % args) + "\n")

    def do_GET(self) -> None:
        self._proxy()

    def do_POST(self) -> None:
        self._proxy()

    def do_PUT(self) -> None:
        self._proxy()

    def do_PATCH(self) -> None:
        self._proxy()

    def do_DELETE(self) -> None:
        self._proxy()

    def do_HEAD(self) -> None:
        self._proxy()

    def do_OPTIONS(self) -> None:
        self._proxy()

    def _proxy(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers: dict[str, str] = {}
        restored = None
        for key, value in self.headers.items():
            lower = key.lower()
            if lower in HOP_BY_HOP:
                continue
            if lower == RESTORE_HEADER:
                restored = value
                continue
            headers[key] = value
        if restored and not any(k.lower() == "authorization" for k in headers):
            headers["Authorization"] = restored

        conn = http.client.HTTPConnection(
            self.upstream_host, self.upstream_port, timeout=self.timeout
        )
        try:
            conn.request(self.command, self.path, body=body, headers=headers)
            resp = conn.getresponse()
            payload = resp.read()
            self.send_response(resp.status)
            for key, value in resp.getheaders():
                if key.lower() in HOP_BY_HOP:
                    continue
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(payload)
        finally:
            conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="OpenClaw Authorization restore proxy")
    parser.add_argument("--listen", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18790)
    parser.add_argument("--upstream-port", type=int, default=18789)
    args = parser.parse_args()
    RestoreAuthHandler.upstream_port = args.upstream_port
    server = ThreadingHTTPServer((args.listen, args.port), RestoreAuthHandler)
    print(f"openclaw-auth-proxy listening on {args.listen}:{args.port} -> :{args.upstream_port}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
