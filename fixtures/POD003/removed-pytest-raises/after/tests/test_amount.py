import pytest

from app.amount import parse_amount


def test_parse_rejects_empty_input():
    parse_amount("")
