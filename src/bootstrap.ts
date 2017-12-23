import { readFileSync } from 'fs';
import * as url from 'url';
import * as http2 from 'http2';
import * as os from 'os';

// const networkInterfaces = os.networkInterfaces();
// for (let key in networkInterfaces) {
// 	const networkInterface = networkInterfaces[key];

// 	if (networkInterface.find(n => !n.internal)) {
// 	}
// }

import { MicroServiceProxy } from './MicroServiceProxy';
import { ResponseContent } from './ResponseContent';

import {
	console,
	API_MAP,
	API_MAP_SYMBOL,
	MODULE_NAME_SYMBOL,
	SERVICE_VERSION_SYMBOL,
	SERVER_PORT_SYMBOL,
	REQ_URL_CACHE_SYMBOL,
	ApiUrlMatcher,
	CENTER_PORT,
	CONSTRUCTOR_PARAMS,
	SERVICE_TOKEN,
	SERVICE_METHOD
} from './const';
import { debug } from 'util';
const {
	HTTP2_HEADER_PATH,
	HTTP2_HEADER_STATUS,
	HTTP2_HEADER_CONTENT_TYPE
} = http2.constants;

export async function bootstrap(ServiceConstructor: new (...args) => any) {
	const constructor_params: MicroServiceProxy<any>[] =
		ServiceConstructor[CONSTRUCTOR_PARAMS];
	const module_name: string = ServiceConstructor[MODULE_NAME_SYMBOL];
	const server_port: number = ServiceConstructor[SERVER_PORT_SYMBOL];
	const service_version: string = ServiceConstructor[SERVICE_VERSION_SYMBOL];

	// 建立自己的服务节点，用于为其它中心节点提供直连服务
	const server = http2.createServer();

	// 将数据服务注入到constructor_params中，初始化远程依赖代理服务
	const params = constructor_params.map(constructor_param => {
		return constructor_param.proxy_obj;
	});

	// 初始化项目
	const service = new ServiceConstructor(...params);

	const api_map: API_MAP = new Map();
	{
		// 从原型链上一层层剥下API_MAP
		let cur_service_proto = service;
		while (cur_service_proto[API_MAP_SYMBOL]) {
			const _api_map: API_MAP = cur_service_proto[API_MAP_SYMBOL];
			for (let [fun_name, api_info_list] of _api_map) {
				if (!api_map.has(fun_name)) {
					api_map.set(fun_name, api_info_list);
				}
			}
			cur_service_proto = Object.getPrototypeOf(cur_service_proto);
		}
	}

	server.on('request', generateRequestHandle(service, api_map));
	server.on('request', generateChildServiceHandle(service));
	server.listen(
		{
			port: server_port,
			host: 'fe80::21b3:c398:f634:9270'
		},
		() => {
			const server_address_info = server.address();
			console.flag('server_address_info', server_address_info);

			// 与中心服务进行连接，提供外部数据服务
			var is_connected = false;
			var retry_times = 0;
			function connectToCenterServer() {
				const clientSession = http2.connect(
					`https://localhost:${CENTER_PORT}`,
					{
						ca: readFileSync(__dirname + '/pem/localhost-cert.pem')
					}
				);
				clientSession.setTimeout(Number.MAX_SAFE_INTEGER);
				clientSession.on('connect', () => {
					clientSession.rstStream;
					console.success('连接成功');
					is_connected = true;
					retry_times = 0;
					console.log('发送节点注册');
					const req = clientSession.request({
						[HTTP2_HEADER_PATH]: '/',
						token: SERVICE_TOKEN,
						method: SERVICE_METHOD.REIGSTER,
						register_module_name: module_name,
						register_server_host: server_address_info.address,
						register_server_family: server_address_info.family,
						register_server_port: server_address_info.port,
						register_service_version: service_version
					});

					var rawData = '';
					req.on('data', chunk => (rawData += chunk));
					req.on('end', () => {
						if (rawData === SERVICE_TOKEN) {
							console.success('服务注册成功');
						} else {
							console.error('服务注册失败', rawData);
						}
					});
					req.end();

					// 连接依赖节点
					constructor_params.forEach(constructor_param => {
						console.flag('连接依赖节点',
							constructor_params[MODULE_NAME_SYMBOL],
							constructor_params[SERVICE_VERSION_SYMBOL]);
						constructor_param.link(clientSession);
					});
				});

				// clientSession.on(
				// 	'stream',
				// 	async (stream, headers, flags, rawHeaders) => {
				// 		try {
				// 			console.log('stream', headers, rawHeaders);
				// 			const req: http2.Http2ServerRequest = new http2[
				// 				'Http2ServerRequest'
				// 			](stream, headers, undefined, rawHeaders);
				// 			const res: http2.Http2ServerResponse = new http2[
				// 				'Http2ServerResponse'
				// 			](stream);
				// 			return await onServerRequest(req, res);
				// 		} catch (err) {
				// 			console.error(err);
				// 		}
				// 	}
				// );
				clientSession.on('close', () => {
					var second = 1;
					const log_line = () => {
						console.line(
							is_connected ? '连接断开' : '连接失败',
							second ? `${second}s后进行重连。` : '重连中……',
							retry_times ? `已重连${retry_times}次` : ''
						);
						second -= 0.1;
						second = parseFloat(second.toFixed(1));
						if (second < 0) {
							retry_times += 1;
							connectToCenterServer();
							clearInterval(ti);
						}
					};
					var ti = setInterval(log_line, 100);
					log_line();
				});
			}
			connectToCenterServer();
		}
	);
}
function generateRequestHandle(service, api_map: Map<string, any>) {
	const onServerRequest = async (
		req: http2.Http2ServerRequest,
		res: http2.Http2ServerResponse
	) => {
		if (
			!req.headers[HTTP2_HEADER_PATH] ||
			req.headers[HTTP2_HEADER_PATH] === '/'
		) {
			return;
		}
		const url_info = (req[REQ_URL_CACHE_SYMBOL] = url.parse(req.headers[
			HTTP2_HEADER_PATH
		] as string));
		const req_path = url_info.pathname;

		const t = console.time(req.method, req_path);
		try {
			for (let [fun_name, api_info_list] of api_map.entries()) {
				for (let { matcher, arg_hander_list } of api_info_list) {
					let match_res;
					try {
						match_res = await matcher(req_path, req);
					} catch (err) {
						console.warn(fun_name, '的匹配器异常', err);
					}

					if (match_res) {
						let res_body;
						console.flag('call', fun_name);
						try {
							const args = await Promise.all(
								arg_hander_list.map(arg_hander =>
									arg_hander(req)
								)
							);
							res_body = await service[fun_name](...args);
						} catch (err) {
							res.statusCode = err.code || 500;
						}
						if (res_body instanceof ResponseContent) {
							res.setHeader('Content-Type', res_body.type);
							res.setHeader('charset', res_body.charset);
							res.statusCode = res_body.statusCode;
							// res.stream.respond({
							// 	[HTTP2_HEADER_CONTENT_TYPE]: res_body.type,
							// 	[HTTP2_HEADER_STATUS]: res_body.statusCode
							// });
							console.log(res.getHeaders());
							res.end(res_body.body);
						} else {
							res.end(res_body);
						}
						return;
					}
				}
			}
			res.statusCode = 502;
			res.end('zzZZZ!no found');
		} catch (err) {
			console.error(err);
		} finally {
			console.timeEnd(t);
		}
	};
	return onServerRequest;
}

