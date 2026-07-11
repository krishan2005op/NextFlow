import { task } from "@trigger.dev/sdk/v3";
import { generateAI } from "@/lib/ai/provider";
import type { AIProviderType } from "@/lib/ai/types";


export const aiTask = task({

  id:"ai-task",

  run: async (payload: {
  provider: AIProviderType;
  prompt: string;
  systemPrompt?: string;
  imageUrl?: string | string[];
  model?: string;
  accessToken?: string;
  userId?: string;
}) => {

    
    const result = await generateAI(
  payload.provider,
  {
    prompt: payload.prompt,
    systemPrompt: payload.systemPrompt,
    imageUrl: payload.imageUrl,
    model: payload.model,
    accessToken: payload.accessToken,
    userId: payload.userId,
  }
);
    

    return result;

  }

});