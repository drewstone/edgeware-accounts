import { ApiRx, WsProvider } from '@polkadot/api';
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
    console.log(e.toHuman());
    // store signer account in map
    let signer;
    const others = [];

    if (e.signer.toHex() !== '0x00') {
      signer = e.signer.toHuman();
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

    cb({ signer, others })
  });
};

export const pollAllAccounts = async (api: ApiRx, cb: Function) => {
  const highest = (await api.rpc.chain.getBlock().toPromise())
    .block.header.number.toNumber();

  for (let i = highest; i > 0; i--) {
    // returns Hash
    const blockHash = await api.rpc.chain.getBlockHash(i).toPromise();
    const signedBlock = await api.rpc.chain.getBlock(blockHash).toPromise();
    parseBlock(signedBlock, cb);
  }
}

export const subscribeToAccounts = (api: ApiRx, cb: Function) => {
  api.rpc.chain.subscribeNewHeads().subscribe(async (header) => {
    const signedBlock = await api.rpc.chain.getBlock(header.hash).toPromise();
    parseBlock(signedBlock, cb);
  })
}