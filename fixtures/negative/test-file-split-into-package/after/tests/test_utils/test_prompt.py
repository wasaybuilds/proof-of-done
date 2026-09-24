import click


def test_prompt(runner):
    result = runner.invoke(prompt_cmd, input="x\n")
    assert not result.exception
    assert result.output.endswith("x\n")
