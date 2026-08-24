import { parseOptions } from "../private-media-runner";

test("parses safe migration controls", () => {
  expect(parseOptions([
    "--dry-run",
    "--batch-size=25",
    "--cursor=11111111-1111-4111-8111-111111111111",
  ])).toEqual({
    dryRun: true,
    batchSize: 25,
    cursor: "11111111-1111-4111-8111-111111111111",
  });
});

test.each([
  "--batch-size=0",
  "--batch-size=501",
  "--batch-size=1.5",
  "--cursor=not-a-uuid",
  "--unknown",
])("rejects unsafe argument %s", (argument) => {
  expect(() => parseOptions([argument])).toThrow();
});
