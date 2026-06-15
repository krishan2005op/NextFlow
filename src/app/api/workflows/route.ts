import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { createWorkflowSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      return NextResponse.json([]);
    }

    const workflows = await db.workflow.findMany({
      where: {
        userId: dbUser.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(workflows);
  } catch (error) {
    console.error("[WORKFLOWS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name } = createWorkflowSchema.parse(body);

    let user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      // Ensure user exists in our DB
      user = await db.user.create({
        data: {
          clerkId: userId,
          email: "user@example.com", 
        },
      });
    }

    const initialNodes = [
      {
        id: "request-inputs",
        type: "request_inputs",
        position: { x: 50, y: 50 },
        data: {
          fields: [
            {
              id: "text_field",
              name: "text_field",
              type: "text_field",
              value: "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design."
            },
            {
              id: "image_field",
              name: "image_field",
              type: "image_field",
              value: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80"
            }
          ]
        },
      },
      {
        id: "crop-1",
        type: "crop_image",
        position: { x: 450, y: 50 },
        data: { inputs: { x: 20, y: 20, width: 60, height: 60 } },
      },
      {
        id: "crop-2",
        type: "crop_image",
        position: { x: 450, y: 400 },
        data: { inputs: { x: 0, y: 0, width: 100, height: 50 } },
      },
      {
        id: "gemini-1",
        type: "gemini",
        position: { x: 450, y: 750 },
        data: {
          model: "gemini-2.0-flash",
          inputs: { system_prompt: "You are a marketing copywriter. Write a one-paragraph product description." }
        },
      },
      {
        id: "gemini-2",
        type: "gemini",
        position: { x: 850, y: 750 },
        data: {
          model: "gemini-2.0-flash",
          inputs: { system_prompt: "Condense the following product description into a tweet-length hook (under 240 characters)." }
        },
      },
      {
        id: "gemini-3",
        type: "gemini",
        position: { x: 1250, y: 400 },
        data: {
          model: "gemini-2.0-flash",
          inputs: { system_prompt: "You are a social media manager. Combine the tweet hook and the two product crops into a final marketing post." }
        },
      },
      {
        id: "response",
        type: "response",
        position: { x: 1700, y: 400 },
        data: {},
      },
    ];

    const initialEdges = [
      { id: "e-ri-c1", source: "request-inputs", target: "crop-1", sourceHandle: "image_field", targetHandle: "input_image", animated: true, style: { stroke: "#7C3AED", strokeWidth: 2 } },
      { id: "e-ri-c2", source: "request-inputs", target: "crop-2", sourceHandle: "image_field", targetHandle: "input_image", animated: true, style: { stroke: "#7C3AED", strokeWidth: 2 } },
      { id: "e-ri-g1", source: "request-inputs", target: "gemini-1", sourceHandle: "text_field", targetHandle: "prompt", animated: true, style: { stroke: "#7C3AED", strokeWidth: 2 } },
      { id: "e-g1-g2", source: "gemini-1", target: "gemini-2", sourceHandle: "response", targetHandle: "prompt", animated: true, style: { stroke: "#7C3AED", strokeWidth: 2 } },
      { id: "e-c1-g3", source: "crop-1", target: "gemini-3", sourceHandle: "output_image", targetHandle: "image_vision", animated: true, style: { stroke: "#7C3AED", strokeWidth: 2 } },
      { id: "e-c2-g3", source: "crop-2", target: "gemini-3", sourceHandle: "output_image", targetHandle: "image_vision", animated: true, style: { stroke: "#7C3AED", strokeWidth: 2 } },
      { id: "e-g2-g3", source: "gemini-2", target: "gemini-3", sourceHandle: "response", targetHandle: "prompt", animated: true, style: { stroke: "#7C3AED", strokeWidth: 2 } },
      { id: "e-g3-res", source: "gemini-3", target: "response", sourceHandle: "response", targetHandle: "result", animated: true, style: { stroke: "#7C3AED", strokeWidth: 2 } },
    ];

    const workflow = await db.workflow.create({
      data: {
        name,
        userId: user.id,
        nodes: JSON.stringify(initialNodes),
        edges: JSON.stringify(initialEdges),
      },
    });

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("[WORKFLOWS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
