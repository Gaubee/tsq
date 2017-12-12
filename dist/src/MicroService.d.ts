/// <reference types="node" />
import * as http2 from 'http2';
import { PromiseOut } from './lib/PromiseExtends';
import { bootstrap } from './bootstrap';
import FileBase from 'filedase';
export { FileBase };
export declare function MicroService(service_version: string, server_port?: number): (ServiceConstructor: new (...args: any[]) => any) => new (...args: any[]) => any;
export declare class MicroServiceNode {
    module_name: string;
    service_version: string;
    server_host: string;
    server_port: number;
    status: ServiceStatus;
    moduleSession: http2.ClientHttp2Session;
    constructor(module_name: string, service_version: string, server_host: string, server_port: number, status: ServiceStatus, moduleSession?: http2.ClientHttp2Session);
    connectingPromiseOut: PromiseOut<http2.ClientHttp2Session>;
    readonly connectingPromise: Promise<http2.ClientHttp2Session>;
}
export declare enum ServiceStatus {
    disabled = -1,
    offline = 0,
    online = 1,
    connecting = 2,
}
export declare class App {
    MODULE_DB: FileBase;
    MODULE_DB_TABLE_NAME: string;
    MODULE_KEY_SYMBOL: symbol;
    constructor();
    registerMicroServiceNode(stream: http2.ServerHttp2Stream, headers: http2.IncomingHttpHeaders): Promise<void>;
    handleRequest(req: http2.Http2ServerRequest, res: http2.Http2ServerResponse): Promise<void>;
    cli(): Promise<void>;
    static bootstrap: typeof bootstrap;
}
