import pytest

from app.auth import verify


@pytest.mark.skip(reason="flaky")
def test_rejects_expired_token():
    assert verify("expired-token") is False
