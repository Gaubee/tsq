import { MicroService, App, console, exportAPI, ResponseContent } from '../src';
import { A } from './A.service';

@MicroService('1.0.0')
export class B {
	constructor(public a: A) { }
	@exportAPI('/hi/:name', ['params.name'])
	@exportAPI('/hi', ['query.name'])
	async callA(name: string) {
		return new ResponseContent(`<h1>${await this.a.sayHi(name)}</h1>`, {
			type: ResponseContent.Type.html
		});
	}
	@exportAPI('/add/:a/:b', ['params.a', 'params.b'])
	async add(a: number, b: number) {
		return new ResponseContent(`<h2 style='color:#8b008b'>${this.a.add(a, b)}</h2>`, {
			type: ResponseContent.Type.html
		});
	}
}

if (require.main == module) {
	App.bootstrap(B);
}
