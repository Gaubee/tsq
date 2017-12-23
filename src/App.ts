import * as net from 'net';
import { readFileSync } from 'fs';
import * as http2 from 'http2';
import FileBase, { filebaseInit } from 'filedase';
export { FileBase };
import {
	console,
	API_MAP_SYMBOL,
	MODULE_NAME_SYMBOL,
	SERVICE_VERSION_SYMBOL,
	SERVER_PORT_SYMBOL,
	CONSTRUCTOR_PARAMS,
	ApiUrlMatcher,
	CENTER_PORT,
	SERVICE_TOKEN,
	SERVICE_METHOD,
	errorWrapper,
	errorWrapperDec
} from './const';
import { PromiseOut } from './lib/PromiseExtends';
import { bootstrap } from './bootstrap';
import { EventEmitter } from 'events';

const {
	HTTP2_HEADER_PATH,
	HTTP2_HEADER_STATUS,
	HTTP2_HEADER_METHOD
} = http2.constants;

export class MicroServiceNode {
	constructor(
		public module_name: string,
		public service_version: string,
		public server_host: string,
		public server_port: number,
		public status: ServiceStatus,
		public moduleSession?: http2.ClientHttp2Session
	) {
		// pool.set(module_name, this);
	}
	events = new EventEmitter();
	private _connecting = new PromiseOut<http2.ClientHttp2Session>();
	get connecting() {
		return this._connecting;
	}
	set connecting(v) {
		if (this._connecting !== v && v) {
			if (this._connecting) {
				this._connecting.reject();
			}
			this._connecting = v;
			this.events.emit('set-connecting', v);
		}
	}
	getConnectingPromise() {
		const waiter = new PromiseOut<http2.ClientHttp2Session>();
		const retry = () => {
			this.events.once(
				'set-connecting',
				(connecting: PromiseOut<http2.ClientHttp2Session>) => {
					connecting.promise.then(waiter.resolve).catch(retry);
				}
			);
			return waiter.promise;
		};
		if (this.connecting) {
			this.connecting.promise.then(waiter.resolve).catch(retry);
		} else {
			retry();
		}
		return waiter.promise;
	}
}
export enum ServiceStatus {
	disabled = -1,
	offline = 0,
	online = 1,
	connecting = 2
}
export class App {
	MODULE_DB: FileBase = (() => {
		const db = filebaseInit('MicroServiceDB');
		db.just_in_memory = true;
		db.id_key = Symbol('ID');
		return db;
	})();
	MODULE_DB_TABLE_NAME = 'M';
	MODULE_KEY_SYMBOL = Symbol('MODULE_KEY');
	constructor() {
		const server = http2.createSecureServer({
			key: readFileSync(__dirname + '/pem/localhost-privkey.pem'),
			cert: readFileSync(__dirname + '/pem/localhost-cert.pem')
		});
		server.on('error', err => console.error(err));
		server.on('socketError', err => console.error(err));
		server.on('stream', (stream, headers) => {
			if (headers.token === SERVICE_TOKEN) {
				console.log(headers);
				if (headers.method === SERVICE_METHOD.REIGSTER) {
					this.registerMicroServiceNode(stream, headers);
					/*.catch(
						console.error.bind(console, 'REGISTER ERROR')
					);*/
				} else if (headers.method === SERVICE_METHOD.QUERY_MODULE) {
					this.queryModule(stream, headers);
				}
			}
		});
		server.on('request', (req, res) => {
			if (req.headers.token) {
				return;
			}
			this.handleRequest(req, res);
			/*.catch(
				console.error.bind(console, 'REQUEST ERROR')
			);*/
		});

		server.listen(CENTER_PORT);
		console.success(`服务启动在${CENTER_PORT}端口上`);
		// 控制台指令服务
		this.cli();
	}
	@errorWrapperDec
	async registerMicroServiceNode(
		stream: http2.ServerHttp2Stream,
		headers: http2.IncomingHttpHeaders
	) {
		const { MODULE_DB, MODULE_DB_TABLE_NAME, MODULE_KEY_SYMBOL } = this;

		const {
			register_module_name,
			register_server_host,
			register_server_port,
			register_service_version
		} = headers;
		const module_name = register_module_name as string;
		const server_host = register_server_host as string;
		const server_port = parseInt(register_server_port as string);
		const service_version = register_service_version as string;
		const module_key = `[${module_name}](V:${service_version})|[${server_host}]:${server_port}`;
		console.flag('REGISTER MODULE', module_key);

		if (MODULE_DB.find_by_id(MODULE_DB_TABLE_NAME, module_key)) {
			return;
		} else {
			// 尝试替换模块
			const cached_module_list: MicroServiceNode[] = MODULE_DB.find_list(
				MODULE_DB_TABLE_NAME,
				{
					module_name,
					server_host,
					service_version
				}
			);
			if (cached_module_list.length) {
				let replacer_module: MicroServiceNode;
				// 不可用的模块
				const disabled_module_list = cached_module_list.filter(
					m => m.status === ServiceStatus.disabled
				);
				if (disabled_module_list.length) {
					replacer_module = disabled_module_list[0];
				}
				// 离线状态的模块
				if (!replacer_module) {
					const offline_module_list = cached_module_list.filter(
						m => m.status === ServiceStatus.offline
					);
					if (offline_module_list.length) {
						replacer_module = offline_module_list[0];
					}
				}
				// 连接中状态的模块
				if (!replacer_module) {
					const connecting_module_list = cached_module_list.filter(
						m => m.status === ServiceStatus.connecting
					);
					let all_len = connecting_module_list.length;
					if (all_len) {
						replacer_module = await (() => {
							// 等待一个连接失败的实例对象
							const po = new PromiseOut<MicroServiceNode>();
							for (let connecting_module of connecting_module_list) {
								connecting_module.connecting.promise
									.then(() => {
										all_len -= 1;
										if (all_len === 0) {
											po.resolve(); // 全部连接都重连成功，可以用，返回一个空的实例
										}
									})
									.catch(e => po.resolve(connecting_module));
							}
							return po.promise;
						})();
					}
				}
				if (replacer_module) {
					const old_module_key = replacer_module[MODULE_KEY_SYMBOL];
					MODULE_DB.remove(MODULE_DB_TABLE_NAME, old_module_key);
					// 替换模块的端口，让其下次的重连使用新的端口
					replacer_module.server_port = server_port;
					console.flag('replacer_module');
					MODULE_DB.insert(
						MODULE_DB_TABLE_NAME,
						replacer_module,
						module_key
					);
					const g = console.group('模块替换/更新');
					console.flag('OLD', old_module_key);
					console.flag('NEW', module_key);
					console.groupEnd(g);
					return;
				}
			}
		}

		const service_module = new MicroServiceNode(
			module_name,
			service_version,
			server_host,
			server_port,
			ServiceStatus.offline
		);
		service_module[MODULE_KEY_SYMBOL] = module_key;
		MODULE_DB.insert(MODULE_DB_TABLE_NAME, service_module, module_key);

		const RECONNECT_DELAY = 1e3;
		const AUTO_RECONNECT_TIMES = 10;
		let auto_reconnect_times = AUTO_RECONNECT_TIMES;

		const log_register_error = console.error.bind(console, 'REGISTER FAIL');
		function connectMicroServiceNode(action = '注册') {
			const flag_name = console.flagHead(module_name);
			const connecting = service_module.connecting;

			const href = net.isIPv6(service_module.server_host)
				? `http://[${service_module.server_host}]:${service_module.server_port}`
				: `http://${service_module.server_host}:${service_module.server_port}`;
			console.info('子服务', flag_name, `开始${action}`, href);
			// 连接子服务
			const moduleSession = http2.connect(href);
			service_module.status = ServiceStatus.connecting;
			moduleSession.on('connect', () => {
				console.success(`${action}服务成功`, flag_name);
				service_module.status = ServiceStatus.online;
				service_module.moduleSession = moduleSession;
				connecting.resolve(moduleSession);
				if (!stream.destroyed) {
					stream.end(SERVICE_TOKEN);
				}
			});
			async function tryReconnect(status: ServiceStatus) {
				auto_reconnect_times -= 1;
				if (auto_reconnect_times <= 0) {
					console.error(flag_name, '重连次数过多，停止重连');
					MODULE_DB.remove(MODULE_DB_TABLE_NAME, module_key);
					return;
				}
				service_module.status = status;
				service_module.connecting = new PromiseOut();
				console.info(
					flag_name,
					`${(RECONNECT_DELAY / 1000).toFixed(1)}s后进行重连。`
				);
				await new Promise(cb => setTimeout(cb, RECONNECT_DELAY));
				return connectMicroServiceNode('重连').catch(log_register_error);
			}
			moduleSession.on('close', () => {
				console.warn('服务离线', flag_name);
				// 离线模式，不直接移除，考虑http2的链接断开的情况、考虑服务节点重启中的情况
				connecting.reject('close');
				tryReconnect(ServiceStatus.offline);
				// .then(promiseOut.resolve.bind(promiseOut))
				// .catch(promiseOut.reject.bind(promiseOut));
			});
			moduleSession.on('error', err => {
				console.error('服务异常', err);
				connecting.reject(err);
				tryReconnect(ServiceStatus.disabled);
			});
			return connecting.promise;
		}
		connectMicroServiceNode().catch(log_register_error);
	}
	@errorWrapperDec
	async handleRequest(
		req: http2.Http2ServerRequest,
		res: http2.Http2ServerResponse
	) {
		const url_path = req.headers[HTTP2_HEADER_PATH] as string;
		if (!url_path) {
			return;
		}
		const t = console.time(url_path);

		const { MODULE_DB, MODULE_DB_TABLE_NAME, MODULE_KEY_SYMBOL } = this;
		const path_info = url_path.split('/').filter(p => p);
		const registed_module_list = MODULE_DB.find_list<
			MicroServiceNode
		>(MODULE_DB_TABLE_NAME, {
			module_name: path_info[0],
			status: ServiceStatus.online
		});
		// 随机策略
		const registed_module =
			registed_module_list[
				(registed_module_list.length * Math.random()) | 0
			];
		if (registed_module) {
			try {
				registed_module.status !== ServiceStatus.online;
				const moduleSession = await registed_module.getConnectingPromise();
				console.flag(
					'moduleSession === registed_module.moduleSession',
					moduleSession === registed_module.moduleSession
				);

				const proxy_req = registed_module.moduleSession.request({
					...req.headers,
					[HTTP2_HEADER_PATH]: '/' + path_info.slice(1).join('/'),
					token: SERVICE_TOKEN
				});
				proxy_req.on('response', (headers, flags) => {
					console.log('qaq headers', headers, flags);
					const statusCode =
						parseInt(headers[HTTP2_HEADER_STATUS] as string) | 200;
					delete headers[HTTP2_HEADER_STATUS];
					res.writeHead(statusCode, headers);
				});
				proxy_req.pipe(res.stream);
			} catch (err) {
				res.statusCode = 503;
				res.end(
					`MicroService [${registed_module.module_name}] ${ServiceStatus[
						registed_module.status
					]}`
				);
			}
		} else {
			res.writeHead(200, {
				'content-type': 'text/html'
			});
			res.end('<h1>Hello World</h1>');
		}
		console.timeEnd(t);
	}
	@errorWrapperDec
	async queryModule(
		stream: http2.ServerHttp2Stream,
		headers: http2.IncomingHttpHeaders
	) {
		const { MODULE_DB, MODULE_DB_TABLE_NAME, MODULE_KEY_SYMBOL } = this;

		const { module_name, service_version } = headers as {
			[k: string]: string;
		};
		const find_modules = MODULE_DB.find_list(MODULE_DB_TABLE_NAME, {
			module_name
		});
		const version_info = service_version.split('.');
		const match_version_startsWith =
			version_info.slice(0, 2).join('.') + '.';
		const matched_modules = find_modules.filter(m =>
			m.service_version.startsWith(match_version_startsWith)
		);
		// 随机模式
		const matched_module =
			matched_modules[(matched_modules.length * Math.random()) | 0];
		if (matched_module) {
			stream.respond({
				success: 'true',
				module_name: matched_module.module_name,
				server_host: matched_module.server_host,
				server_port: matched_module.server_port,
				service_version: matched_module.service_version
			});
		} else {
			stream.respond({
				success: 'false'
			});
		}
		stream.end();
	}
	@errorWrapperDec
	async cli() {
		const { MODULE_DB, MODULE_DB_TABLE_NAME, MODULE_KEY_SYMBOL } = this;
		await new Promise(cb => setTimeout(cb, 200));
		// console.log('请输入指令：');
		while (true) {
			const command = (await console.getLine('')).trim();
			if (command === 'help') {
				const g = console.group('帮助内容');
				console.flag('ls', '打印当前已经注册的服务列表');
				console.flag('ls SERVICE', '打印指定服务的API');
				console.groupEnd(g);
			} else if (command === 'ls') {
				const g = console.group('模块列表');
				for (let m of MODULE_DB.find_all<MicroServiceNode>(
					MODULE_DB_TABLE_NAME
				)) {
					console.flag(
						m.module_name,
						'版本：',
						m.service_version,
						'端口:',
						m.server_port,
						ServiceStatus[m.status]
					);
				}
				console.groupEnd(g);
			} else {
				console.log(`输入指令：${console.flagHead('help', false)}获取更多帮助`);
			}
		}
	}
	static bootstrap = bootstrap;
}
