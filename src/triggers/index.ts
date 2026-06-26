import { task } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import axios from "axios";
import sharp from "sharp";



function buildQuotaFallback(prompt: string, systemPrompt?: string) {
  const compactPrompt = prompt.replace(/\s+/g, " ").trim();
  const clippedPrompt =
    compactPrompt.length > 220
      ? `${compactPrompt.slice(0, 217).trimEnd()}...`
      : compactPrompt;

  if (systemPrompt?.toLowerCase().includes("tweet")) {
    return `Launch-ready hook: ${clippedPrompt.slice(0, 180)}${
      clippedPrompt.length > 180 ? "..." : ""
    }`;
  }

  if (systemPrompt?.toLowerCase().includes("marketing")) {
    return `A polished marketing draft based on the provided product details: ${clippedPrompt}`;
  }

  return `Temporary fallback response generated because the Gemini quota was exceeded. Source prompt: ${clippedPrompt}`;
}

export const cropImageTask = task({
  id: "crop-image",
  run: async (payload: {
    imageUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    const { imageUrl, x, y, width, height } = payload;

    if (!imageUrl) {
      throw new Error("cropImageTask: imageUrl is required but was empty");
    }

    let buffer: Buffer;
    if (imageUrl.startsWith("data:")) {
      const matches = imageUrl.match(
        /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/,
      );
      if (!matches) {
        throw new Error("Invalid data URI format for image.");
      }
      buffer = Buffer.from(matches[2], "base64");
    } else {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
      const contentType = (response.headers["content-type"] as string) ?? "";
      if (!contentType.startsWith("image/")) {
        throw new Error(
          `Failed to download image for crop: unexpected content type ${contentType}`,
        );
      }
      buffer = Buffer.from(response.data, "binary");
    }

    try {
  const image = sharp(buffer);

  const metadata = await image.metadata();

  const imageWidth = metadata.width ?? 1000;
  const imageHeight = metadata.height ?? 1000;

  const cropX = Math.max(
  0,
  Math.floor((x / 100) * imageWidth)
);

const cropY = Math.max(
  0,
  Math.floor((y / 100) * imageHeight)
);

const cropWidth = Math.min(
  imageWidth - cropX,
  Math.floor((width / 100) * imageWidth)
);

const cropHeight = Math.min(
  imageHeight - cropY,
  Math.floor((height / 100) * imageHeight)
);

  const croppedBuffer = await image
    .extract({
      left: cropX,
      top: cropY,
      width: cropWidth,
      height: cropHeight,
    })
    .png()
    .toBuffer();

  const base64 = croppedBuffer.toString("base64");

  return {
    croppedImageUrl: `data:image/png;base64,${base64}`,
    fallback: false,
  };
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown crop failure";

  throw new Error(`Crop failed: ${message}`);
}
  },
});

export const geminiTask = task({
  id: "gemini-task-v2",
  run: async (payload: {
    prompt: string;
    systemPrompt?: string;
    imageUrl?: string | string[];
    model?: string;
  }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        response: buildQuotaFallback(payload.prompt, payload.systemPrompt),
        fallback: true,
      };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      console.log("PAYLOAD MODEL =", payload.model);
      const model = genAI.getGenerativeModel({
        model: payload.model || "gemini-2.5-flash",
        systemInstruction: payload.systemPrompt,
      });

      const parts: Part[] = [{ text: payload.prompt }];

      if (payload.imageUrl) {
        const imageUrls = Array.isArray(payload.imageUrl)
          ? payload.imageUrl
          : [payload.imageUrl];

        for (const url of imageUrls) {
          if (!url) {
            continue;
          }

          let mimeType = "image/jpeg";
          let base64Data = "";

          if (url.startsWith("data:")) {
            const matches = url.match(
              /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/,
            );
            if (matches) {
              mimeType = matches[1];
              base64Data = matches[2];
            }
          } else {
            const imgRes = await axios.get(url, { responseType: "arraybuffer" });
            const contentType = (imgRes.headers["content-type"] as string) ?? "";
            if (!contentType.startsWith("image/")) {
              throw new Error(
                `Failed to download image for Gemini: unexpected content type ${contentType}`,
              );
            }
            base64Data = Buffer.from(imgRes.data, "binary").toString("base64");
            mimeType = contentType;
          }

          if (base64Data) {
            parts.push({
              inlineData: {
                data: base64Data,
                mimeType,
              },
            });
          }
        }
      }

      const result = await model.generateContent(parts);
      return {
        response: result.response.text(),
        fallback: false,
      };
    } catch (error: any) {
  console.error("========== GEMINI ERROR ==========");

  console.error(error);

  console.error("Message:", error?.message);

  console.error("Status:", error?.status);

  console.error("Response:", error?.response);

  console.error("==================================");

  throw error;
}
    // catch (error) {
    //   const message =
    //     error instanceof Error ? error.message.toLowerCase() : "unknown";
    //   const isQuotaIssue =
    //     message.includes("quota") ||
    //     message.includes("429") ||
    //     message.includes("resource_exhausted");

    //   if (!isQuotaIssue) {
    //     throw error;
    //   }

    //   return {
    //     response: buildQuotaFallback(payload.prompt, payload.systemPrompt),
    //     fallback: true,
    //   };
    // }
  },
});
