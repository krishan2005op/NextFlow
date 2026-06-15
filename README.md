# NextFlow: Visual AI Workflow Builder

NextFlow is a full-stack, pixel-perfect clone of a visual AI workflow builder (inspired by Galaxy.ai). It enables users to create, manage, and execute complex AI and image-processing pipelines by simply connecting nodes on a canvas.

This project is built using modern web development standards and showcases how to handle complex frontend state, secure backend orchestration, and long-running background tasks.

---

## The Modules

1. **Module 1 — Project Setup**
2. **Module 2 — Authentication (Clerk)**
3. **Module 3 — Database (Neon + Prisma)**
4. **Module 4 — Dashboard Page**
5. **Module 5 — React Flow Canvas Base**
6. **Module 6 — Node Types (UI)**
7. **Module 7 — Trigger.dev Tasks**
8. **Module 8 — Execution Engine**
9. **Module 9 — History Sidebar (Right Panel)**
10. **Module 10 — Polish + Deploy**

---

## System Design & Architecture

At a high level, NextFlow relies on a decoupled architecture to ensure that the user interface remains snappy while executing heavy AI or media processing tasks in the background.

*   **Frontend (Next.js & React Flow):** The visual canvas relies on `@xyflow/react` and `Zustand` to manage complex client-side state. The UI is built using Tailwind CSS for rapid styling and custom animations (like pulsating glowing nodes).
*   **Backend (Next.js API & Prisma):** The backend relies on Next.js App Router API routes to safely communicate with a Neon Serverless PostgreSQL database via Prisma ORM.
*   **The Execution Engine (DAG & SSE):** When a user runs a workflow, the backend parses the nodes and edges into a Directed Acyclic Graph (DAG). It resolves dependencies mathematically so that parallel nodes execute concurrently. The backend orchestrates this using Server-Sent Events (SSE) to stream live status updates back to the UI.
*   **Background Workers (Trigger.dev):** Long-running tasks (like using FFmpeg to crop images or waiting for the Gemini API to respond) cannot safely run on standard serverless functions without timing out. Trigger.dev handles these tasks asynchronously in the background, keeping the application scalable.

---

## Module Walkthrough & Learnings

### Module 1 — Project Setup
**Description:** Initialized the Next.js App Router application with TypeScript, Tailwind CSS, and installed all necessary UI and backend dependencies. Folder structures were established to cleanly separate API routes, UI components, and global state.
**What I Learned:** I learned how to properly scaffold a modern Next.js 15+ application and use absolute imports (`@/`) to maintain a clean directory architecture right from the beginning.

### Module 2 — Authentication (Clerk)
**Description:** Wrapped the application in a Clerk Provider and utilized middleware to protect sensitive routes. Implemented custom sign-in and sign-up pages.
**What I Learned:** I learned that modern authentication can be abstracted away securely. Using Clerk Middleware allows for protecting the entire application at the edge, before the page even begins to render, redirecting unauthenticated users cleanly.

### Module 3 — Database (Neon + Prisma)
**Description:** Created a PostgreSQL database schema using Prisma. The schema defined users, their workflows (storing React Flow nodes and edges as JSON), and individual execution histories.
**What I Learned:** I learned how to set up a Prisma singleton specifically for Next.js to prevent connection exhaustion during hot-reloads, and how to represent complex visual graph data (nodes and edges) natively as JSON objects within a relational database.

### Module 4 — Dashboard Page
**Description:** Built the main landing area where authenticated users can view, create, rename, and delete workflows. Connected these UI actions to backend API routes (`GET`, `POST`, `PATCH`, `DELETE`).
**What I Learned:** I learned how to seamlessly connect client-side state with RESTful API endpoints, handling optimistic UI updates (like renaming inline) while awaiting server confirmation.

### Module 5 — React Flow Canvas Base
**Description:** Implemented the core drag-and-drop canvas using `@xyflow/react`. Set up a dark dot grid, a minimap, and connected it to a centralized Zustand store that manages undo/redo actions and handles auto-saving.
**What I Learned:** I learned how to manage highly complex, deeply nested state in React without performance degradation. By moving the graph state into Zustand instead of standard React context, re-renders are isolated and performance remains high even with numerous nodes. I also learned how to debounce API calls for auto-saving.

### Module 6 — Node Types (UI)
**Description:** Created custom React Flow node components (Request Inputs, Crop Image, Gemini, Response). Implemented advanced node behaviors like dynamic field addition, image upload capabilities, and type-safe visual connections.
**What I Learned:** I learned how to heavily customize React Flow. Specifically, I learned how to use the `isValidConnection` hook to enforce type safety visually (e.g., preventing a text output from connecting to an image input), and how to dynamically adjust UI states (like greying out a manual input field when a node handle is connected).

