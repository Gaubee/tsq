export class PromiseOut<T> {
  resolve: (value?: T | PromiseLike<T> | undefined) => void;
  reject: (reason?: any) => void;
  promise: Promise<T>;
  constructor(promiseCon: PromiseConstructor = Promise) {
    this.promise = new promiseCon<T>((_resolve, _reject) => {
      this.resolve = _resolve;
      this.reject = _reject;
    });
  }
}