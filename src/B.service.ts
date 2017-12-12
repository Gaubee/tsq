import { MicroService, App } from './MicroService';
import { console } from './const';
import { exportAPI } from './exportAPI';
import { A } from './A.service';

@MicroService('1.0.0', 802)
export class B {
	constructor(public a: A) {}
	async callA(name: string) {
		const response = await this.a.sayHi(name);
		console.log(response);
	}
}
App.bootstrap(B);
