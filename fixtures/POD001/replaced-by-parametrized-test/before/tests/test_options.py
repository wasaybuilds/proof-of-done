def test_frozenset_flag_value(runner):
    result = runner.invoke(cli, [])
    assert result.stdout == "frozenset({'git'})"
    result = runner.invoke(cli, ["--flag"])
    assert result.stdout == "frozenset()"
