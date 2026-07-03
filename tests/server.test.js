import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createServer } from "../src/server.js";
import { createTaskStore } from "../src/task-store.js";

async function withServer(run) {
  const workspace = await mkdtemp(path.join(tmpdir(), "ai-workflow-demo-"));
  const store = createTaskStore(path.join(workspace, "tasks.json"));
  const server = createServer({ store });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await rm(workspace, { recursive: true, force: true });
  }
}

test("POST /tasks 创建任务，GET /tasks 返回任务列表", async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "创建任务 API" })
    });

    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.title, "创建任务 API");
    assert.equal(created.status, "todo");

    const listResponse = await fetch(`${baseUrl}/tasks`);
    assert.equal(listResponse.status, 200);
    const tasks = await listResponse.json();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, created.id);
  });
});

test("PATCH /tasks/:id/status 修改任务状态", async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "推进状态" })
    });
    const created = await createResponse.json();

    const updateResponse = await fetch(`${baseUrl}/tasks/${created.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done" })
    });

    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.status, "done");
  });
});
