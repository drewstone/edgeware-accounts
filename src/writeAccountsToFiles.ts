import {
  eApi,
  mainnet,
} from './edgeware';
const fs = require('fs').promises;

const api = eApi(mainnet);
const buf = require('fs').readFileSync('./accounts.json');
const data = JSON.parse(buf);

fs.writeFile('./accounts-0.txt', api.createType('Vec<AccountId>', data.accounts).toU8a().toString(), 'utf8')
.then(() => (process.exit(0)))
