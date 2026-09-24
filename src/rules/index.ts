import type { Rule } from "../types.js";
import { testDeleted } from "./POD001-test-deleted.js";
import { testSkipped } from "./POD002-test-skipped.js";
import { assertionRemoved } from "./POD003-assertion-removed.js";

export const rules: readonly Rule[] = [testDeleted, testSkipped, assertionRemoved];
