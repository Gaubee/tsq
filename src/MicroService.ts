import 'reflect-metadata';
import * as http2 from 'http2';
import {
	console,
	API_MAP_SYMBOL,
	API_PATH_SYMBOL,
	MODULE_NAME_SYMBOL,
	SERVICE_VERSION_SYMBOL,
	SERVER_PORT_SYMBOL,
	CONSTRUCTOR_PARAMS,
	ApiUrlMatcher,
	CENTER_PORT,
	SERVICE_TOKEN
} from './const';
import { bootstrap } from './bootstrap';
import { MicroServiceProxy } from './MicroServiceProxy';

export function MicroService(service_version: string, server_port?: number) {
	return function (ServiceConstructor: new (...args) => any) {
		ServiceConstructor[MODULE_NAME_SYMBOL] = ServiceConstructor.name;
		ServiceConstructor[SERVICE_VERSION_SYMBOL] = service_version;
		ServiceConstructor[SERVER_PORT_SYMBOL] = server_port || getFreePort();
		const classList: Array<new (...args) => any> = Reflect.getMetadata(
			'design:paramtypes',
			ServiceConstructor
		);
		const params = (ServiceConstructor[CONSTRUCTOR_PARAMS] = []);
		if (classList) {
			for (let con of classList) {
				if (!(MODULE_NAME_SYMBOL in con)) {
					throw new TypeError(
						`${con.name} must be MicroService Module in ${ServiceConstructor.name} constructor`
					);
				}
				params.push(new MicroServiceProxy(con));
			}
		}
		return ServiceConstructor;
	};
}
export function Path(url_pre: string) {
	return function (ServiceConstructor: new (...args) => any) {
		ServiceConstructor[API_PATH_SYMBOL] = url_pre;
		return ServiceConstructor;
	};
}


function getFreePort() {
	const s = http2.createServer().listen();
	const port = s.address().port;
	s.close();
	return port;
}
