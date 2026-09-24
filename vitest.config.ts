import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // fixtures/ contains *.test.* files that are test *data*, not tests to run
    include: ["test/**/*.test.ts"],
  },
});
