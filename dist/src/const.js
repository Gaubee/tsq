"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const console_pro_1 = require("console-pro");
exports.console = new console_pro_1.Console();
exports.API_MAP_SYMBOL = Symbol.for('API_MAP');
exports.MODULE_NAME_SYMBOL = Symbol.for('module_name');
exports.SERVICE_VERSION_SYMBOL = Symbol.for('service_version');
exports.SERVER_PORT_SYMBOL = Symbol.for('server_port');
exports.CENTER_PORT = 8443;
exports.SERVICE_TOKEN = 'gaubee service net';
exports.noop = () => { };
exports.REQ_URL_CACHE_SYMBOL = Symbol('url');
exports.REQ_QUERY_CACHE_SYMBOL = Symbol('query');
exports.REQ_PARAMS_CACHE_SYMBOL = Symbol('params');
exports.REQ_BODY_CACHE_SYMBOL = Symbol('body');
//# sourceMappingURL=const.js.map