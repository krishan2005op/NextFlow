import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import axios from "axios";
import type { AIProvider, AIRequest, AIResponse } from "./types";

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

  return `Temporary fallback response generated because the remote AI service is unavailable. Source prompt: ${clippedPrompt}`;
}


export class GeminiProvider implements AIProvider {
  async generate(request: AIRequest): Promise<AIResponse> {
    

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        response: buildQuotaFallback(
          request.prompt,
          request.systemPrompt
        ),
        fallback: true,
      };
    }


    try {
      const genAI = new GoogleGenerativeAI(apiKey);

      const model = genAI.getGenerativeModel({
        model: request.model || "gemini-2.5-flash",
        systemInstruction: request.systemPrompt,
      });


      const parts: Part[] = [
        {
          text: request.prompt,
        },
      ];


      if (request.imageUrl) {

        const imageUrls = Array.isArray(request.imageUrl)
          ? request.imageUrl
          : [request.imageUrl];


        for (const url of imageUrls) {

          if (!url) continue;


          let mimeType = "image/jpeg";
          let base64Data = "";


          if (url.startsWith("data:")) {

            const matches = url.match(
              /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/
            );


            if (matches) {
              mimeType = matches[1];
              base64Data = matches[2];
            }

          } else {

            const imgRes = await axios.get(url, {
              responseType: "arraybuffer",
            });


            const contentType =
              (imgRes.headers["content-type"] as string) ?? "";


            if (!contentType.startsWith("image/")) {
              throw new Error(
                `Invalid image content type: ${contentType}`
              );
            }


            base64Data = Buffer
              .from(imgRes.data)
              .toString("base64");


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


    } catch (error) {

      console.error("Gemini Provider Error:", error);

      throw error;
    }
  }
}