function generateChildServiceHandle(service) {
	const onServerRequest = async (
		req: http2.Http2ServerRequest,
		res: http2.Http2ServerResponse
	) => {
		if (req.headers.method !== SERVICE_METHOD.RPC_SERVICE) {
			return;
		}
		const { rpc_type, prop_name } = req.headers as { [k: string]: string };
		const t = console.time(req.method, rpc_type, prop_name);
		try {
			const get_body = () => {
				return new Promise((resolve, reject) => {
					var cache_json = '';
					debugger;
					req.stream.on('data', (...args) => {
						console.flag('stream data', args);
					});
					req.stream.on('end', (...args) => {
						console.flag('stream end', args);
					});
					req.on('push', chunk => {
						console.flag('push', chunk + '');
					});
					req.on('data', (...args) => {
						console.flag('req data', args);
						cache_json += args[0];
					});
					req.on('end', () => {
						try {
							console.flag('cache_json', cache_json);
							resolve(JSON.parse(cache_json));
						} catch (err) {
							reject(err);
						}
					});
					req.on('error', reject);
				});
			};
			if (rpc_type === 'call') {
				const args: any = await get_body();
				console.log('args', args);
				res.stream.respond({
					status: 'success'
				});
				res.end(JSON.stringify(await service[prop_name](...args)));
			} else if (rpc_type === 'get') {
				res.stream.respond({
					status: 'success'
				});
				res.end(JSON.stringify(await service[prop_name]));
			} else if (rpc_type === 'set') {
				service[prop_name] = await get_body();
			} else {
				res.stream.respond({
					status: 'error'
				});
				res.end(new TypeError(`BAD type:"${rpc_type}"`).stack);
			}
		} catch (err) {
			console.error(err);
			res.stream.respond({
				status: 'error'
			});
			res.end(JSON.stringify(err.stack));
		} finally {
			console.timeEnd(t);
		}
	};
	return onServerRequest;
}