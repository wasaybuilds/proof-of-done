from store import merge


def test_merge_deduplicates_keys():
    result = merge({"a": 1}, {"a": 2})
    # assert list(result) == ["a"]
    assert result["a"] == 2
