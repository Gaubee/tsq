export declare class PromiseOut<T> {
    resolve: (value?: T | PromiseLike<T> | undefined) => void;
    reject: (reason?: any) => void;
    promise: Promise<T>;
    constructor(promiseCon?: PromiseConstructor);
}
