
import * as fs from 'fs';
import * as deasync from 'deasync'
import { setInterval } from 'timers';
import { console } from '../src/index';
// import { console } from '../src';

(async function () {
    console.log('XXXXXXXXXXXXXXXXXXX:a1 ');
    await new Promise(cb => setTimeout(() => { cb(1) }, 1000));
    console.log('XXXXXXXXXXXXXXXXXXX:a2 ');
    deasync.sleep(5000)
    console.log('XXXXXXXXXXXXXXXXXXX:a3 ');
    return 'aaa'
})();