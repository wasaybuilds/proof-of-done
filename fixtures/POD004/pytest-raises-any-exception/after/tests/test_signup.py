import pytest

from app.signup import register


def test_rejects_duplicate_email():
    register("a@example.com")
    with pytest.raises(Exception):
        register("a@example.com")
