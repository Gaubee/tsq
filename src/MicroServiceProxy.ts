import {
	MODULE_NAME_SYMBOL,
	SERVICE_VERSION_SYMBOL,
	IS_PROXY_OBJECT,
	SERVICE_TOKEN,
	SERVICE_METHOD,
	errorWrapperDec,
	errorWrapper,
	AsyncFunction,
	waitPromise,
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
import { sessionRequest } from './lib/Http2Helper';

const get_body = (req: http2.ClientHttp2Stream) => {
	return new Promise((resolve, reject) => {
		var json_cache = '';
		req.on('data', chunk => {
			json_cache += chunk;
		});
		req.on('end', () => {
			try {
				console.flag('json_cache', json_cache);
				resolve(JSON.parse(json_cache));
			} catch (err) {
				reject(err);
			}
		});
	});
};

export class MicroServiceProxy<T extends Function> {
	proxy_obj = {} as T;
	proxy_prop_caller: { [key: string]: Function } = {};
	proxy_prop_getter: { [key: string]: Function } = {};
	proxy_prop_setter: { [key: string]: Function } = {};
	rpc_object_manager = new RPCObjectManager();
	events = new EventEmitter();
	constructor(public Constructor: T) {
		const module_name = (this[MODULE_NAME_SYMBOL] =
			Constructor[MODULE_NAME_SYMBOL]);
		const service_version = (this[SERVICE_VERSION_SYMBOL] =
			Constructor[SERVICE_VERSION_SYMBOL]);
		// Object.setPrototypeOf(this.proxy_obj, Constructor.prototype);
		// 遍历原型链，获取对象的所有方法与属性，进行预先编译
		const proto = this.getProto(Constructor.prototype);
		const g = console.group(
			`预编译代理对象[${module_name} ${service_version}]的调用函数`
		);
		for (let key in proto) {
			if (key === 'constructor') {
				continue;
			}
			const des = proto[key];
			if (des.value instanceof Function) {
				console.flag('fun', key);
				this.proxy_prop_caller[key] = this._generateCaller(key);
			} else if (des.value instanceof AsyncFunction) {
				console.flag('afun', key);
				this.proxy_prop_caller[key] = this._generateAsyncCaller(key);
			} else {
				console.flag('prop', key);
				this.proxy_prop_getter[key] = this._generateGetter(key);
				this.proxy_prop_setter[key] = this._generateSetter(key);
			}
		}
		console.groupEnd(g, '预编译完成');

		this.proxy_obj = new Proxy({} as T, {
			getPrototypeOf(target) {
				return Constructor.prototype;
			},
			get: (target, key: string) => {
				if (key in this.proxy_prop_caller) {
					return this.proxy_prop_caller[key];
				}
				if (!(key in this.proxy_prop_getter)) {
					this.proxy_prop_getter[key] = this._generateGetter(key);
				}
				return this.proxy_prop_getter[key]();
			},
			set: (target, key: string, value: any) => {
				if (!(key in this.proxy_prop_setter)) {
					this.proxy_prop_setter[key] = this._generateSetter(key);
				}
				this.proxy_prop_setter[key](value);
				return true;
			}
		});
	}
	getProto(source, end = Object.prototype) {
		const proto = Object.getOwnPropertyDescriptors(source);
		while (true) {
			const _proto_ = Object.getPrototypeOf(source);
			if (!_proto_ || _proto_ === end) {
				break;
			}
			Object.setPrototypeOf(
				proto,
				Object.getOwnPropertyDescriptors(_proto_)
			);
			source = _proto_;
		}
		return proto;
	}

	private _generateCaller(key: string) {
		return (...args) => {
			const proxyed_args = [];
			for (let arg of args) {
				// proxyed_args.push(this.getProxy(arg));
				proxyed_args.push(arg);
			}
			const send_req = async () => {
				const req = sessionRequest(
					this._child_session,
					{
						method: SERVICE_METHOD.RPC_SERVICE,
						rpc_type: 'call',
						prop_name: key
					},
					{
						body: proxyed_args,
						method: 'POST'
					}
				);
				const headers = await req.headersPromiseOut.promise;
				console.flag('headers', headers);
				if (headers.status === 'success') {
					return req.jsonBodyPromise;
				} else {
					throw req.jsonBodyPromise;
				}
			};
			if (!this._linked) {
				const wg = console.group('等待【依赖服务】重连', `call ${key}`);
				waitPromise(this.getLinkPromise());
				console.groupEnd(wg, '【依赖服务】重连成功');
			}
			return waitPromise(send_req());
		};
	}
	private _generateAsyncCaller(key: string) {
		return async (...args) => {
			const proxyed_args = [];
			for (let arg of args) {
				// proxyed_args.push(this.getProxy(arg));
				proxyed_args.push(arg);
			}
			const send_req = async () => {
				const req = sessionRequest(
					this._child_session,
					{
						method: SERVICE_METHOD.RPC_SERVICE,
						rpc_type: 'call',
						prop_name: key
					},
					{
						body: proxyed_args,
						method: 'POST'
					}
				);
				const headers = await req.headersPromiseOut.promise;
				console.flag('headers', headers);
				if (headers.status === 'success') {
					return req.jsonBodyPromise;
				} else {
					throw req.jsonBodyPromise;
				}
			};
			if (!this._linked) {
				const wg = console.group('等待【依赖服务】重连', `call ${key}`);
				await this.getLinkPromise();
				console.groupEnd(wg, '【依赖服务】重连成功');
			}
			return send_req();
		};
	}
	private _generateGetter(key: string) {
		return async () => {
			const send_req = async () => {
				const req = sessionRequest(this._child_session, {
					method: SERVICE_METHOD.RPC_SERVICE,
					rpc_type: 'get',
					prop_name: key
				});
				const headers = await req.headersPromiseOut.promise;
				if (headers.status === 'success') {
					return req.jsonBodyPromise;
				} else {
					throw req.jsonBodyPromise;
				}
			};
			if (!this._linked) {
				const wg = console.group('等待【依赖服务】重连', `get ${key}`);
				await this.getLinkPromise();
				console.groupEnd(wg, '【依赖服务】重连成功');
			}
			return send_req();
		};
	}
	private _generateSetter(key: string) {
		return async (val: any) => {
			const send_req = async () => {
				const req = sessionRequest(
					this._child_session,
					{
						method: SERVICE_METHOD.RPC_SERVICE,
						rpc_type: 'set',
						prop_name: key
					},
					{
						method: 'POST',
						body: val //this.getProxy(val)
					}
				);
				const headers = await req.headersPromiseOut.promise;
				if (headers.status === 'success') {
					return req.jsonBodyPromise;
				} else {
					throw req.jsonBodyPromise;
				}
			};
			if (!this._linked) {
				const wg = console.group('等待【依赖服务】重连', `set ${key}`);
				await this.getLinkPromise();
				console.groupEnd(wg, '【依赖服务】重连成功');
			}
			return send_req();
		};
	}
	// getClassProxy<T extends object>(Constructor: any) {
	// 	// const ins: T = new MicroServiceProxy(Constructor) as any;
	// 	// return new Proxy(ins, MicroServiceProxy.proxyHandler);
	// 	return this.getObjectProxy(Object.create(Constructor.prototype));
	// }
	private _main_session: http2.ClientHttp2Session;
	private _child_session: http2.ClientHttp2Session;
	private _linking: PromiseOut<void>;
	set linking(v) {
		if (this._linking !== v && v) {
			if (this._linking) {
				this._linking.reject();
			}
			this._linking = v;
			this.events.emit('set-link', v);
		}
	}
	get linking() {
		return this._linking;
	}
	private _linked = false;
	@errorWrapperDec
	getLinkPromise() {
		const waiter = new PromiseOut<void>();
		var listend = false;
		var listen_fun = (linking: PromiseOut<void>) => {
			linking.promise.then(waiter.resolve).catch(retry);
		};
		const retry = () => {
			if (!listend) {
				listend = true;
				this.events.on('set-link', listen_fun);
			}
		};
		if (this.linking) {
			this.linking.promise.then(waiter.resolve).catch(retry);
		} else {
			retry();
		}
		return waiter.promise.then(() => {
			if (listend) {
				this.events.removeListener('set-link', listen_fun);
			}
		});
	}
	link(session: http2.ClientHttp2Session) {
		this._main_session = session;
		this._linked = false;
		const linking = (this.linking = new PromiseOut());
		const reLink = errorWrapper(() => {
			if (linking == this.linking) {
				// link函数没有被外部再次调用
				return this.link(this._main_session);
			} else {
				console.info('由于外部调用，当前流程的自动重连中断');
			}
		});
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

		req.on('error', linking.reject);
		return this.linking.promise.catch(async err => {
			const RECONNECT_DELAY = 1000;
			console.error(
				'查询主节点失败',
				err,
				`${(RECONNECT_DELAY / 1000).toFixed(1)}s后进行重试`
			);
			await new Promise(cb => setTimeout(cb, RECONNECT_DELAY));
			return reLink();
		});
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
