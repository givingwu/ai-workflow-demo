import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createTaskStore } from "../src/task-store.js";

test("创建任务时生成默认状态和创建时间", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "ai-workflow-demo-"));
  const store = createTaskStore(path.join(workspace, "tasks.json"));

  try {
    const task = await store.createTask({
      title: "支持创建任务",
      description: "通过 API 创建一个待办任务"
    });

    assert.equal(task.title, "支持创建任务");
    assert.equal(task.description, "通过 API 创建一个待办任务");
    assert.equal(task.status, "todo");
    assert.match(task.id, /^task_/);
    assert.equal(typeof task.createdAt, "string");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("更新任务状态时只接受 todo、doing、done", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "ai-workflow-demo-"));
  const store = createTaskStore(path.join(workspace, "tasks.json"));

  try {
    const task = await store.createTask({ title: "写测试" });
    const updated = await store.updateTaskStatus(task.id, "doing");

    assert.equal(updated.status, "doing");
    await assert.rejects(
      () => store.updateTaskStatus(task.id, "blocked"),
      /状态必须是 todo、doing 或 done/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("任务会写入文件并可被新的 store 读取", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "ai-workflow-demo-"));
  const dataFile = path.join(workspace, "tasks.json");

  try {
    const firstStore = createTaskStore(dataFile);
    await firstStore.createTask({ title: "持久化任务" });

    const secondStore = createTaskStore(dataFile);
    const tasks = await secondStore.listTasks();

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, "持久化任务");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
