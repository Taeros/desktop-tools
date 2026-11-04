from dt_tools.markets.fake import chart
from dt_tools.markets.provider import compute


def test_compute_changes():
    q = compute("VT", chart("https://query1.finance.yahoo.com/v8/finance/chart/VT", {}))
    assert q.symbol == "VT" and q.price
    assert set(q.changes) == {"1D", "1W", "1M", "1Y"}
    assert all(v is not None for v in q.changes.values())
    assert len(q.spark) == 66
