import {
	MODULE_NAME_SYMBOL,
	SERVICE_VERSION_SYMBOL,
	IS_PROXY_OBJECT,
	SERVICE_TOKEN,
	SERVICE_METHOD,
	console
} from './const';
import * as http2 from 'http2';
import * as net from 'net';
import { EventEmitter } from 'events';
const { HTTP2_HEADER_METHOD } = http2.constants;

export const COPY_ABLE_OBJECT_SYMBOL = Symbol.for('copy_able_object');
export const link_symbol = Symbol('link');
export const getObjectProxy_symbol = Symbol('getObjectProxy');
export const getProxy_symbol = Symbol('getProxy');
// export const getProxy_symbol = Symbol('getProxy');
import { RPCObjectManager } from './RPCObject';
import { PromiseOut } from './lib/PromiseExtends';

const get_body = (req: http2.ClientHttp2Stream) => {
	return new Promise((resolve, reject) => {
		var json_cache = '';
		req.on('data', chunk => {
			json_cache += chunk;
		});
		req.on('end', () => {
			try {
				resolve(JSON.parse(json_cache));
			} catch (err) {
				reject(err);
			}
		});
	});
};

export class MicroServiceProxy<T extends Function> {
	proxy_obj = {} as T;
	rpc_object_manager = new RPCObjectManager();
	events = new EventEmitter();
	constructor(public Constructor: T) {
		this[MODULE_NAME_SYMBOL] = Constructor[MODULE_NAME_SYMBOL];
		this[SERVICE_VERSION_SYMBOL] = Constructor[SERVICE_VERSION_SYMBOL];
		Object.setPrototypeOf(this.proxy_obj, Constructor.prototype);
		this.proxy_obj = new Proxy({} as T, {
			getPrototypeOf(target) {
				return Constructor.prototype;
			},
			get: (target, key: string) => {
				const descriptor: PropertyDescriptor = Object.getOwnPropertyDescriptor(
					Constructor.prototype,
					key
				);
				console.flag('get', key, descriptor);
				if (descriptor) {
					if (descriptor.value instanceof Function) {
						return (...args) => {
							const proxyed_args = [];
							for (let arg of args) {
								// proxyed_args.push(this.getProxy(arg));
								proxyed_args.push(arg);
							}
							const send_req = () => {
								const req = this._child_session.request({
									[HTTP2_HEADER_METHOD]: 'POST',
									method: SERVICE_METHOD.RPC_SERVICE,
									rpc_type: 'call',
									prop_name: key
								});
								console.flag(
									'JSON.stringify(proxyed_args)',
									JSON.stringify(proxyed_args)
								);
								// req.push(JSON.stringify(proxyed_args));
								req.end(JSON.stringify(proxyed_args));
								return new Promise((resolve, reject) => {
									req.on('stream', (...args) => {
										console.log(
											'fuck stream response',
											args
										);
									});
									req.on('response', headers => {
										console.log('cb response', headers);
										if (headers.status === 'success') {
											get_body(req)
												.then(resolve)
												.catch(reject);
										} else {
											get_body(req)
												.then(reject)
												.catch(reject);
										}
									});
								});
							};
							if (this._linked) {
								return send_req();
							} else {
								return this.getLinkPromise().then(send_req);
							}
						};
					} else {
						return new Promise((resolve, reject) => {
							const req = this._child_session.request({
								method: SERVICE_METHOD.RPC_SERVICE,
								rpc_type: 'get',
								prop_name: key
							});
							req.end();
							req.on('response', headers => {
								if (headers.status === 'success') {
									get_body(req)
										.then(resolve)
										.catch(reject);
								} else {
									get_body(req)
										.then(reject)
										.catch(reject);
								}
							});
						});
					}
				} else {
					return undefined;
				}
			},
			set: (target, key: string, value: any) => {
				console.flag('set', key);
				const req = this._child_session.request({
					method: SERVICE_METHOD.RPC_SERVICE,
					rpc_type: 'set',
					prop_name: key
				});
				req.end(JSON.stringify(value));
				return true;
			}
		});
	}
	// getClassProxy<T extends object>(Constructor: any) {
	// 	// const ins: T = new MicroServiceProxy(Constructor) as any;
	// 	// return new Proxy(ins, MicroServiceProxy.proxyHandler);
	// 	return this.getObjectProxy(Object.create(Constructor.prototype));
	// }
	private _main_session: http2.ClientHttp2Session;
	private _child_session: http2.ClientHttp2Session;
	private __linking: PromiseOut<void>;
	private set _linking(v) {
		this.__linking = v;
		this.events.emit('set-link', v);
	}
	private get _linking() {
		return this.__linking;
	}
	private _linked = false;
	getLinkPromise() {
		const retry = () => {
			const waiter = new PromiseOut<any>();
			this.events.once('set-link', (linking: PromiseOut<void>) => {
				linking.promise.then(waiter.resolve).catch(retry);
			});
			return waiter.promise;
		};
		if (this._linking) {
			return this._linking.promise.catch(retry);
		} else {
			return retry();
		}
	}
	link(session: http2.ClientHttp2Session) {
		this._main_session = session;
		this._linked = false;
		const linking = (this._linking = new PromiseOut());
		const reLink = () => {
			if (linking == this._linking) {
				// link函数没有被外部再次调用
				return this.link(this._main_session);
			} else {
				console.info('由于外部调用，当前流程的自动重连中断');
			}
		};
		// 询问主节点，依赖的地址
		const req = session.request({
			method: SERVICE_METHOD.QUERY_MODULE,
			module_name: this[MODULE_NAME_SYMBOL],
			service_version: this[SERVICE_VERSION_SYMBOL],
			token: SERVICE_TOKEN
		});
		req.on('response', headers => {
			if (headers.success === 'true') {
				const {
					module_name,
					server_host,
					server_port,
					service_version
				} = headers as {
					[k: string]: string;
				};
				if (service_version !== this[SERVICE_VERSION_SYMBOL]) {
					console.warn('版本号不对齐，请注意更新');
					console.flag('需要版本', this[SERVICE_VERSION_SYMBOL]);
					console.flag('当前版本', service_version);
				}

				const flag_name = console.flagHead(
					`${module_name} ${service_version}`
				);
				const href = net.isIPv6(server_host)
					? `http://[${server_host}]:${server_port}`
					: `http://${server_host}:${server_port}`;
				console.info('依赖服务', flag_name, `开始桥接`, href);

				const childSession = (this._child_session = http2.connect(
					href
				));
				childSession.on('connect', () => {
					console.success(`服务桥接成功`, flag_name);
					this._linked = true;
					linking.resolve();
				});
				const RECONNECT_DELAY = 500;
				const tryReconnect = async () => {
					this._linked = false;
					console.info(
						flag_name,
						`${(RECONNECT_DELAY / 1000).toFixed(1)}s后进行重连。`
					);
					await new Promise(cb => setTimeout(cb, RECONNECT_DELAY));
					return reLink();
				};
				childSession.on('close', () => {
					console.warn('服务离线', flag_name);
					tryReconnect();
				});
				childSession.on('error', err => {
					console.error('服务异常', err);
					tryReconnect();
				});
			} else {
				const flag_name = console.flagHead(
					`${this[MODULE_NAME_SYMBOL]} ${this[
						SERVICE_VERSION_SYMBOL
					]}`
				);

				console.error('找不到依赖服务', flag_name);
				linking.reject();
			}
		});
		req.on('error', async err => {
			const RECONNECT_DELAY = 1000;
			console.error(
				'查询主节点失败',
				err,
				`${(RECONNECT_DELAY / 1000).toFixed(1)}s后进行重试`
			);
			await new Promise(cb => setTimeout(cb, RECONNECT_DELAY));
			return reLink();
		});
		return this._linking.promise;
	}
	private _askDependent() {}
	getObjectProxy<T extends object>(obj: T) {
		obj[IS_PROXY_OBJECT] = 1;
		return new Proxy(obj, {}) as T;
	}
	getProxy(obj: any) {
		if (obj instanceof Object) {
			let simple_obj_type;
			const obj_proto = Object.getPrototypeOf(obj);
			const simple_object = this.rpc_object_manager.simple_object_map.get(
				obj_proto
			);
			if (simple_object) {
				return {
					type: simple_object.type,
					value: simple_object.stringify(obj.constructor, obj)
				};
			}
			if (obj[COPY_ABLE_OBJECT_SYMBOL]) {
				return {
					type: 'json',
					value: JSON.stringify(obj)
				};
			}
			// 不可复制，使用代理引用
			return {
				type: 'proxy',
				value: this.getObjectProxy(obj)
			};
		} else {
			return {
				type: typeof obj,
				value: obj
			};
		}
	}

	start() {}
}
