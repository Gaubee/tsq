"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PromiseOut {
    constructor(promiseCon = Promise) {
        this.promise = new promiseCon((_resolve, _reject) => {
            this.resolve = _resolve;
            this.reject = _reject;
        });
    }
}
exports.PromiseOut = PromiseOut;
//# sourceMappingURL=PromiseExtends.js.map