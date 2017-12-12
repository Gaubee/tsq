import * as http2 from 'http2';
import { Console } from 'console-pro';
export const console = new Console();
export const API_MAP_SYMBOL = Symbol.for('API_MAP');
export const MODULE_NAME_SYMBOL = Symbol.for('module_name');
export const SERVICE_VERSION_SYMBOL = Symbol.for('service_version');
export const SERVER_PORT_SYMBOL = Symbol.for('server_port');

export type ApiUrlMatcher = (
	url: string,
	req: http2.Http2ServerRequest
) => boolean | Promise<boolean>;
export type ArgHandler = (req: http2.Http2ServerRequest) => any;
export type API_MAP = Map<
	string,
	Array<{ matcher: ApiUrlMatcher; arg_hander_list: ArgHandler[] }>
>;
export const CENTER_PORT = 8443;
export const SERVICE_TOKEN = 'gaubee service net';
export const noop = () => {};

export const REQ_URL_CACHE_SYMBOL = Symbol('url');
export const REQ_QUERY_CACHE_SYMBOL = Symbol('query');
export const REQ_PARAMS_CACHE_SYMBOL = Symbol('params');
export const REQ_BODY_CACHE_SYMBOL = Symbol('body');
