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
    console.log("========== ENTERED RNET PROVIDER ==========");
    console.log(request);
    console.log("===========================================");
    if (!request.userId) {
      throw new Error("Missing database user id");
    }

    const accessToken =
      await getValidAccessToken(
        request.userId
      );

    
    if (request.imageUrl) {
  const url = Array.isArray(request.imageUrl)
    ? request.imageUrl[0]
    : request.imageUrl;

  const response = await fetch(url);

  console.log("IMAGE STATUS:", response.status);

  const arrayBuffer = await response.arrayBuffer();

  console.log("IMAGE SIZE:", arrayBuffer.byteLength);
}
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