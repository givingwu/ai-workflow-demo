import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createTaskStore } from "./task-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer({ store }) {
  return http.createServer(async (request, response) => {
    try {
      await routeRequest({ request, response, store });
    } catch (error) {
      sendJson(response, error.message === "任务不存在" ? 404 : 400, {
        error: error.message
      });
    }
  });
}

async function routeRequest({ request, response, store }) {
  const url = new URL(request.url, "http://localhost");

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/tasks") {
    sendJson(response, 200, await store.listTasks());
    return;
  }

  if (request.method === "POST" && url.pathname === "/tasks") {
    const body = await readJson(request);
    const task = await store.createTask(body);
    sendJson(response, 201, task);
    return;
  }

  const statusMatch = url.pathname.match(/^\/tasks\/([^/]+)\/status$/);
  if (request.method === "PATCH" && statusMatch) {
    const body = await readJson(request);
    const task = await store.updateTaskStatus(statusMatch[1], body.status);
    sendJson(response, 200, task);
    return;
  }

  sendJson(response, 404, { error: "接口不存在" });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dataFile = process.env.TASK_DATA_FILE ?? path.join(__dirname, "..", "data", "tasks.json");
  const port = Number(process.env.PORT ?? 3000);
  const server = createServer({ store: createTaskStore(dataFile) });

  server.listen(port, () => {
    console.log(`ai-workflow-demo listening on http://127.0.0.1:${port}`);
  });
}