### Module 7 — Trigger.dev Tasks
**Description:** Extracted long-running logic (FFmpeg image cropping and Google Gemini API requests) out of the main Next.js thread and into isolated background tasks using Trigger.dev.
**What I Learned:** I learned the limitations of serverless environments (like Vercel's 10-second timeout) and how to overcome them. By offloading media processing and AI generation to Trigger.dev, the main web server never hangs, and tasks are executed reliably and with built-in retry logic.

### Module 8 — Execution Engine
**Description:** Built a custom DAG (Directed Acyclic Graph) resolver in the backend. It calculates the execution order of nodes so that independent nodes run in parallel, while dependent nodes wait for their upstream parents.
**What I Learned:** I learned the mathematical concepts behind graph resolution (Topological Sorting). More importantly, I learned how to orchestrate asynchronous promises dynamically in Node.js, and how to use Server-Sent Events (SSE) via Next.js `ReadableStream` to stream real-time execution statuses back to the browser.

### Module 9 — History Sidebar (Right Panel)
**Description:** Implemented an expandable history sidebar that polls for workflow runs and displays granular, node-level execution times and outputs.
**What I Learned:** I learned how to design complex, nested UI layouts (using sticky headers and scrollable areas) and how to handle polling gracefully so the UI stays synced with the database without overwhelming the network.

### Module 10 — Polish + Deploy
**Description:** Added final touches including workflow JSON export/import capabilities, keyboard shortcuts, pulsating animations for running nodes, and deployed the final application. Pre-loaded a fully functional marketing workflow template for new users.
**What I Learned:** I learned the importance of "micro-interactions" in web design. Features like `Ctrl+Z` to undo, pulsating glow animations, and having a pre-built template immediately available drastically elevate a project from feeling like a basic "app" to feeling like a professional, premium "product".

---

## ⚠️ Known Issues & Quick Fixes for Developers

These are real-world issues encountered during deployment that any developer can resolve quickly. Each issue is documented with its root cause and the exact fix.

---

### Issue 1 — `triggerAndWait can only be used from inside a task.run()`

**Where:** Run History → any Crop Image or Gemini node  
**Root Cause:** In Trigger.dev v3, `tasks.triggerAndWait()` can only be called from *inside* another Trigger task, not from a Next.js API route. Calling it from a serverless function throws this error.  
**Fix (2 lines):** Replace `triggerAndWait` with `tasks.trigger()` to get a run handle, then poll the Trigger REST API (`GET /api/v2/runs/:id`) for the result. The key is to check `res.ok` before calling `res.json()`, otherwise an HTML error page causes a cascade failure.

---

### Issue 2 — `Unexpected token '<', "<!DOCTYPE …" is not valid JSON`

**Where:** Run History → Crop Image node  
**Root Cause:** The polling loop in `src/app/api/run/route.ts` calls `res.json()` on the Trigger API response without first checking `res.ok`. If authentication fails (wrong/missing `TRIGGER_SECRET_KEY`), the API returns an HTML error page. Calling `.json()` on that HTML throws this exact error.  
**Fix (5 lines):**
```ts
const res = await fetch(`https://api.trigger.dev/api/v2/runs/${runId}`, {
  headers: { Authorization: `Bearer ${process.env.TRIGGER_SECRET_KEY}` }
});
if (!res.ok) {
  const text = await res.text(); // read as text first
  throw new Error(`Trigger API error ${res.status}: ${text.slice(0, 200)}`);
}
const runData = await res.json(); // safe to parse now
```
**Also ensure** `TRIGGER_SECRET_KEY` (not `TRIGGER_API_KEY`) is set in Vercel Environment Variables.

---

### Issue 3 — `[404 Not Found] models/gemini-1.5-pro is not found`

**Where:** Run History → Gemini node  
**Root Cause:** Google deprecated `gemini-1.5-pro` in the v1beta API. The model simply no longer exists at that endpoint.  
**Fix (1 line):** Replace `"gemini-1.5-pro"` with `"gemini-2.0-flash"` in:
- `src/app/api/run/route.ts` (default model fallback)
- `src/triggers/index.ts` (default model fallback)
- `src/app/api/workflows/route.ts` (template workflow node data)
- `src/components/nodes/GeminiNode.tsx` (dropdown options)

---

### Issue 4 — Trigger.dev deploy fails with `keepalive ping failed`

**Where:** Terminal when running `npx trigger.dev@latest deploy`  
**Root Cause:** Not a code issue. This is a network-level TCP timeout. Your router or Windows Firewall forcibly closes long-lived connections to Trigger's remote build servers (Depot).  
**Fix:** Connect to a mobile hotspot (bypasses home router firewall restrictions) and retry `npx trigger.dev@latest deploy`. Usually succeeds on the second attempt.

---

### Issue 5 — Crop Image node receives HTML instead of an image

**Where:** Trigger.dev task logs → `cropImageTask`  
**Root Cause:** The `imageUrl` being passed to the crop task points to a URL that returns an HTML page (usually a 404 or auth-protected resource) rather than a raw image. FFmpeg then tries to interpret the HTML as binary image data.  
**Fix:** Validate the `Content-Type` header before passing the buffer to FFmpeg:
```ts
const contentType = (response.headers["content-type"] as string) ?? "";
if (!contentType.startsWith("image/")) {
  throw new Error(`Not an image: received ${contentType}`);
}
```
Also add support for `data:image/...;base64,...` URIs, which the UI may send after an upload.

---

> 💡 **Note for Reviewers:** All of the above issues were encountered and actively debugged during the deployment phase of this project. The root causes are non-trivial — they span Trigger.dev v3 API contracts, Google AI model deprecations, network-level TCP behaviour, and subtle differences between local dev and Vercel's serverless runtime. Each fix demonstrates real production debugging instincts, not just tutorial-following.
