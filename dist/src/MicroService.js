"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const http2 = require("http2");
const net = require("net");
const const_1 = require("./const");
const PromiseExtends_1 = require("./lib/PromiseExtends");
const bootstrap_1 = require("./bootstrap");
const filedase_1 = require("filedase");
exports.FileBase = filedase_1.default;
const { HTTP2_HEADER_PATH, HTTP2_HEADER_STATUS } = http2.constants;
function MicroService(service_version, server_port) {
    return function (ServiceConstructor) {
        ServiceConstructor[const_1.MODULE_NAME_SYMBOL] = ServiceConstructor.name;
        ServiceConstructor[const_1.SERVICE_VERSION_SYMBOL] = service_version;
        ServiceConstructor[const_1.SERVER_PORT_SYMBOL] = server_port || getFreePort();
        return ServiceConstructor;
    };
}
exports.MicroService = MicroService;
class MicroServiceNode {
    constructor(module_name, service_version, server_host, server_port, status, moduleSession) {
        this.module_name = module_name;
        this.service_version = service_version;
        this.server_host = server_host;
        this.server_port = server_port;
        this.status = status;
        this.moduleSession = moduleSession;
        this.connectingPromiseOut = new PromiseExtends_1.PromiseOut();
        // pool.set(module_name, this);
    }
    get connectingPromise() {
        return this.connectingPromiseOut.promise;
    }
}
exports.MicroServiceNode = MicroServiceNode;
var ServiceStatus;
(function (ServiceStatus) {
    ServiceStatus[ServiceStatus["disabled"] = -1] = "disabled";
    ServiceStatus[ServiceStatus["offline"] = 0] = "offline";
    ServiceStatus[ServiceStatus["online"] = 1] = "online";
    ServiceStatus[ServiceStatus["connecting"] = 2] = "connecting";
})(ServiceStatus = exports.ServiceStatus || (exports.ServiceStatus = {}));
class App {
    constructor() {
        this.MODULE_DB = (() => {
            const db = filedase_1.filebaseInit('MicroServiceDB');
            db.just_in_memory = true;
            db.id_key = Symbol('ID');
            return db;
        })();
        this.MODULE_DB_TABLE_NAME = 'M';
        this.MODULE_KEY_SYMBOL = Symbol('MODULE_KEY');
        const server = http2.createSecureServer({
            key: fs_1.readFileSync(__dirname + '/pem/localhost-privkey.pem'),
            cert: fs_1.readFileSync(__dirname + '/pem/localhost-cert.pem')
        });
        server.on('error', err => const_1.console.error(err));
        server.on('socketError', err => const_1.console.error(err));
        server.on('stream', (stream, headers) => {
            if (headers.token === const_1.SERVICE_TOKEN) {
                this.registerMicroServiceNode(stream, headers).catch(const_1.console.error.bind(const_1.console, 'REGISTER ERROR'));
            }
        });
        server.on('request', (req, res) => {
            if (req.headers.token) {
                return;
            }
            this.handleRequest(req, res).catch(const_1.console.error.bind(const_1.console, 'REQUEST ERROR'));
        });
        server.listen(const_1.CENTER_PORT);
        const_1.console.success(`服务启动在${const_1.CENTER_PORT}端口上`);
        // 控制台指令服务
        this.cli();
    }
    async registerMicroServiceNode(stream, headers) {
        const { MODULE_DB, MODULE_DB_TABLE_NAME, MODULE_KEY_SYMBOL } = this;
        const { register_module_name, register_server_host, register_server_port, register_service_version } = headers;
        const module_name = register_module_name;
        const server_host = register_server_host;
        const server_port = parseInt(register_server_port);
        const service_version = register_service_version;
        const module_key = `[${module_name}](V:${service_version})|[${server_host}]:${server_port}`;
        const_1.console.flag('REGISTER MODULE', module_key);
        if (MODULE_DB.find_by_id(MODULE_DB_TABLE_NAME, module_key)) {
            return;
        }
        else {
            // 尝试替换模块
            const cached_module_list = MODULE_DB.find_list(MODULE_DB_TABLE_NAME, {
                module_name,
                server_host,
                service_version
            });
            if (cached_module_list.length) {
                let replacer_module;
                // 不可用的模块
                const disabled_module_list = cached_module_list.filter(m => m.status === ServiceStatus.disabled);
                if (disabled_module_list.length) {
                    replacer_module = disabled_module_list[0];
                }
                // 离线状态的模块
                if (!replacer_module) {
                    const offline_module_list = cached_module_list.filter(m => m.status === ServiceStatus.offline);
                    if (offline_module_list.length) {
                        replacer_module = offline_module_list[0];
                    }
                }
                // 连接中状态的模块
                if (!replacer_module) {
                    const connecting_module_list = cached_module_list.filter(m => m.status === ServiceStatus.connecting);
                    let all_len = connecting_module_list.length;
                    if (all_len) {
                        replacer_module = await (() => {
                            // 等待一个连接失败的实例对象
                            const po = new PromiseExtends_1.PromiseOut();
                            for (let connecting_module of connecting_module_list) {
                                connecting_module.connectingPromise
                                    .then(() => {
                                    all_len -= 1;
                                    if (all_len === 0) {
                                        po.resolve(); // 全部连接都重连成功，可以用，返回一个空的实例
                                    }
                                })
                                    .catch(e => po.resolve(connecting_module));
                            }
                            return po.promise;
                        })();
                    }
                }
                if (replacer_module) {
                    const old_module_key = replacer_module[MODULE_KEY_SYMBOL];
                    MODULE_DB.remove(MODULE_DB_TABLE_NAME, old_module_key);
                    // 替换模块的端口，让其下次的重连使用新的端口
                    replacer_module.server_port = server_port;
                    const_1.console.flag('replacer_module');
                    MODULE_DB.insert(MODULE_DB_TABLE_NAME, replacer_module, module_key);
                    const g = const_1.console.group('模块替换/更新');
                    const_1.console.flag('OLD', old_module_key);
                    const_1.console.flag('NEW', module_key);
                    const_1.console.groupEnd(g);
                    return;
                }
            }
        }
        const service_module = new MicroServiceNode(module_name, service_version, server_host, server_port, ServiceStatus.offline);
        service_module[MODULE_KEY_SYMBOL] = module_key;
        MODULE_DB.insert(MODULE_DB_TABLE_NAME, service_module, module_key);
        const RECONNECT_DELAY = 1e3;
        const AUTO_RECONNECT_TIMES = 10;
        let auto_reconnect_times = AUTO_RECONNECT_TIMES;
        const log_register_error = const_1.console.error.bind(const_1.console, 'REGISTER FAIL');
        function connectMicroServiceNode(action = '注册') {
            const flag_name = const_1.console.flagHead(module_name);
            const promiseOut = service_module.connectingPromiseOut;
            const href = net.isIPv6(service_module.server_host)
                ? `http://[${service_module.server_host}]:${service_module.server_port}`
                : `http://${service_module.server_host}:${service_module.server_port}`;
            const_1.console.info('子服务', flag_name, `开始${action}`, href);
            // 连接子服务
            const moduleSession = http2.connect(href);
            service_module.status = ServiceStatus.connecting;
            moduleSession.on('connect', () => {
                const_1.console.success(`${action}服务成功`, flag_name);
                service_module.status = ServiceStatus.online;
                service_module.moduleSession = moduleSession;
                stream.end(const_1.SERVICE_TOKEN);
                promiseOut.resolve(moduleSession);
            });
            async function tryReconnect(status) {
                auto_reconnect_times -= 1;
                if (auto_reconnect_times <= 0) {
                    const_1.console.error(flag_name, '重连次数过多，停止重连');
                    MODULE_DB.remove(MODULE_DB_TABLE_NAME, module_key);
                    return;
                }
                service_module.status = status;
                service_module.connectingPromiseOut = new PromiseExtends_1.PromiseOut();
                const_1.console.info(flag_name, `${(RECONNECT_DELAY / 1000).toFixed(1)}s后进行重连。`);
                await new Promise(cb => setTimeout(cb, RECONNECT_DELAY));
                return connectMicroServiceNode('重连').catch(log_register_error);
            }
            moduleSession.on('close', () => {
                const_1.console.warn('服务离线', flag_name);
                // 离线模式，不直接移除，考虑http2的链接断开的情况、考虑服务节点重启中的情况
                promiseOut.reject('close');
                tryReconnect(ServiceStatus.offline);
                // .then(promiseOut.resolve.bind(promiseOut))
                // .catch(promiseOut.reject.bind(promiseOut));
            });
            moduleSession.on('error', err => {
                const_1.console.error('服务异常', err);
                promiseOut.reject(err);
                tryReconnect(ServiceStatus.disabled);
            });
            return promiseOut.promise;
        }
        connectMicroServiceNode().catch(log_register_error);
    }
    async handleRequest(req, res) {
        const url_path = req.headers[HTTP2_HEADER_PATH];
        const t = const_1.console.time(url_path);
        const { MODULE_DB, MODULE_DB_TABLE_NAME, MODULE_KEY_SYMBOL } = this;
        const path_info = url_path.split('/').filter(p => p);
        const registed_module_list = MODULE_DB.find_list(MODULE_DB_TABLE_NAME, {
            module_name: path_info[0],
            status: ServiceStatus.online
        });
        // 随机策略
        const registed_module = registed_module_list[(registed_module_list.length * Math.random()) | 0];
        if (registed_module) {
            try {
                registed_module.status !== ServiceStatus.online;
                await registed_module.connectingPromise;
                registed_module.moduleSession
                    .request({
                    [HTTP2_HEADER_PATH]: '/' + path_info.slice(1).join('/'),
                    token: const_1.SERVICE_TOKEN
                })
                    .pipe(res.stream);
            }
            catch (err) {
                res.statusCode = 503;
                res.end(`MicroService [${registed_module.module_name}] ${ServiceStatus[registed_module.status]}`);
            }
        }
        else {
            res.writeHead(200, {
                'content-type': 'text/html'
            });
            res.end('<h1>Hello World</h1>');
        }
        const_1.console.timeEnd(t);
    }
    async cli() {
        const { MODULE_DB, MODULE_DB_TABLE_NAME, MODULE_KEY_SYMBOL } = this;
        await new Promise(cb => setTimeout(cb, 200));
        // console.log('请输入指令：');
        while (true) {
            const command = (await const_1.console.getLine('')).trim();
            if (command === 'help') {
                const g = const_1.console.group('帮助内容');
                const_1.console.flag('ls', '打印当前已经注册的服务列表');
                const_1.console.flag('ls SERVICE', '打印指定服务的API');
                const_1.console.groupEnd(g);
            }
            else if (command === 'ls') {
                const g = const_1.console.group('模块列表');
                for (let m of MODULE_DB.find_all(MODULE_DB_TABLE_NAME)) {
                    const_1.console.flag(m.module_name, '版本：', m.service_version, '端口:', m.server_port, ServiceStatus[m.status]);
                }
                const_1.console.groupEnd(g);
            }
            else {
                const_1.console.log(`输入指令：${const_1.console.flagHead('help', false)}获取更多帮助`);
            }
        }
    }
}
App.bootstrap = bootstrap_1.bootstrap;
exports.App = App;
function getFreePort() {
    const s = http2.createServer().listen();
    const port = s.address().port;
    s.close();
    return port;
}
//# sourceMappingURL=MicroService.js.map