import {InternalTask, TaskManagerConfig} from "./types";
import merge from 'lodash.merge';
import {DEFAULT_TASKS_MANAGER_CONFIG} from "./constants";

export abstract class TasksManager<TaskArgumentType, TaskResultType> {

    private __config: TaskManagerConfig;
    private __tasks_queue: InternalTask<TaskArgumentType, TaskResultType>[];
    private __active_tasks: InternalTask<TaskArgumentType, TaskResultType>[];
    private __task_id_counter: number;

    protected constructor( config?: Partial<TaskManagerConfig> ) {

        this.__config = merge({}, DEFAULT_TASKS_MANAGER_CONFIG, config);
        this.__tasks_queue = [];
        this.__active_tasks = [];
        this.__task_id_counter = 0;
        console.log( "config", this.__config );

    }


    public exec( arg: TaskArgumentType ): Promise<TaskResultType> {
        return new Promise( ( resolve, reject ) => {

            this.__tasks_queue.push( {
                id: ++this.__task_id_counter,
                argument: arg,
                resolve_callback: resolve,
                reject_callback: reject,
            } );

            this.__tryToExecTasks();

        } );
    }

    protected abstract _run( arg: TaskArgumentType ): Promise<TaskResultType>;

    private __tryToExecTasks(): void {

        if ( this.__active_tasks.length >= this.__config.concurrency ) {
            return;
        }

        const new_tasks_count = this.__config.concurrency - this.__active_tasks.length;

        const next_tasks = this.__tasks_queue.splice( 0, new_tasks_count );
        this.__active_tasks.push( ...next_tasks );

        for ( const task of next_tasks ) {
            this.__execTask( task );
        }

    }

    private __execTask( task: InternalTask<TaskArgumentType, TaskResultType> ): void {

        console.log( `${ new Date() }: Active: ${ this.__active_tasks.length }: Task ${ task.id } starting...` );
        this._run( task.argument )
            .then( result => {
                task.resolve_callback( result );
            } )
            .catch( error => {
                task.reject_callback( error );
            } )
            .finally( () => {

                const task_index = this.__active_tasks.findIndex( t => t.id === task.id );

                if ( task_index === -1 ) {
                    //FIXME: Emit error eevent
                }
                else {
                    this.__active_tasks.splice( task_index, 1 );
                }

                console.log( `${ new Date() }: Active: ${ this.__active_tasks.length }: Task ${ task.id } completed` );
                this.__tryToExecTasks();

            } );

    }


}