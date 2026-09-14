import { json } from "../_shared/http.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import {
  handleExperienceStateHttpRequest,
  type ExperienceStateAdapterDependencies,
} from "./adapter.ts";

const dependencies: ExperienceStateAdapterDependencies = {
  rpc: (functionName, args) => admin.rpc(functionName, args),
};

serveAuthed(async (req, user) => {
  const result = await handleExperienceStateHttpRequest(req, user.id, dependencies);
  return json(result.body, result.status);
});
