import { z } from "zod";

export const createWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nodes: z.any().optional(),
  edges: z.any().optional(),
});
