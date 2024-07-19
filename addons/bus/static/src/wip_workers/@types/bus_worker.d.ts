declare module "BusWorker" {
    export interface NAMESPACES {
        DISPATCHER: "DISPATCHER",
    }

    export interface WorkerContext {
        serverURL: string;
        inDebugMode: boolean;
        currentUID: number | false | undefined;
        currentDB: string | undefined;
        newestStartTs: number;
    }
}
