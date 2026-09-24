from app.auth import verify


def test_rejects_expired_token():
    assert verify("expired-token") is False
