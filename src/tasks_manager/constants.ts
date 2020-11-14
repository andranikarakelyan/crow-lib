import {TaskManagerConfig} from "./types";

export const DEFAULT_TASKS_MANAGER_CONFIG: TaskManagerConfig = {
    concurrency: 1,
    max_queue_size: 10_000,
    task_max_execution_time: null,
};
