import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const VALID_STATUSES = new Set(["todo", "doing", "done"]);

export function createTaskStore(dataFile) {
  async function readTasks() {
    try {
      const content = await readFile(dataFile, "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async function writeTasks(tasks) {
    await mkdir(path.dirname(dataFile), { recursive: true });
    await writeFile(dataFile, JSON.stringify(tasks, null, 2), "utf8");
  }

  return {
    async listTasks() {
      return readTasks();
    },

    async createTask(input) {
      const title = normalizeRequiredText(input?.title, "任务标题不能为空");
      const description = normalizeOptionalText(input?.description);
      const tasks = await readTasks();
      const now = new Date().toISOString();
      const task = {
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title,
        description,
        status: "todo",
        createdAt: now,
        updatedAt: now
      };

      tasks.push(task);
      await writeTasks(tasks);
      return task;
    },

    async updateTaskStatus(taskId, status) {
      if (!VALID_STATUSES.has(status)) {
        throw new Error("状态必须是 todo、doing 或 done");
      }

      const tasks = await readTasks();
      const task = tasks.find((item) => item.id === taskId);
      if (!task) {
        throw new Error("任务不存在");
      }

      task.status = status;
      task.updatedAt = new Date().toISOString();
      await writeTasks(tasks);
      return task;
    }
  };
}

function normalizeRequiredText(value, message) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }
  return value.trim();
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}
