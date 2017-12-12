/// <reference types="node" />
import * as http2 from 'http2';
export declare const console: any;
export declare const API_MAP_SYMBOL: symbol;
export declare const MODULE_NAME_SYMBOL: symbol;
export declare const SERVICE_VERSION_SYMBOL: symbol;
export declare const SERVER_PORT_SYMBOL: symbol;
export declare type ApiUrlMatcher = (url: string, req: http2.Http2ServerRequest) => boolean | Promise<boolean>;
export declare type ArgHandler = (req: http2.Http2ServerRequest) => any;
export declare type API_MAP = Map<string, Array<{
    matcher: ApiUrlMatcher;
    arg_hander_list: ArgHandler[];
}>>;
export declare const CENTER_PORT = 8443;
export declare const SERVICE_TOKEN = "gaubee service net";
export declare const noop: () => void;
export declare const REQ_URL_CACHE_SYMBOL: symbol;
export declare const REQ_QUERY_CACHE_SYMBOL: symbol;
export declare const REQ_PARAMS_CACHE_SYMBOL: symbol;
export declare const REQ_BODY_CACHE_SYMBOL: symbol;
