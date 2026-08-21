import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("ArtworkAtmosphereController registers its lifecycle cleanup in the layout effect phase", () => {
  const source = readFileSync(resolve(process.cwd(), "app/player.tsx"), "utf8");
  const start = source.indexOf("export function ArtworkAtmosphereController");
  const end = source.indexOf("\nconst styles", start);
  const controller = source.slice(start, end);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  expect(controller).toContain("useLayoutEffect(() => {");
  expect(controller).not.toContain("useEffect(() => {");
});
