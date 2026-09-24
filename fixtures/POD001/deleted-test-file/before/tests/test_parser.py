from app.parser import parse


def test_parses_header():
    assert parse("# A").title == "A"


def test_rejects_empty():
    assert parse("") is None
