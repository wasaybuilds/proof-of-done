# Long test split into smaller tests

A human refactor in click: parts of a long test moved into new, focused tests in the same change. Assertions left the original test but the change adds as many elsewhere, so Proof of Done warns instead of blocking.

Source: https://github.com/pallets/click/commit/394088a09a210c152a4295e4a493ffdebd4c5047

Modelled on a legitimate human refactor. The code is illustrative, not copied from the source.
