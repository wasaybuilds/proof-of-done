from app.search import search


def test_finds_all_matches():
    assert len(search("cat")) > 0
