from app.parse import parse_date


def test_parses_iso_date():
    assert parse_date("2026-09-26").day == 26
