# TSQ

这是一个实验性的框架，使用了一些实验性的API。
但很多概念还是有待商榷的。不过可以通过做减法来使用那些稳定的概念。

**重度依赖TypeScript，目的是为了实现Angular一样的依赖注入。**

## 为什么要用TypeScript

在团队开发中，有一个不可避免的沟通成本。API调用是否正确？API破坏性更改引起的涟漪效应是否有全部解决？
使用TypeScript的强类型约束与编译，可以用来解决这些问题。

## 为什么要做依赖注入

在微服务开发中。如若直接写RPC的调用，TypeScript的强类型约束无法直接在两个代码库之间进行推断。
使用依赖注入的话，开发者**不需要关心RPC的调用**，靠着TypeScript的代码智能提示与类型检测，能写出安全的数据传输。
使得代码完全与框架脱离关系。

<!-- ![image](https://user-images.githubusercontent.com/2151644/34319862-325cbde2-e827-11e7-99d6-60f7f39518f1.png) -->
如下代码：
[B.service.ts](https://github.com/Gaubee/tsq/blob/7d896ff4c8d429b730ea2ca862cc63996eeb6102/test/B.service.ts)
```ts
export class B {
	constructor(public a: A) { }

	async callA(name: string) {
		return await this.a.sayHi(name);
	}

	add(a: number, b: number) {
		return this.a.add(a, b);
	}
}
```
B模块依赖与A模块，在调用A模块的时候，可以以最原始的方式去调用A模块的实例的方法，异步方法，甚至是同步方法，而这A模块的服务运行在另外一个进程中，可同时供养于其它服务。

## DEMO

建议安装[ts-node](https://www.npmjs.com/package/ts-node)

### 第一步： 启动中央服务

```shell
ts-node test/center.service.ts
```

### 第二步： 启动A服务

```shell
ts-node test/A.service.ts
```

### 第三步： 启动B服务

```shell
ts-node test/B.service.ts
```

> PS: 以上三步可以以任意的顺序启动。互相依赖的服务在有一端断开后都会自动重连。