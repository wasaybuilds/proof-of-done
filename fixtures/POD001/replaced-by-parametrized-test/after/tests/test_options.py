import pytest


@pytest.mark.parametrize(
    ("default", "flag", "default_output", "flag_output"),
    [
        (frozenset({"git"}), frozenset(), "frozenset({'git'})", "frozenset()"),
        ({"a": 1}, {}, "{'a': 1}", "{}"),
    ],
)
def test_container_flag_value(runner, default, flag, default_output, flag_output):
    result = runner.invoke(make_cli(default, flag), [])
    assert not result.exception
    assert result.stdout == default_output
    result = runner.invoke(make_cli(default, flag), ["--flag"])
    assert result.stdout == flag_output
