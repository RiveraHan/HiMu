import { en, es } from "../resources";

function leafKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [path] : leafKeys(child, path);
  });
}

test("English and Spanish expose the same translation keys", () => {
  expect(leafKeys(es).sort()).toEqual(leafKeys(en).sort());
});
