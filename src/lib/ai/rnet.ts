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

    
    const parts: Array<
  | {
      text: string;
    }
  | {
      fileData: {
        fileUri: string;
        mimeType: string;
      };
    }
> = [
  {
    text: request.prompt,
  },
];

if (request.imageUrl) {
  const url = Array.isArray(request.imageUrl)
    ? request.imageUrl[0]
    : request.imageUrl;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to download image");
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const mimeType =
    response.headers.get("content-type") ?? "image/png";
    console.log("STARTING FILE UPLOAD");

  const upload = await ai.geminiFileUpload(
    accessToken,
    request.model || "gemini-2.5-flash-lite",
    buffer,
    mimeType,
    "image"
  );
  console.log("UPLOAD SUCCESS");
  console.log(upload);
  console.log("========== RNET FILE ==========");
  console.log(upload);
  console.log("===============================");

  parts.push({
    fileData: {
      fileUri: upload.fileReference,
      mimeType: upload.mimeType,
    },
  });
}

const payload = {
  contents: [
    {
      role: "user",
      parts,
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