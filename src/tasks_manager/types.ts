export interface TaskManagerConfig {
    concurrency: number;
}


export interface InternalTask<TaskArgumentType, TaskResultType> {
    id: number;
    argument: TaskArgumentType;
    resolve_callback: ( result: TaskResultType ) => void;
    reject_callback: ( error: Error ) => void;
}

