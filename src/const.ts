import * as http2 from 'http2';
import * as deasync from 'deasync'
import { Console } from 'console-pro';
export const console = new Console();
export const API_MAP_SYMBOL = Symbol.for('API_MAP');
export const API_PATH_SYMBOL = Symbol.for('api_path');
export const MODULE_NAME_SYMBOL = Symbol.for('module_name');
export const SERVICE_VERSION_SYMBOL = Symbol.for('service_version');
export const SERVER_PORT_SYMBOL = Symbol.for('server_port');
export const CONSTRUCTOR_PARAMS = Symbol.for('constructor_params');

export type ApiUrlMatcher = (
	url: string,
	req: http2.Http2ServerRequest
) => boolean | Promise<boolean> | object | Promise<object>;
export type ArgHandler = (req: http2.Http2ServerRequest) => any;
export type API_MAP = Map<
	string,
	Array<{ matcher: ApiUrlMatcher; arg_hander_list: ArgHandler[] }>
	>;
export const CENTER_PORT = 8443;
export const SERVICE_TOKEN = 'gaubee service net';
export enum SERVICE_METHOD {
	REIGSTER = '#REGISTER#',
	QUERY_MODULE = '#QUERY_MODULE#',
	RPC_SERVICE = '#RPC_SERVICE#'
}
export const noop = () => { };

export const REQ_URL_CACHE_SYMBOL = Symbol('url');
export const REQ_QUERY_CACHE_SYMBOL = Symbol('query');
export const REQ_PARAMS_CACHE_SYMBOL = Symbol('params');
export const REQ_BODY_CACHE_SYMBOL = Symbol('body');

export const IS_PROXY_OBJECT = '#@@PROXY_OBJECT@@#';

export function errorWrapper(source_fun) {
	return function (...args) {
		try {
			const res = source_fun.apply(this, args);
			if (res instanceof Promise) {
				return res.catch(err => {
					console.error(err);
				});
			}
			return res;
		} catch (err) {
			console.error(err);
		}
	};
}
export function errorWrapperDec(target, name, des: PropertyDescriptor) {
	des.value = errorWrapper(des.value);
	return des;
}
export const AsyncFunction = (async () => { }).constructor
export function waitPromise<T = any>(p: Promise<T>) {
	var done = false;
	var has_error = false;
	var res;
	p.then(d => { done = true, res = d }).catch(e => { has_error = true, res = e })
	deasync.loopWhile(() => !(done || has_error));
	if (has_error) {
		throw res;
	} else {
		return res;
	}
}


import * as os from 'os';
const networkInterfaces = os.networkInterfaces();
let __useable_net_address: os.NetworkInterfaceInfo;
for (let key in networkInterfaces) {
	const networkInterface = networkInterfaces[key];
	__useable_net_address = networkInterface.find(n => !n.internal)

}
export const DEFAULT_NET_ADDRESS = __useable_net_address ? __useable_net_address.address : '0.0.0.0'