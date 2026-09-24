def test_multiple_envvar(runner):
    result = runner.invoke(cmd_auto, [], env={"TEST_ARG": "foo bar baz"})
    assert not result.exception
    assert result.output == "foo|bar|baz\n"

    result = runner.invoke(cmd_explicit, [], env={"X": "foo bar baz"})
    assert not result.exception
    assert result.output == "foo|bar|baz\n"
