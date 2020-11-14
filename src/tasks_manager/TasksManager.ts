import {InternalTask, Task, TaskManagerConfig} from "./types";
import merge from 'lodash.merge';
import {DEFAULT_TASKS_MANAGER_CONFIG} from "./constants";
import {EventEmitter} from "events";
import {TASK_MANAGER_ERROR, TASK_MANAGER_EVENT} from "./enums";
import {convertTaskToExternalFormat} from "./utils";
import {CError} from "../errors";

export class TasksManager<TaskArgumentType = any, TaskResultType = any, TaskContextType = any> {

    private readonly __config: TaskManagerConfig;
    private readonly __tasks_queue: InternalTask<TaskArgumentType, TaskResultType, TaskContextType>[];
    private readonly __active_tasks: InternalTask<TaskArgumentType, TaskResultType, TaskContextType>[];
    private __task_id_counter: number;
    private readonly __emitter: EventEmitter;
    private __enabled: boolean;

    public constructor( config?: Partial<TaskManagerConfig>, task_handler?: ( arg: TaskArgumentType ) => Promise<TaskResultType> ) {

        this.__config = merge({}, DEFAULT_TASKS_MANAGER_CONFIG, config);
        this.__tasks_queue = [];
        this.__active_tasks = [];
        this.__task_id_counter = 0;
        this.__emitter = new EventEmitter();
        this.__enabled = true;
        if ( task_handler ) {
            this.taskHandler = task_handler;
        }

    }

    public exec(
        arg: TaskArgumentType,
        context?: TaskContextType,
        abort_callback?: ( task: Task<TaskArgumentType, TaskResultType, TaskContextType>, reason: Error ) => void
    ): Promise<TaskResultType> {
        return new Promise( ( resolve, reject ) => {

            if ( this.__tasks_queue.length >= this.config.max_queue_size ) {
                reject( new CError( TASK_MANAGER_ERROR.TASK_ADDING_ERROR, `You can't add new task, because queue max size is reached` ) );
            }

            const task: InternalTask<TaskArgumentType, TaskResultType, TaskContextType> = {
                id: ++this.__task_id_counter,
                argument: arg,
                abort_callback: abort_callback || null,
                resolve_callback: resolve,
                reject_callback: reject,
                context: context || {} as any,
                queued_at: new Date(),
                started_at: null,
                completed_at: null,
                result: null,
                error: null,
            };

            this.__tasks_queue.push( task );

            this.__emitter.emit( TASK_MANAGER_EVENT.TASK_QUEUED, convertTaskToExternalFormat( task ) );

            this.__tryToExecTasks();

        } );
    }

    public taskHandler( arg: TaskArgumentType, context: TaskContextType ): Promise<TaskResultType> {
        throw new Error( `Task run callback is not set. Please pass callback in constructor, or overwrite TasksManager.prototype.taskHandler method` );
    }

    public enable(): void {
        this.__enabled = true;
        this.__tryToExecTasks();
    }

    public disable(): void {
        this.__enabled = false;
    }

    public get queued_tasks_count(): number {
        return this.__tasks_queue.length;
    }

    public get active_tasks_count(): number {
        return this.__active_tasks.length;
    }

    public get config(): TaskManagerConfig {
        return this.__config;
    }

    public get events(): EventEmitter {
        return this.__emitter;
    }

    public get enabled(): boolean {
        return this.__enabled;
    }

    private __tryToExecTasks(): void {

        if ( !this.__enabled ) {
            return;
        }

        if ( this.__active_tasks.length >= this.__config.concurrency ) {
            return;
        }

        const new_tasks_count = this.__config.concurrency - this.__active_tasks.length;

        const next_tasks = this.__tasks_queue.splice( 0, new_tasks_count );
        this.__active_tasks.push( ...next_tasks );

        for ( const task of next_tasks ) {
            setTimeout( () => {
                this.__execTask( task );
            }, 0 );
        }

    }

    private __execTask( task: InternalTask<TaskArgumentType, TaskResultType, TaskContextType> ): void {
        try {

            this.__emitter.emit( TASK_MANAGER_EVENT.TASK_STARTING, convertTaskToExternalFormat( task ) );

            let timer: null | number = null;

            if ( typeof this.__config.task_max_execution_time === "number" ) {

                timer = setTimeout( () => {

                    if ( task.completed_at ) {
                        return;
                    }

                    task.error = new CError( TASK_MANAGER_ERROR.TASK_TIMEOUT_ERROR, `Task execution timeout` );

                    this.__abortTask( task, task.error );

                    this.__finalizeTask( task );

                }, this.__config.task_max_execution_time );

            }

            this.taskHandler.call( task.context, task.argument, task.context )
                .then( result => {

                    task.result = result;
                    task.resolve_callback( result );

                } )
                .catch( error => {

                    task.error = error;
                    task.reject_callback( error );

                } )
                .finally( () => {

                    if ( timer ) {
                        clearTimeout( timer );
                    }

                    this.__finalizeTask( task );

                } );

        }
        catch ( error ) {
            this.__emitter.emit(
                TASK_MANAGER_EVENT.ERROR,
                new CError( TASK_MANAGER_ERROR.TASK_EXECUTION_ERROR, error ),
                convertTaskToExternalFormat( task ),
            )
        }
    }

    private __finalizeTask( task: InternalTask<TaskArgumentType, TaskResultType, TaskContextType> ): void {

        if ( task.completed_at ) {
            return;
        }

        task.completed_at = new Date();

        this.__emitter.emit( TASK_MANAGER_EVENT.TASK_COMPLETED, convertTaskToExternalFormat( task ) );

        const task_index = this.__active_tasks.findIndex( t => t.id === task.id );

        if ( task_index === -1 ) {
            this.__emitter.emit(
                TASK_MANAGER_EVENT.ERROR,
                new CError( TASK_MANAGER_ERROR.UNEXPECTED, `Something went wrong during task deletion from active tasks list` ),
                convertTaskToExternalFormat( task ),
            )
        }
        else {
            this.__active_tasks.splice( task_index, 1 );
        }

        this.__tryToExecTasks();

    }

    private __abortTask( task: InternalTask<TaskArgumentType, TaskResultType, TaskContextType>, reason: Error ): void {

        if ( !task.abort_callback ) {
            return;
        }

        try {

            task.abort_callback.call( task.context, task, reason );

        }
        catch ( error ) {
            this.__emitter.emit(
                TASK_MANAGER_EVENT.ERROR,
                new CError( TASK_MANAGER_ERROR.TASK_ABORTING_ERROR, `Unable to abort task` ),
                convertTaskToExternalFormat( task ),
            )
        }

    }

}
