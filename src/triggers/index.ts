import { task } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs/promises";
import os from "os";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegStatic as string);

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

    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input-${Date.now()}.png`);
    const outputPath = path.join(tmpDir, `output-${Date.now()}.png`);

    await fs.writeFile(inputPath, buffer);

    const getMetadata = (): Promise<{ width: number; height: number }> =>
      new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
          if (err) {
            return reject(err);
          }

          const stream = metadata.streams.find(
            (entry) => entry.codec_type === "video",
          );
          resolve({
            width: stream?.width || 1000,
            height: stream?.height || 1000,
          });
        });
      });

    try {
      const meta = await getMetadata();
      const cropW = Math.floor((width / 100) * meta.width);
      const cropH = Math.floor((height / 100) * meta.height);
      const cropX = Math.floor((x / 100) * meta.width);
      const cropY = Math.floor((y / 100) * meta.height);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .videoFilters(`crop=${cropW}:${cropH}:${cropX}:${cropY}`)
          .save(outputPath)
          .on("end", () => resolve())
          .on("error", reject);
      });

      const outputBuffer = await fs.readFile(outputPath);
      const base64 = outputBuffer.toString("base64");
      const dataUri = `data:image/png;base64,${base64}`;

      await new Promise((resolve) => setTimeout(resolve, 30000));

      await fs.unlink(inputPath).catch(() => undefined);
      await fs.unlink(outputPath).catch(() => undefined);

      return { croppedImageUrl: dataUri, fallback: false };
    } catch (error) {
      await fs.unlink(inputPath).catch(() => undefined);
      await fs.unlink(outputPath).catch(() => undefined);
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
