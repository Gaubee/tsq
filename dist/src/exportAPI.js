"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http2 = require("http2");
const url = require("url");
const querystring = require("querystring");
const pathToRegexp = require("path-to-regexp");
const const_1 = require("./const");
const { HTTP2_HEADER_PATH, HTTP2_HEADER_STATUS } = http2.constants;
function exportAPI(match_url, args_handers = []) {
    return function (service, fun_name) {
        var matcher;
        if (typeof match_url === 'string') {
            const re = pathToRegexp(match_url);
            matcher = url => {
                return re.test(url);
            };
        }
        else if (match_url instanceof RegExp) {
            matcher = url => match_url.test(url);
        }
        else if (match_url instanceof Function) {
            matcher = match_url;
        }
        else {
            throw new TypeError("match_url's type must be [string | RegExp | Function]");
        }
        const arg_hander_list = args_handers.map(arg_hander_config => {
            if (arg_hander_config instanceof Function) {
                return arg_hander_config;
            }
            else if (typeof arg_hander_config === 'string') {
                arg_hander_config = arg_hander_config.split('.');
                const arg_from = arg_hander_config.shift();
                const try_get_prop = res => {
                    for (let i = 0; i < arg_hander_config.length; i += 1) {
                        res = res[arg_hander_config[i]];
                        if (!res) {
                            break;
                        }
                    }
                    return res;
                };
                const get_url_info = (req) => {
                    if (!req[const_1.REQ_URL_CACHE_SYMBOL]) {
                        req[const_1.REQ_URL_CACHE_SYMBOL] = url.parse(req.headers[HTTP2_HEADER_PATH]);
                    }
                    return req[const_1.REQ_URL_CACHE_SYMBOL];
                };
                if (arg_from === 'query') {
                    return (req) => {
                        if (!req[const_1.REQ_QUERY_CACHE_SYMBOL]) {
                            req[const_1.REQ_QUERY_CACHE_SYMBOL] = querystring.parse(get_url_info(req).query);
                        }
                        return try_get_prop(req[const_1.REQ_QUERY_CACHE_SYMBOL]);
                    };
                }
                else if (arg_from === 'params') {
                    if (typeof match_url === 'string') {
                        const keys = [];
                        const re = pathToRegexp(match_url, keys);
                        return (req) => {
                            if (!req[const_1.REQ_QUERY_CACHE_SYMBOL]) {
                                const params = (req[const_1.REQ_QUERY_CACHE_SYMBOL] = {});
                                const match_info = get_url_info(req).pathname.match(re);
                                if (match_info) {
                                    const match_params = match_info.slice(1);
                                    for (let kinfo of keys) {
                                        params[kinfo.name] = match_params.shift();
                                    }
                                }
                            }
                            return try_get_prop(req[const_1.REQ_QUERY_CACHE_SYMBOL]);
                        };
                    }
                    else if (match_url instanceof RegExp) {
                        return (req) => {
                            if (!req[const_1.REQ_QUERY_CACHE_SYMBOL]) {
                                const params = (req[const_1.REQ_QUERY_CACHE_SYMBOL] = {});
                                const match_info = get_url_info(req).pathname.match(match_url);
                                if (match_info) {
                                    const match_params = match_info.slice(1);
                                    for (let i = 0; i < match_params.length; i += 1) {
                                        params[i] = match_params[i];
                                    }
                                }
                            }
                            return try_get_prop(req[const_1.REQ_QUERY_CACHE_SYMBOL]);
                        };
                    }
                }
                else if (arg_from === 'body') {
                    return async (req) => {
                        if (!req[const_1.REQ_BODY_CACHE_SYMBOL]) {
                            req[const_1.REQ_BODY_CACHE_SYMBOL] = await new Promise((resolve, reject) => {
                                let rawBody = '';
                                req.stream.on('data', chunk => (rawBody += chunk));
                                req.stream.on('end', () => {
                                    try {
                                        resolve(JSON.parse(rawBody));
                                    }
                                    catch (err) {
                                        const_1.console.error('Parse body Error');
                                        const_1.console.error(err);
                                        resolve({});
                                    }
                                });
                                req.stream.on('error', () => {
                                    resolve({});
                                });
                            });
                        }
                        return try_get_prop(req[const_1.REQ_BODY_CACHE_SYMBOL]);
                    };
                }
            }
            return const_1.noop;
        });
        const api_map = service[const_1.API_MAP_SYMBOL] || (service[const_1.API_MAP_SYMBOL] = new Map());
        const api_info = { matcher, arg_hander_list };
        var api_info_list = api_map.get(fun_name);
        if (!api_info_list) {
            api_info_list = [];
            api_map.set(fun_name, api_info_list);
        }
        api_info_list.push({ matcher, arg_hander_list });
        return service;
    };
}
exports.exportAPI = exportAPI;
//# sourceMappingURL=exportAPI.js.map