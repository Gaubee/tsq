import { MicroService, App, console, GET } from '../src';

@MicroService('1.0.0')
export class A {
	@GET('/hi/:name', ['params.name'])
	@GET('/hi', ['query.name'])
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
