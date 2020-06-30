import { program, option } from 'commander';
import { switchMap } from 'rxjs/operators';
import { ApiRx } from '@polkadot/api';
import { of } from 'rxjs';
import { eApi, subscribeToAccounts, pollAllAccounts, mainnet } from './edgeware';

const local = 'ws://localhost:9944';

program
  .name('edgeware-accounts')
  .usage('-p -s -u <url> -t <timeout>')
  .option('-u, --url <url>', 'URL of Substrate node to connect to (defaults to "ws://localhost:9944")')
  .option('-s, --subscribe', 'To subscribe from the chain head')
  .option('-p, --poll', 'To poll to the chain head')
  .option('-t, --timeout <timeout>', 'Timeout from subscribing from the chain head')
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

const m: Set<string> = new Set();
const cb = ({ signer, others }) => {
  if (signer) m.add(signer);
  if (others.length > 0) others.forEach(o => m.add(o));
}

const start = (options: {
  url?: string,
  poll?: boolean,
  subscribe?: boolean,
  timeout?: number,
}) => {
  if (options.url === 'edgeware') options.url = mainnet
  const api = eApi(options.url || local);
  api.isReady.pipe(
    switchMap((api: ApiRx) => of(api)),
  ).subscribe(async (api: ApiRx) => {
    if (options.poll) {
      await pollAllAccounts(api, cb);
    }

    if (options.subscribe) {
      subscribeToAccounts(api, cb);
    }
  })
};

start({
  url: programOptions.url,
  subscribe: true,
  timeout: programOptions.timeout,
});
