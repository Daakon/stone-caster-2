/** TypeScript can reorder string-literal unions as its global type graph changes.
 * Sort only adjacent quoted string literals; preserve paths, codes, all members
 * and the rest of the diagnostic. This never broadens an allowance. */
export function canonicalDiagnosticKey(key) {
  return key.replace(/"[^"\\]*"(?: \| "[^"\\]*")+/g, (union) =>
    union.split(" | ").sort().join(" | "),
  );
}
