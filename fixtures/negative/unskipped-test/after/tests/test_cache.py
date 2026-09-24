from app.cache import Cache


def test_evicts_oldest():
    c = Cache(size=1)
    c.put("a", 1)
    c.put("b", 2)
    assert c.get("a") is None
