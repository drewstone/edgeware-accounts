import {
  eApi,
  mainnet,
} from './edgeware';
const fs = require('fs').promises;

const api = eApi(mainnet);
const buf = require('fs').readFileSync('./accounts.json');
const data = JSON.parse(buf);
console.log(data.accounts.length);
const first = data.accounts.slice(0, data.accounts.length / 2);
const second = data.accounts.slice(data.accounts.length / 2);

fs.writeFile('./accounts-0.txt', api.createType('Vec<AccountId>', data.accounts).toU8a().toString(), 'utf8')
.then(() => {
	return fs.writeFile('./accounts-1.txt', api.createType('Vec<AccountId>', first).toU8a().toString(), 'utf8');
})
.then(() => {
	return fs.writeFile('./accounts-2.txt', api.createType('Vec<AccountId>', second).toU8a().toString(), 'utf8');	
})
.then(() => {
	process.exit(0);
});
