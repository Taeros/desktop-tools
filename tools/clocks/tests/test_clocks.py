from datetime import UTC, datetime

from dt_tools.clocks.provider import offset_of


def test_offsets_follow_dst():
    winter = datetime(2026, 1, 15, 12, tzinfo=UTC)
    summer = datetime(2026, 7, 15, 12, tzinfo=UTC)
    assert offset_of("America/New_York", winter)[0] == -300
    assert offset_of("America/New_York", summer)[0] == -240
    assert offset_of("Asia/Kolkata", winter)[0] == 330
    assert offset_of("Not/AZone", winter) == (0, "UTC")
