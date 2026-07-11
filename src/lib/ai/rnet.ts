import { RNetAi } from "@rnet-ai/rnet-oauth-node";

import {
  AIProvider,
  AIRequest,
  AIResponse,
} from "./types";

import { getValidAccessToken } from "./rnet-auth";

const ai = new RNetAi();

export class RNetProvider implements AIProvider {
  async generate(
    request: AIRequest
  ): Promise<AIResponse> {

    if (!request.userId) {
      throw new Error("Missing database user id");
    }

    const accessToken =
      await getValidAccessToken(
        request.userId
      );

    

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: request.prompt,
            },
          ],
        },
      ],
    };

    const response = await ai.chat(
      payload,
      accessToken,
      request.model || "gemini-2.5-flash-lite"
    );

    let text = "";

if (typeof response === "string") {
  text = response;
} else {
  const result = response as {
    candidates?: {
      content?: {
        parts?: {
          text?: string;
        }[];
      };
    }[];
  };

  text =
    result.candidates?.[0]?.content?.parts?.[0]?.text ??
    "No response generated.";
}

return {
  response: text,
  fallback: false,
};
  }
}