"""Markets watchlist from Yahoo Finance chart data (no API key). Percent change over 1D / 1W / 1M / 1Y."""

from __future__ import annotations

import asyncio
import re
from datetime import UTC, datetime, timedelta

from desktop_tools.sdk import Field, Provider, State, ToolError, ToolSettings, action

CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
SYMBOL = re.compile(r"^[A-Za-z0-9.^=\-]{1,15}$")


class MarketsSettings(ToolSettings):
    tickers: list[str] = Field(default_factory=lambda: ["VT"], title="Watchlist",
                               description="Ticker symbols, e.g. VT, VTI, ^GSPC, BTC-USD",
                               json_schema_extra={"x-widget": "tags", "x-uppercase": True})


class Quote(State):
    symbol: str
    name: str = ""
    currency: str = ""
    price: float | None = None
    changes: dict[str, float | None] = {}
    spark: list[float] = []
    market_time: int | None = None
    error: str = ""


class MarketsState(State):
    quotes: list[Quote]


def compute(symbol: str, data: dict) -> Quote:
    try:
        res = data["chart"]["result"][0]
        meta = res["meta"]
        ts = res.get("timestamp") or []
        closes = res["indicators"]["quote"][0].get("close") or []
    except (KeyError, IndexError, TypeError) as exc:
        raise ToolError(f"No data for {symbol}") from exc
    price = meta.get("regularMarketPrice")
    pts = [(t, c) for t, c in zip(ts, closes, strict=False) if c is not None]
    if price is None or len(pts) < 2:
        raise ToolError(f"No data for {symbol}")
    last_t = datetime.fromtimestamp(pts[-1][0], UTC)

    def close_at_or_before(when: datetime) -> float | None:
        target = when.timestamp()
        for t, c in reversed(pts):
            if t <= target:
                return c
        return None

    def back_months(n: int) -> datetime:
        y, m = divmod(last_t.month - 1 - n, 12)
        day = min(last_t.day, 28)
        return last_t.replace(year=last_t.year + y, month=m + 1, day=day)

    refs = {
        "1D": pts[-2][1],
        "1W": close_at_or_before(last_t - timedelta(days=7)),
        "1M": close_at_or_before(back_months(1)),
        "1Y": close_at_or_before(back_months(12)) or meta.get("chartPreviousClose"),
    }
    changes = {k: (round((price - v) / v * 100, 2) if v else None) for k, v in refs.items()}
    return Quote(symbol=meta.get("symbol", symbol).upper(), name=meta.get("longName") or meta.get("shortName") or "",
                 currency=meta.get("currency", ""), price=round(float(price), 4), changes=changes,
                 spark=[round(c, 4) for _, c in pts[-66:]], market_time=meta.get("regularMarketTime"))


class Markets(Provider[MarketsSettings, MarketsState]):
    Settings = MarketsSettings
    interval = 300

    async def _one(self, ctx, symbol: str) -> Quote:
        if not SYMBOL.match(symbol):
            return Quote(symbol=symbol, error="Invalid symbol")
        try:
            data = await ctx.http.get_json(CHART.format(symbol=symbol), params={"range": "1y", "interval": "1d"})
            return compute(symbol, data)
        except ToolError as exc:
            return Quote(symbol=symbol.upper(), error=str(exc))

    async def refresh(self, ctx) -> MarketsState:
        symbols = [s.strip().upper() for s in ctx.settings.tickers if s.strip()][:20]
        quotes = await asyncio.gather(*(self._one(ctx, s) for s in symbols))
        if quotes and all(q.error for q in quotes):
            raise ToolError(quotes[0].error)
        return MarketsState(quotes=list(quotes))

    @action
    async def add_ticker(self, ctx, symbol: str) -> None:
        symbol = symbol.strip().upper()
        if not SYMBOL.match(symbol):
            raise ToolError("That doesn't look like a ticker symbol")
        if symbol not in ctx.settings.tickers:
            await ctx.update_settings(tickers=[*ctx.settings.tickers, symbol])

    @action
    async def remove_ticker(self, ctx, symbol: str) -> None:
        await ctx.update_settings(tickers=[t for t in ctx.settings.tickers if t.upper() != symbol.upper()])
