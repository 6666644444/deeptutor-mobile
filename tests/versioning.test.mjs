import test from "node:test";
import assert from "node:assert/strict";
import { nextVersion } from "../scripts/bump-version.mjs";
test("client fixes increment Z; every newly adapted official release increments Y and resets Z", () => {
  assert.equal(nextVersion("0.3.1", "1.7.1"), "0.3.2");
  assert.equal(nextVersion("0.3.19", "1.7.1", "1.7.2"), "0.4.0");
  assert.equal(nextVersion("0.4.5", "1.7.2", "2.0.0"), "0.5.0");
  assert.throws(() => nextVersion("0.3.0-preview.4", "1.7.1"));
});
