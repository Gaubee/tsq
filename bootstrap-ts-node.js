const ts_node = require('ts-node');
ts_node.register(require('./tsconfig.json'));

const gateway = __dirname + '/' + process.argv.pop();
require(gateway);
