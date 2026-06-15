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

## 🚧 Issues I Faced During Deployment

This is a personal account of the real problems I ran into while trying to get this project live. I am documenting them honestly because I think debugging is just as important a skill as building.

---

### Issue 1 — `triggerAndWait can only be used from inside a task.run()`

I was calling `tasks.triggerAndWait()` directly from a Next.js API route. Turns out in Trigger.dev v3 this function can **only** be called from inside another background task — not from a serverless function. I kept getting this error on every Crop Image and Gemini node run. I partially worked around it but the execution flow still needs more debugging time.

---

### Issue 2 — `Unexpected token '<', "<!DOCTYPE …" is not valid JSON`

This one confused me for a long time. The error looks like a JSON parsing error but it was actually coming from the Trigger.dev polling code. When the API returned an HTML error page (due to auth issues), my code was calling `.json()` directly on it — which then crashed. I added a `res.ok` guard but the issue kept surfacing on different nodes.

---

### Issue 3 — `[404 Not Found] models/gemini-1.5-pro is not found`

I set up the Gemini node to use `gemini-1.5-pro` which was the standard model when I started the project. By the time I deployed, Google had deprecated it. I updated all references to `gemini-2.0-flash` but due to time constraints I could not fully verify if the end-to-end flow works on the live deployment.

---

### Issue 4 — Trigger.dev deploy failing with `keepalive ping failed`

Every time I ran `npx trigger.dev@latest deploy`, the build would get 80% done and then crash with a network timeout. My home Wi-Fi was dropping the TCP connection to Trigger's remote build servers. I eventually got it to work by switching to a mobile hotspot but it was a frustrating blocker.

---

> 📝 **Note:** I ran out of time to fully resolve all of the above on the live deployment. The core architecture — the canvas, DAG execution engine, SSE streaming, authentication, and database — all work correctly. The remaining issues are specifically around the Trigger.dev cloud integration and the live API environment. Given more time (or a stable network), these would be straightforward to resolve.

