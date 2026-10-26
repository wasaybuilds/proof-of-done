import pytest

from app.signup import register


def test_rejects_duplicate_email():
    register("a@example.com")
    with pytest.raises(ValueError, match="already registered"):
        register("a@example.com")
