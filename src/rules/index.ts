import type { Rule } from "../types.js";
import { testDeleted } from "./POD001-test-deleted.js";
import { testSkipped } from "./POD002-test-skipped.js";
import { assertionRemoved } from "./POD003-assertion-removed.js";
import { assertionWeakened } from "./POD004-assertion-weakened.js";
import { vacuousAssertion } from "./POD005-vacuous-assertion.js";

export const rules: readonly Rule[] = [testDeleted, testSkipped, assertionRemoved, assertionWeakened, vacuousAssertion];
