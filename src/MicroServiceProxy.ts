import {
	MODULE_NAME_SYMBOL,
	SERVICE_VERSION_SYMBOL,
	IS_PROXY_OBJECT
} from './const';
import * as http2 from 'http2';

export const COPY_ABLE_OBJECT_SYMBOL = Symbol.for('copy_able_object');
export const link_symbol = Symbol('link');
export const getObjectProxy_symbol = Symbol('getObjectProxy');
export const getProxy_symbol = Symbol('getProxy');
// export const getProxy_symbol = Symbol('getProxy');
import { RPCObjectManager } from './RPCObject';

export class MicroServiceProxy<T extends Function> {
	proxy_obj = {} as T;
	rpc_object_manager = new RPCObjectManager();
	constructor(public Constructor: T) {
		this[MODULE_NAME_SYMBOL] = Constructor[MODULE_NAME_SYMBOL];
		this[SERVICE_VERSION_SYMBOL] = Constructor[SERVICE_VERSION_SYMBOL];
		Object.setPrototypeOf(this.proxy_obj, Constructor.prototype);
		this.proxy_obj = new Proxy({} as T, {
			getPrototypeOf(target) {
				return Constructor.prototype;
			},
			get(target, key: string) {
				const descriptor: PropertyDescriptor = Object.getOwnPropertyDescriptor(
					target,
					key
				);
				if (descriptor) {
					if ('value' in descriptor) {
						const res = descriptor.value;
						if (res instanceof Object) {
							return;
						}
					}
					if (target[key] instanceof Function) {
						return (...args) => {
							const proxyed_args = [];
							for (let arg of args) {
								proxyed_args.push(this.getProxy(arg));
							}
						};
					}
				} else {
					return undefined;
				}
			}
		});
	}
	// getClassProxy<T extends object>(Constructor: any) {
	// 	// const ins: T = new MicroServiceProxy(Constructor) as any;
	// 	// return new Proxy(ins, MicroServiceProxy.proxyHandler);
	// 	return this.getObjectProxy(Object.create(Constructor.prototype));
	// }
	link(server:http2.Http2Server) {
		
	}
	getObjectProxy<T extends object>(obj: T) {
		obj[IS_PROXY_OBJECT] = 1;
		return new Proxy(obj, {}) as T;
	}
	getProxy(obj: any) {
		if (obj instanceof Object) {
			let simple_obj_type;
			const obj_proto = Object.getPrototypeOf(obj);
			const SIMPLE_OBJECT = this.rpc_object_manager.SIMPLE_OBJECT_MAP.get(
				obj_proto
			);
			if (SIMPLE_OBJECT) {
				return {
					type: SIMPLE_OBJECT.type,
					value: SIMPLE_OBJECT.stringify(obj.constructor, obj)
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
