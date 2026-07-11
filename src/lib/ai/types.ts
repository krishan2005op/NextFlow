export type AIProviderType = "GEMINI" | "RNET";

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  imageUrl?: string | string[];
  model?: string;

  accessToken?: string; // temporary, will be removed later
  userId?: string;
}

export interface AIResponse {
  response: string;
  fallback: boolean;
}

export interface AIProvider {
  generate(request: AIRequest): Promise<AIResponse>;
}