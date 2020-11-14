export interface TaskManagerConfig {
    concurrency: number;
    max_queue_size: number;
    task_max_execution_time: null | number;
}


export interface InternalTask<TaskArgumentType, TaskResultType, TaskContextType> {
    id: number;
    argument: TaskArgumentType;
    abort_callback: null | ( ( task: Task<TaskArgumentType, TaskResultType, TaskContextType>, reason: Error ) => void ),
    resolve_callback: ( result: TaskResultType ) => void;
    reject_callback: ( error: Error ) => void;
    context: TaskContextType
    queued_at: Date;
    started_at: null | Date;
    completed_at: null | Date;
    result: null | TaskResultType;
    error: null | Error;
}

export interface Task<TaskArgumentType, TaskResultType, TaskContextType> {
    id: number;
    argument: TaskArgumentType;
    context: TaskContextType
    queued_at: Date;
    started_at: null | Date;
    completed_at: null | Date;
    result: null | TaskResultType;
    error: null | Error;
}
