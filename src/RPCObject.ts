export type RegisteredRPCObjectConfig = {
	Con: new (...args) => object;
	type: string;
	stringify: (Con: new (...args) => object, obj: object) => any;
	parse: (Con: new (...args) => object, val: any) => object;
};
export class RPCObjectManager {
	static REGISTERED_RPC_OBJ = new Set<RegisteredRPCObjectConfig>();
	simple_object_map = new WeakMap<
		object,
		{
			type: string;
			stringify: (obj: object, Con: new (...args) => object) => any;
			parse: (val: any, Con: new (...args) => object) => object;
		}
	>();
	simple_object_name_map = new Map<string, object>();

	constructor() {
		for (let [type, prop] of SIMPLE_OBJECT_NAME_MAP.entries()) {
			this.simple_object_name_map.set(type, prop);
			this.simple_object_map.set(prop, SIMPLE_OBJECT_MAP.get(prop));
		}
		for (let registered_rpc_obj of RPCObjectManager.REGISTERED_RPC_OBJ) {
			const { Con, type, stringify, parse } = registered_rpc_obj;

			this.simple_object_map.set(registered_rpc_obj.Con.prototype, {
				type,
				stringify,
				parse
			});
			this.simple_object_name_map.set(type, Con.prototype);
		}
	}
	static registerRPCObject(
		type: string,
		Con: RegisteredRPCObjectConfig['Con'],
		parse: RegisteredRPCObjectConfig['parse'],
		stringify: RegisteredRPCObjectConfig['stringify']
	) {
		Con[RPC_OBJECT_SYMBOL] = {
			type
		};
		RPCObjectManager.REGISTERED_RPC_OBJ.add({
			type,
			Con,
			parse,
			stringify
		});
	}
}

const RPC_OBJECT_SYMBOL = Symbol('RPC-OBJECT');
const RPC_OBJECT_STRINGIFY_SYMBOL = Symbol('RPC-OBJECT-stringify');
const RPC_OBJECT_PARSE_SYMBOL = Symbol('RPC-OBJECT-parse');

/* RPCObject修饰器 */

export interface RPCObject {
	(name: string): (Con: any) => any;
	stringify: (target: any, name: string) => any;
	parse: (target: any, name: string) => any;
}
export const RPCObject = function RPCObjectDecorator(type: string) {
	return function(Con: any) {
		let stringify;
		if (Con[RPC_OBJECT_STRINGIFY_SYMBOL]) {
			stringify = Con[Con[RPC_OBJECT_STRINGIFY_SYMBOL]];
		} else if (Con.prototype[RPC_OBJECT_STRINGIFY_SYMBOL]) {
			stringify =
				Con.prototype[Con.prototype[RPC_OBJECT_STRINGIFY_SYMBOL]];
		}
		if (!(stringify instanceof Function)) {
			stringify = v => v;
		}

		let parse;
		if (Con[RPC_OBJECT_PARSE_SYMBOL]) {
			parse = Con[Con[RPC_OBJECT_PARSE_SYMBOL]];
		} else if (Con.prototype[RPC_OBJECT_PARSE_SYMBOL]) {
			parse = Con.prototype[Con.prototype[RPC_OBJECT_PARSE_SYMBOL]];
		}
		if (!(parse instanceof Function)) {
			parse = (v, Con) => Object.create(v, Con.prototype);
		}

		RPCObjectManager.registerRPCObject(type, Con, parse, stringify);
	};
} as RPCObject;
RPCObject.stringify = function RPCObjectStringify(target: any, name: string) {
	target[RPC_OBJECT_STRINGIFY_SYMBOL] = name;
};
RPCObject.parse = function RPCObjectParse(target: any, name: string) {
	target[RPC_OBJECT_PARSE_SYMBOL] = name;
};

// 加入通用的JSON的解析
@RPCObject('json')
class NormalJSON {
	@RPCObject.parse
	static fromJSON(json_str) {
		return JSON.parse(json_str);
	}
	@RPCObject.stringify
	static toJSON(obj) {
		return JSON.stringify(obj);
	}
}

// 普通类型的解析
const normal_stringify = <T extends object>(
	obj: T,
	Con: new (...args) => T
) => {
	return obj.valueOf();
};
const normal_parse = <T extends object>(val: any, Con: new (...args) => T) => {
	return new Con(val);
};
const error_stringify = <T extends Error>(err: T, Con: new (...args) => T) => {
	const keys = Object.getOwnPropertyNames(err);
	const res = {} as any;
	for (let k of keys) {
		res[k] = err[k];
	}
	return res;
};
const error_parse = <T extends Error>(val: any, Con: new (...args) => T) => {
	const res = new Con(val.message) as T;
	for (let k in val) {
		res[k] = val[k];
	}
	return res;
};
const numberarray_stringify = <T extends object>(
	obj: T,
	Con: new (...args) => T
) => {
	return Array.prototype.slice.call(obj);
};
const numberarray_parse = <T extends object>(
	Con: new (...args) => T,
	val: any
) => {
	return new Con(val);
};

const SIMPLE_OBJECT_MAP = new WeakMap<
	object,
	{
		type: string;
		stringify: (obj: object, Con: new (...args) => object) => any;
		parse: (val: any, Con: new (...args) => object) => object;
	}
>();
const SIMPLE_OBJECT_NAME_MAP = new Map<string, object>();

const normal_object_list = [
	Number,
	String,
	Boolean,
	Date
	// RegExp,
];
const error_object_list = [
	Error,
	EvalError,
	RangeError,
	ReferenceError,
	SyntaxError,
	TypeError,
	URIError
];
const numberarray_object_list = [
	Float32Array,
	Float64Array,
	Uint8ClampedArray,
	Uint8Array,
	Uint16Array,
	Uint32Array,
	Int16Array,
	Int32Array
];
const simple_object_list = [
	...normal_object_list,
	Buffer,
	...error_object_list,
	...numberarray_object_list
];
for (let simple_obj of simple_object_list) {
	const type = simple_obj.name;

	let stringify: any = normal_stringify;
	let parse: any = normal_parse;
	if (type.endsWith('Error')) {
		stringify = error_stringify;
		parse = error_parse;
	} else if (type.endsWith('Array') || simple_obj === Buffer) {
		stringify = numberarray_stringify;
		parse = numberarray_parse;
	}
	SIMPLE_OBJECT_MAP.set(simple_obj.prototype, {
		type,
		stringify,
		parse
	});
	SIMPLE_OBJECT_NAME_MAP.set(type, simple_obj.prototype);
}
