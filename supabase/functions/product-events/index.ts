import { cors, json } from "../_shared/http.ts";
import { admin, getUser } from "../_shared/supabase.ts";
import {
  authenticateProductEventRequest,
  handleProductEventEdgeRequest,
  type ProductEventEdgeDependencies,
  type ProductEventRecordResult,
} from "./handler.ts";

const dependencies: ProductEventEdgeDependencies = {
  authenticate: (req) => authenticateProductEventRequest(req, getUser),
  record: async (event, userId) => {
    const { data, error } = await admin.rpc("record_product_event", {
      p_event_id: event.eventId,
      p_user_id: userId,
      p_installation_id: event.installationId,
      p_session_id: event.sessionId,
      p_event_name: event.name,
      p_properties: event.properties,
      p_occurred_at: event.occurredAt,
    });
    if (error) throw new Error("record_product_event_failed");

    const result = (Array.isArray(data) ? data[0] : data) as unknown;
    if (result !== "accepted" && result !== "duplicate" && result !== "rate_limited") {
      throw new Error("record_product_event_invalid_result");
    }
    return result as ProductEventRecordResult;
  },
};

Deno.serve(async (req) => {
  const result = await handleProductEventEdgeRequest(req, dependencies);
  return result.status === 204
    ? new Response(null, { status: 204, headers: cors })
    : json(result.body, result.status);
});
