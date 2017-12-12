"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const url = require("url");
const http2 = require("http2");
// const networkInterfaces = os.networkInterfaces();
// for (let key in networkInterfaces) {
// 	const networkInterface = networkInterfaces[key];
// 	if (networkInterface.find(n => !n.internal)) {
// 	}
// }
const const_1 = require("./const");
const { HTTP2_HEADER_PATH, HTTP2_HEADER_STATUS } = http2.constants;
function bootstrap(ServiceConstructor) {
    const service = new ServiceConstructor();
    const module_name = ServiceConstructor[const_1.MODULE_NAME_SYMBOL];
    const server_port = ServiceConstructor[const_1.SERVER_PORT_SYMBOL];
    const service_version = ServiceConstructor[const_1.SERVICE_VERSION_SYMBOL];
    const api_map = new Map();
    {
        // 从原型链上一层层剥下API_MAP
        let cur_service_proto = service;
        while (cur_service_proto[const_1.API_MAP_SYMBOL]) {
            const _api_map = cur_service_proto[const_1.API_MAP_SYMBOL];
            for (let [fun_name, api_info_list] of _api_map) {
                if (!api_map.has(fun_name)) {
                    api_map.set(fun_name, api_info_list);
                }
            }
            cur_service_proto = Object.getPrototypeOf(cur_service_proto);
        }
    }
    // 建立自己的服务节点，用于为其它中心节点提供直连服务
    const server = http2.createServer();
    const onServerRequest = async (req, res) => {
        const_1.console.log('request', req.headers);
        const url_info = (req[const_1.REQ_URL_CACHE_SYMBOL] = url.parse(req.headers[HTTP2_HEADER_PATH]));
        const req_path = url_info.pathname;
        const t = const_1.console.time(req.method, req_path);
        try {
            for (let [fun_name, api_info_list] of api_map.entries()) {
                for (let { matcher, arg_hander_list } of api_info_list) {
                    let match_res;
                    try {
                        match_res = await matcher(req_path, req);
                    }
                    catch (err) {
                        const_1.console.warn(fun_name, '的匹配器异常', err);
                    }
                    if (match_res) {
                        let res_body;
                        const_1.console.flag('call', fun_name);
                        try {
                            const args = await Promise.all(arg_hander_list.map(arg_hander => arg_hander(req)));
                            res_body = await service[fun_name](...args);
                        }
                        catch (err) {
                            res.statusCode = err.code || 500;
                        }
                        res.end(res_body);
                        return;
                    }
                }
            }
            res.statusCode = 502;
            res.end('zzZZZ!no found');
        }
        finally {
            const_1.console.timeEnd(t);
        }
    };
    server.on('request', onServerRequest);
    server.listen({
        port: server_port,
        host: 'fe80::21b3:c398:f634:9270'
    }, () => {
        const server_address_info = server.address();
        const_1.console.flag('server_address_info', server_address_info);
        // 与中心服务进行连接，提供外部数据服务
        var is_connected = false;
        var retry_times = 0;
        function connectToCenterServer() {
            const clientSession = http2.connect(`https://localhost:${const_1.CENTER_PORT}`, {
                ca: fs_1.readFileSync(__dirname + '/pem/localhost-cert.pem')
            });
            clientSession.setTimeout(Number.MAX_SAFE_INTEGER);
            clientSession.on('connect', () => {
                clientSession.rstStream;
                const_1.console.success('连接成功');
                is_connected = true;
                retry_times = 0;
                const_1.console.log('发送节点注册');
                const req = clientSession.request({
                    [HTTP2_HEADER_PATH]: '/',
                    token: const_1.SERVICE_TOKEN,
                    register_module_name: module_name,
                    register_server_host: server_address_info.address,
                    register_server_family: server_address_info.family,
                    register_server_port: server_address_info.port,
                    register_service_version: service_version
                });
                var rawData = '';
                req.on('data', chunk => (rawData += chunk));
                req.on('end', () => {
                    if (rawData === const_1.SERVICE_TOKEN) {
                        const_1.console.success('服务注册成功');
                    }
                    else {
                        const_1.console.error('服务注册失败', rawData);
                    }
                });
                req.end();
            });
            clientSession.on('stream', async (stream, headers, flags, rawHeaders) => {
                try {
                    const_1.console.log('stream', headers, rawHeaders);
                    const req = new http2['Http2ServerRequest'](stream, headers, undefined, rawHeaders);
                    const res = new http2['Http2ServerResponse'](stream);
                    return await onServerRequest(req, res);
                }
                catch (err) {
                    const_1.console.error(err);
                }
            });
            clientSession.on('close', () => {
                var second = 1;
                const log_line = () => {
                    const_1.console.line(is_connected ? '连接断开' : '连接失败', second ? `${second}s后进行重连。` : '重连中……', retry_times ? `已重连${retry_times}次` : '');
                    second -= 0.1;
                    second = parseFloat(second.toFixed(1));
                    if (second < 0) {
                        retry_times += 1;
                        connectToCenterServer();
                        clearInterval(ti);
                    }
                };
                var ti = setInterval(log_line, 100);
                log_line();
            });
        }
        connectToCenterServer();
    });
}
exports.bootstrap = bootstrap;
//# sourceMappingURL=bootstrap.js.map