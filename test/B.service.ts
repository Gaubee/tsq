import { MicroService, Path, App, console, GET, ResponseContent } from '../src';
import { A } from './A.service';

@Path('qaq')
@MicroService('1.0.0')
export class B {
	constructor(public a: A) { }
	@GET('/hi/:name', ['params.name'])
	@GET('/hi', ['query.name'])
	async callA(name: string) {
		return ResponseContent.html(`<h1>${await this.a.sayHi(name)}</h1>`);
	}
	@GET('/add/:a/:b', ['params.a', 'params.b'])
	add(a: number, b: number) {
		return ResponseContent.html(`<h2 style='color:#8b008b'>${this.a.add(a, b)}</h2>`);
	}
}

if (require.main == module) {
	App.bootstrap(B);
}
