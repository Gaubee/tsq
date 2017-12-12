import { A } from './A.service';
export declare class B {
    a: A;
    constructor(a: A);
    callA(name: string): Promise<void>;
}
