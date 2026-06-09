import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `You are an expert water infrastructure advisor for rural Guinea, working with CAFO Engineering Consultants.

PROJECT CONTEXT:
- Village in Préfecture de Boké, Guinea (10.990°N, -11.435°E)
- Population: 1,031 people across 170 households (avg 6.06 people/household)
- Water tower: 40 m³ capacity, gravity-fed, base elevation 373m NGF
- Sustainable yield: 37 m³/day
- 3 households are above the 373m gravity threshold (cannot be served by gravity)
- Max distance from reservoir: 2,062m
- Budget envelope: €220,000
- 20-year project horizon (2025–2045)
- Population growth assumption: 2%/year
- WHO minimum: 20 L/person/day

CURRENT RECOMMENDED SOLUTION: "Hybrid Network" at ~€224,100
- 4 public fountains + 90 household connections
- Serves ~100% of population
- Sustainability score 88/100, LOW risk
- Best blended cost/coverage/sustainability score

ALTERNATIVE SCENARIOS:
- Public Fountains only: ~€120k, 100% coverage but lower service level
- Full Household Connections: ~€350k, exceeds budget significantly

COSTS USED:
- Pipe: €38/m
- Public fountain: €6,500 each
- Household connection: €850 each
- O&M provision: 8% of CAPEX; Contingency: 10%

Be concise, data-driven, and reference specific numbers above. Answer in the user's language (French or English). When citing tradeoffs, give numeric ranges. You are advising investors, NGO directors, and government officials — be credible and pragmatic.`;

export const Route = createFileRoute("/api/advisor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = (await request.json()) as { messages?: UIMessage[] };
          if (!Array.isArray(messages)) {
            return new Response("Messages are required", { status: 400 });
          }
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const gateway = createLovableAiGatewayProvider(key);
          const model = gateway("google/gemini-3-flash-preview");

          const result = streamText({
            model,
            system: SYSTEM_PROMPT,
            messages: await convertToModelMessages(messages),
          });

          return result.toUIMessageStreamResponse({ originalMessages: messages });
        } catch (e) {
          console.error("[advisor]", e);
          return new Response("Internal error", { status: 500 });
        }
      },
    },
  },
});
