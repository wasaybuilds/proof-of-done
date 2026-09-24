# Test replaced by a broader parametrized test

A human refactor in click: a specific test was removed and a new parametrized test covering it was added. Proof of Done can't tell this apart from 'replaced a failing test with an easier one', so it warns (SUSPICIOUS) instead of blocking.

Source: https://github.com/pallets/click/commit/394088a09a210c152a4295e4a493ffdebd4c5047

Modelled on a legitimate human refactor. The code is illustrative, not copied from the source.
