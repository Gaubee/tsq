import { ApiUrlMatcher } from './const';
export declare function exportAPI(match_url: string | RegExp | ApiUrlMatcher, args_handers?: any[]): (service: any, fun_name: string) => any;
