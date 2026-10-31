import { strict as assert } from "node:assert";
import { test } from "node:test";
import { canonicalDiagnosticKey as key } from "./typescript-diagnostic-key.mjs";
test("only ordering of the same literal union is equivalent", () => {
  const diagnostic = (type) =>
    `frontend/old.ts|TS2322|Type '"bad"' is not assignable to type '${type}'.`;
  assert.equal(key(diagnostic('"b" | "a"')), key(diagnostic('"a" | "b"')));
  assert.notEqual(key(diagnostic('"a" | "b"')), key(diagnostic('"a" | "c"')));
  assert.notEqual(
    key(diagnostic('"a" | "b"')),
    key(diagnostic('"a" | "b" | "c"')),
  );
  assert.notEqual(
    key(diagnostic('"a" | "b"')),
    key(diagnostic('"a" | "b" | "b"')),
  );
  assert.notEqual(
    key(diagnostic('"a" | "b"')),
    key(diagnostic('"a" | "b"')).replace("old.ts", "new.ts"),
  );
  assert.notEqual(
    key(diagnostic('"a" | "b"')),
    key(diagnostic('"a" | "b"')).replace("TS2322", "TS2345"),
  );
  assert.notEqual(
    key(diagnostic('"a" | "b"')),
    key(diagnostic('"a" | "b"')).replace('"bad"', '"other"'),
  );
  assert.equal(
    key("Type 'Foo | Bar' is not assignable to 'Baz'."),
    "Type 'Foo | Bar' is not assignable to 'Baz'.",
  );
});
