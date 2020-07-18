import { Keyring, ApiRx, WsProvider } from '@polkadot/api';
import * as edgewareDefinitions from 'edgeware-node-types/dist/definitions';

import { SignedBlock } from '@polkadot/types/interfaces/runtime';
import { Call } from '@polkadot/types/interfaces';

const types = Object
  .values(edgewareDefinitions)
  .reduce((res, { types }): object => ({ ...res, ...types }), {});

export const mainnet = 'ws://mainnet1.edgewa.re:9944';;

export const eApi = (url) => new ApiRx({
  provider : new WsProvider(url),
  types: {
    ...types,
    // aliases that don't do well as part of interfaces
    'voting::VoteType': 'VoteType',
    'voting::TallyType': 'TallyType',
    // chain-specific overrides
    Address: 'GenericAddress',
    Keys: 'SessionKeys4',
    StakingLedger: 'StakingLedgerTo223',
    Votes: 'VotesTo230',
    ReferendumInfo: 'ReferendumInfoTo239',
    Weight: 'u32',
    Balance2: 'Balance',
  },
  // override duplicate type name
  typesAlias: { voting: { Tally: 'VotingTally' } },
});

const parseAccountFromArgs = (args: Call) => {
  if ((args.section === 'balances' && args.method === 'transfer')
    || (args.section === 'staking' && args.method === 'bond'
    || args.section === 'staking' && args.method === 'setController')
  ) {
    return args.args[0];
  } else {
    return null;
  }
}

const parseBlock = (signedBlock: SignedBlock, cb) => {
  // get extrinsics
  const extrinsics = signedBlock.block.extrinsics;
  // get accounts from extrinsics
  extrinsics.toArray().forEach(e => {
    // store signer account in map
    let signer;
    const others = [];

    if (e.signer.toHex() !== '0x00') {
      signer = e.signer;
    }

    let other = parseAccountFromArgs(e.method);
    if (other) others.push(other);

    if (e.method.section === 'utility' && e.method.method === 'batch') {
      const arr = Array(e.method.args[0].toHuman())[0];
      (arr as Array<any>).forEach(args => {
        other = parseAccountFromArgs(args as Call);
        if (other) others.push(other);
      })
    }

    cb({ signer, others, block: signedBlock })
  });
};

export const pollAllAccounts = async (api: ApiRx, cb: Function, top: number) => {
  console.log(`Highest ${top}`);
  for (let i = top; i > 0; i--) {
    if (i % 10000 === 0) console.log(i);
    try {
      // returns Hash
      const blockHash = await api.rpc.chain.getBlockHash(i).toPromise();
      const signedBlock = await api.rpc.chain.getBlock(blockHash).toPromise();
      parseBlock(signedBlock, cb);
    } catch (e) {
      console.log(`Failed on block ${i}`);
    }
  }
}

export const subscribeToAccounts = (api: ApiRx, cb: Function, top: number = 2500000) => {
  return new Promise((resolve) => {
    api.rpc.chain.subscribeNewHeads().subscribe(async (header) => {
      try {
        const signedBlock = await api.rpc.chain.getBlock(header.hash).toPromise();
        if (signedBlock.block.header.number.toNumber() >= top) {
          resolve();
        } else {
          parseBlock(signedBlock, cb);  
        }
      } catch (e) {
        console.log(`Failed to parse block`);
      }
    });
  });
}

export const sampleAccounts = () => {
  const defaultMnemonic = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
  const accounts = [
    'Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Ferdie',
    'Alice//stash', 'Bob//stash', 'Charlie//stash', 'Dave//stash', 'Eve//stash', 'Ferdie//stash'
  ];
  return accounts.map(a => {
    return (new Keyring({ ss58Format: 42, type: 'sr25519' })).addFromUri(`${defaultMnemonic}//${a}`).address  
  });
}