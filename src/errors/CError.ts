export class CError extends Error {

    public code: string;

    public constructor( code: string, error: Error | string ) {

        super( typeof error === "string" ? error : error.message );
        this.code = code;

    }

}
