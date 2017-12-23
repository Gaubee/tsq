import * as http2 from 'http2';
import { PromiseOut } from './PromiseExtends';
import { Buffer } from 'buffer';

const { HTTP2_HEADER_METHOD } = http2.constants

export function sessionRequest(
    session: http2.ClientHttp2Session,
    headers: http2.OutgoingHttpHeaders,
    opts?: { method?: string; body?: any }
) {
    if (opts && opts.method) {
        headers[HTTP2_HEADER_METHOD] = opts.method
    }
    const req = session.request(headers);

    if (opts && opts.body) {
        // if (typeof opts.body === 'string' || opts.body instanceof Buffer) {
        //     req.write(opts.body)
        // } else {
        req.write(JSON.stringify(opts.body))
        // }
    }
    req.end()

    const headersPromiseOut = new PromiseOut<{ [key: string]: string | string[] }>();
    req.once('response', headers => {
        headersPromiseOut.resolve(headers);
    });

    const bodyPromiseOut = new PromiseOut<Buffer>()
    const buffers = [];
    req.on('data', chunk => {
        buffers.push(chunk);
    });
    req.once('end', () => {
        bodyPromiseOut.resolve(Buffer.concat(buffers));
    });

    req.once('error', () => {
        headersPromiseOut.reject()
        bodyPromiseOut.reject()
    });

    return {
        clientHttp2Stream: req,
        headersPromiseOut,
        bodyPromiseOut,
        get jsonBodyPromise() {
            return bodyPromiseOut.promise.then(buffer => JSON.parse(buffer.toString()))
        }
    }
}