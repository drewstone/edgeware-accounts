import { program, option } from 'commander';
import { switchMap } from 'rxjs/operators';
import { ApiRx } from '@polkadot/api';
import { Address } from '@polkadot/types/interfaces';
import { of } from 'rxjs';
import {
  eApi,
  subscribeToAccounts,
  pollAllAccounts,
  mainnet,
  sampleAccounts,
  genesisAccounts,
  testnetAccounts,
  queryBalances,
} from './edgeware';
import scrapeIdentities, { scrape } from './events';

const fs = require('fs');
export const local = 'ws://localhost:9944';

program
  .name('edgeware-scraper')
  .usage('-p -s -u <url> -t <timeout>')
  .option('-u, --url <url>', 'URL of Substrate node to connect to (defaults to "ws://localhost:9944")')
  .option('-s, --subscribe', 'To subscribe from the chain head')
  .option('-p, --poll', 'To poll to the chain head')
  .option('-c, --create', 'Create types from file')
  .option('-q, --queryBalances', 'Query balances')
  .option('--low <block>', 'Low block to poll until')
  .option('-t, --timeout <timeout>', 'Timeout from subscribing from the chain head')
  .option('-i, --identities', 'Flag to scrape identities into separate file')
  .option('-e, --events', 'Scrap events from csvs')
  .option('--scrape', 'Scrape subsOf using offline archival node')
  .on('--help', function() {
    console.log('');
    console.log('Examples:');
    console.log('');
    console.log('  Subscribe on local       $ yarn start -s');
    console.log('  Subscribe on Edgeware    $ yarn start -s -u edgeware');
    console.log('  Poll on local            $ yarn start -p');
    console.log('');
  })
  .parse(process.argv);

const programOptions = program.opts();

const m: Set<Address> = new Set();
const cb = ({ signer, others, block }) => {
  if (signer) {
    m.add(signer)
  };
  if (others.length > 0) others.forEach(o => {
    // console.log(o);
    m.add(o);
  });
}

const start = (options: {
  url?: string,
  poll?: boolean,
  subscribe?: boolean,
  timeout?: number,
  events?: any,
  scrape?: any,
  low?: number,
  queryBalances?: any,
  create?: any,
}) => {
  if (options.url === 'edgeware') options.url = mainnet
  const api = eApi(options.url || local);
  api.isReady.pipe(
    switchMap((api: ApiRx) => of(api)),
  ).subscribe(async (api: ApiRx) => {
    const highest = (await api.rpc.chain.getBlock().toPromise())
      .block.header.number.toNumber();

    if (options.scrape) {
      await scrape(api);
    } else if (options.create) {
      let accounts = [];
      const lddata = JSON.parse(fs.readFileSync('./lockdrop.json'));
      lddata.balances.forEach((a) => {
        accounts.push(api.createType('AccountId', `0x${a[0]}`).toString());
      });
      lddata.vesting.forEach((a) => {
        accounts.push(api.createType('AccountId', `0x${a[0]}`).toString());
      });

      const res = fs.readFileSync('./zerobalss.json');
      accounts = [ ...accounts, res.toString().split(',') ];
      const unique = require('lodash').uniq(accounts);
      fs.writeFileSync('./migrating-accounts.txt', JSON.stringify(unique));
      fs.writeFileSync('./migrating-accounts-vec.txt', api.createType('Vec<AccountId>', accounts).toU8a().toString(), 'utf8');
    } else if (options.queryBalances) {
      await queryBalances(api);
    } else if (options.events) {
      await scrapeIdentities(api);
    } else {
      if (options.poll) {
        await pollAllAccounts(api, cb, highest, options.low);
      }
  
      if (options.subscribe) {
        await subscribeToAccounts(api, cb, highest + 100000);
      }
    }

    writeToFile(api);
    process.exit(0);
  })
};

const writeToFile = (api: ApiRx) => {  
  // const defaults = sampleAccounts();
  // const genesisDefaults = genesisAccounts(api);
  // const testnetDefaults = testnetAccounts(api);
  // // Treasury module address
  // const arr = ['5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z'];
  // defaults.forEach(account => { arr.push(account); })
  // genesisDefaults.forEach(account => { arr.push(account); });
  // testnetDefaults.forEach(account => { arr.push(account); });
  const arr = [];
  const iterator = m.values();
  let curr = iterator.next();
  while (!curr.done) {
    arr.push(curr.value.toString());
    curr = iterator.next();
  }
  fs.writeFileSync('./accounts.json', JSON.stringify({
    accounts: arr,
  }));
  fs.writeFileSync('./accounts.txt', api.createType('Vec<AccountId>', arr).toU8a().toString(), 'utf8');
};

start({
  url: programOptions.url,
  subscribe: programOptions.subscribe,
  poll: programOptions.poll,
  timeout: programOptions.timeout,
  events: programOptions.events,
  scrape: programOptions.scrape,
  low: programOptions.low || 0,
  queryBalances: programOptions.queryBalances,
  create: programOptions.create,
});
