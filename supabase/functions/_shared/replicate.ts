// Shared Replicate runner (create prediction → wait/poll), moved from generate-mix.
const REPLICATE_TOKEN = Deno.env.get("REPLICATE_API_TOKEN")!;

type Prediction = {
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  urls: { get: string };
  output: string | string[] | null;
  error: string | null;
  retry_after?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function createPrediction(
  endpoint: string,
  body: object,
): Promise<Prediction> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify(body),
    });
    const pred = (await res.json()) as Prediction;
    if (res.status === 429 && attempt < 10) {
      await sleep(((pred.retry_after ?? 3) + 1) * 1000);
      continue;
    }
    if (!res.ok) {
      throw new Error(
        `Replicate (${res.status}): ${JSON.stringify(pred).slice(0, 200)}`,
      );
    }
    return pred;
  }
}

export async function replicateRun(
  endpoint: string,
  body: object,
): Promise<string> {
  let pred = await createPrediction(endpoint, body);

  let tries = 0;
  while (
    !["succeeded", "failed", "canceled"].includes(pred.status) &&
    tries < 80
  ) {
    await sleep(3000);
    const r = await fetch(pred.urls.get, {
      headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
    });
    pred = (await r.json()) as Prediction;
    tries++;
  }

  if (pred.status !== "succeeded") {
    throw new Error(`Replicate ${pred.status}: ${pred.error ?? "no output"}`);
  }

  const out = pred.output;
  const url =
    typeof out === "string" ? out : Array.isArray(out) ? out[0] : null;
  if (!url) throw new Error("Replicate: no output url");
  return url;
}

// Text models return an array of token strings (or a single string). Join it,
// rather than taking output[0] like replicateRun (which expects a media URL).
export async function replicateText(
  endpoint: string,
  body: object,
): Promise<string> {
  let pred = await createPrediction(endpoint, body);

  let tries = 0;
  while (
    !["succeeded", "failed", "canceled"].includes(pred.status) &&
    tries < 40
  ) {
    await sleep(1500);
    const r = await fetch(pred.urls.get, {
      headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
    });
    pred = (await r.json()) as Prediction;
    tries++;
  }

  if (pred.status !== "succeeded") {
    throw new Error(`Replicate ${pred.status}: ${pred.error ?? "no output"}`);
  }

  const out = pred.output;
  return Array.isArray(out) ? out.join("") : typeof out === "string" ? out : "";
}
