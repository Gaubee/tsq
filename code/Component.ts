function Component(service_version: string, server_port?: number) {
	return function(ServiceConstructor: new (...args) => any) {
		// console.log(ServiceConstructor);
		// return ServiceConstructor;
	};
}
export function RPCObjectParse(target: any, name: string) {
	target.zzz = name;
}
interface QAQ {
	toJSON(): Object;
}

@Component('qaq')
class A implements QAQ {
	toJSON() {
		return {};
	}
}

@Component('qaq')
class B {
	constructor(public a: A, aa: A) {}

	@RPCObjectParse
	static fromJSON() {
		return {};
	}
}
