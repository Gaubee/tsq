import { MicroService, App } from './MicroService';
import { console } from './const';
import { exportAPI } from './exportAPI';

@MicroService('1.0.0')
export class A {
	@exportAPI('/hi/:name', ['params.name'])
	@exportAPI('/hi', ['query.name'])
	async sayHi(name: string) {
		console.log('Hi', name);
		return '✨' + name + '✨';
	}

}
App.bootstrap(A);
