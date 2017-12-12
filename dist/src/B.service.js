"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const MicroService_1 = require("./MicroService");
const const_1 = require("./const");
const A_service_1 = require("./A.service");
let B = class B {
    constructor(a) {
        this.a = a;
    }
    async callA(name) {
        const response = await this.a.sayHi(name);
        const_1.console.log(response);
    }
};
B = __decorate([
    MicroService_1.MicroService('1.0.0', 802),
    __metadata("design:paramtypes", [A_service_1.A])
], B);
exports.B = B;
MicroService_1.App.bootstrap(B);
//# sourceMappingURL=B.service.js.map