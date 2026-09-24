import click


def test_echo(runner):
    assert runner.invoke(echo_cmd).output == "hi\n"


def test_prompt(runner):
    result = runner.invoke(prompt_cmd, input="x\n")
    assert result.output.endswith("x\n")
