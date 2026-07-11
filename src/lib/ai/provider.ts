import { GeminiProvider } from "./gemini";
import { RNetProvider } from "./rnet";
import type {
  AIProvider,
  AIProviderType,
  AIRequest,
  AIResponse,
} from "./types";


const geminiProvider = new GeminiProvider();
const rnetProvider = new RNetProvider();


export async function generateAI(
  provider: AIProviderType,
  request: AIRequest
): Promise<AIResponse> {
    console.log("========== AI PROVIDER ==========");
  console.log("Provider:", provider);
  console.log("Model:", request.model);
  console.log("Prompt:", request.prompt);
  console.log("=================================");

  let aiProvider: AIProvider;


  switch(provider){

    case "RNET":
      aiProvider = rnetProvider;
      break;


    case "GEMINI":
    default:
      aiProvider = geminiProvider;
      break;

  }

  console.log("SELECTED AI PROVIDER:", provider);
  return aiProvider.generate(request);
}