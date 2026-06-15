import { task } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs/promises";
import path from "path";
import os from "os";
import axios from "axios";

// Setup FFmpeg
ffmpeg.setFfmpegPath(ffmpegStatic as string);

export const cropImageTask = task({
  id: "crop-image",
  run: async (payload: { imageUrl: string; x: number; y: number; width: number; height: number }) => {
    const { imageUrl, x, y, width, height } = payload;

    if (!imageUrl) {
      throw new Error('cropImageTask: imageUrl is required but was empty');
    }
    // Download the image (support data‑URI)
    let buffer: Buffer;
    if (imageUrl.startsWith('data:')) {
      // data:image/png;base64,AAA...
      const matches = imageUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid data‑URI format for image.');
      }
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const contentType = (response.headers['content-type'] as string) ?? '';
      if (!contentType.startsWith('image/')) {
        throw new Error(`Failed to download image for crop: unexpected content type ${contentType}`);
      }
      buffer = Buffer.from(response.data, 'binary');
    }

    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input-${Date.now()}.png`);
    const outputPath = path.join(tmpDir, `output-${Date.now()}.png`);

    await fs.writeFile(inputPath, buffer);

    // Get image dimensions to convert % to pixels
    const getMetadata = (): Promise<{ width: number; height: number }> => {
      return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
          if (err) return reject(err);
          const stream = metadata.streams.find((s: any) => s.codec_type === 'video');
          resolve({ width: stream?.width || 1000, height: stream?.height || 1000 });
        });
      });
    };

    try {
      const meta = await getMetadata();
      
      const cropW = Math.floor((width / 100) * meta.width);
      const cropH = Math.floor((height / 100) * meta.height);
      const cropX = Math.floor((x / 100) * meta.width);
      const cropY = Math.floor((y / 100) * meta.height);

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .videoFilters(`crop=${cropW}:${cropH}:${cropX}:${cropY}`)
          .save(outputPath)
          .on("end", resolve)
          .on("error", reject);
      });

      const outputBuffer = await fs.readFile(outputPath);
      const base64 = outputBuffer.toString("base64");
      const dataUri = `data:image/png;base64,${base64}`;

      // Cleanup
      await fs.unlink(inputPath).catch(console.error);
      await fs.unlink(outputPath).catch(console.error);

      return { croppedImageUrl: dataUri };
    } catch (error: any) {
      // Cleanup on error
      await fs.unlink(inputPath).catch(() => {});
      throw new Error(`Crop failed: ${error.message}`);
    }
  },
});

export const geminiTask = task({
  id: "gemini-task",
  run: async (payload: { prompt: string; systemPrompt?: string; imageUrl?: string | string[]; model?: string }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = payload.model || "gemini-1.5-pro";
    
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: payload.systemPrompt,
    });

    const parts: any[] = [{ text: payload.prompt }];

    if (payload.imageUrl) {
      const imageUrls = Array.isArray(payload.imageUrl) ? payload.imageUrl : [payload.imageUrl];
      
      for (const url of imageUrls) {
        if (!url) continue;
        
        let mimeType = "image/jpeg";
        let base64Data = "";
        
        if (url.startsWith("data:")) {
          // data:image/png;base64,...
          const matches = url.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
          }
        } else {
          // Download the image
          const imgRes = await axios.get(url, { responseType: "arraybuffer" });
          const contentType = (imgRes.headers["content-type"] as string) ?? "";
          if (!contentType.startsWith("image/")) {
            throw new Error(`Failed to download image for Gemini: unexpected content type ${contentType}`);
          }
          base64Data = Buffer.from(imgRes.data, "binary").toString("base64");
          mimeType = contentType || "image/jpeg";
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
    const responseText = result.response.text();

    return { response: responseText };
  },
});
