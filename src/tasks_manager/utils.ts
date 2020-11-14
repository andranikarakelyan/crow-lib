import {InternalTask, Task} from "./types";

export function convertTaskToExternalFormat<TaskArgumentType, TaskResultType, TaskContextType>( task: InternalTask<TaskArgumentType, TaskResultType, TaskContextType> ): Task<TaskArgumentType, TaskResultType, TaskContextType> {

    return {
        id: task.id,
        context: task.context,
        argument: task.argument,
        queued_at: task.queued_at,
        started_at: task.started_at,
        completed_at: task.completed_at,
        error: task.error,
        result: task.result,
    };

}
