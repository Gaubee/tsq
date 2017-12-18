import { MicroService, App, console, exportAPI } from '../src';

@MicroService('1.0.0')
export class A {
	@exportAPI('/hi/:name', ['params.name'])
	@exportAPI('/hi', ['query.name'])
	async sayHi(name: string) {
		console.log('Hi', name);
		return '✨' + name + '✨';
	}

	add(a: number, b: number) {
		return a + b;
	}
}
if (require.main == module) {
	App.bootstrap(A);
}
