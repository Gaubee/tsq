import * as MT from 'mime-types';

export type ResponseContentOptions = {
	type?: string;
	charset?: string;
	statusCode?: number;
};
export class ResponseContent {
	static Type = MT.types;
	type: string = ResponseContent.Type.text;
	charset: string = 'utf-8';
	statusCode: number = 200;
	constructor(public body: any, public opts: ResponseContentOptions = {}) {
		'type' in opts && (this.type = opts.type);
		'charset' in opts && (this.charset = opts.charset);
		'statusCode' in opts && (this.statusCode = opts.statusCode);
	}
	static html(body: any) {
		return new ResponseContent(body, {
			type: ResponseContent.Type.html
		});
	}
	static text(body: any) {
		return new ResponseContent(body, {
			type: ResponseContent.Type.text
		});
	}
	static json(body: any) {
		return new ResponseContent(body, {
			type: ResponseContent.Type.json
		});
	}
}
