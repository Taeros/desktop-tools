"""Synthetic daily closes for any symbol, so fake mode works with whatever tickers are in the watchlist."""

from __future__ import annotations

import hashlib
import math
import time


def chart(url: str, params: dict) -> dict:
    symbol = url.rstrip("/").rsplit("/", 1)[-1].upper()
    seed = int(hashlib.sha256(symbol.encode()).hexdigest()[:8], 16)
    base = 40 + seed % 300
    end = int(time.time()) // 86400 * 86400 + 14 * 3600
    ts, closes, day = [], [], end
    while len(ts) < 252:
        if time.gmtime(day).tm_wday < 5:
            ts.append(day)
        day -= 86400
    ts.reverse()
    for i, _ in enumerate(ts):
        drift = 1 + 0.12 * i / 252 * (1 if seed % 3 else -1)
        wave = 1 + 0.04 * math.sin(i / 9 + seed % 7) + 0.015 * math.sin(i * 1.7 + seed % 5)
        closes.append(round(base * drift * wave, 2))
    names = {"VT": "Vanguard Total World Stock Index Fund ETF", "VTI": "Vanguard Total Stock Market Index Fund ETF"}
    return {"chart": {"result": [{
        "meta": {"symbol": symbol, "currency": "USD", "regularMarketPrice": closes[-1],
                 "chartPreviousClose": closes[0] * 0.98, "regularMarketTime": ts[-1],
                 "longName": names.get(symbol, f"{symbol} (sample data)")},
        "timestamp": ts, "indicators": {"quote": [{"close": closes}]}}], "error": None}}


FIXTURES = {"query1.finance.yahoo.com/v8/finance/chart/": chart}
