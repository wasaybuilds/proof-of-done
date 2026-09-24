import click


def test_echo(runner):
    result = runner.invoke(echo_cmd)
    assert result.output == "hi\n"
