import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

// The advisor runs on the workspace's own OpenAI connection (connector udc_openai),
// routed through the connector gateway — usage is billed to the user's OpenAI
// account, not to Lovable AI credits.
// Auth: Authorization: Bearer $LOVABLE_API_KEY (gateway) + X-Connection-Api-Key: $UDC_OPENAI_API_KEY (connection).
export const OPENAI_CONNECTOR_BASE_URL = "https://connector-gateway.lovable.dev/udc_openai/v1";

export function createResponsesCall(
  request: Request,
  config: { baseURL: string; apiKey: string; model: string; extraHeaders?: Record<string, string> },
  messages: ModelMessage[],
  instructions?: string,
  originalMessages?: import("ai").UIMessage[],
) {
  const provider = createOpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    ...(config.extraHeaders ? { headers: config.extraHeaders } : {}),
  });
  const result = streamText({
    model: provider.responses(config.model),
    // AI SDK 6 lacks `instructions`: rename this key to `system` there.
    ...(instructions ? { instructions } : {}),
    messages,
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return {
    result,
    response: () => result.toUIMessageStreamResponse({ sendReasoning: true, ...(originalMessages ? { originalMessages } : {}) }),
  };
}
