import { json } from "../_shared/http.ts";
import { serveAuthed } from "../_shared/serve.ts";
import {
  handleTrackMomentHttpRequest,
  trackMomentDependencies,
} from "./adapter.ts";

serveAuthed(async (req, user) => {
  const result = await handleTrackMomentHttpRequest(
    req,
    user.id,
    trackMomentDependencies,
  );
  return json(result.body, result.status);
});
