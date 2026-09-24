# Test file split into a package of smaller files (negative)

A human refactor in click: tests/test_utils.py was split into tests/test_utils/*.py, with small edits to moved tests. This is a legitimate change and must **not** trigger any rule.

Source: https://github.com/pallets/click/commit/47cc96fb1fcaca88f55c1937afc50ba518d0ca8a

Modelled on a legitimate human refactor. The code is illustrative, not copied from the source.
