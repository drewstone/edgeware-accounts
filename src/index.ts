import { switchMap, first } from 'rxjs/operators';
import { combineLatest, Observable } from 'rxjs';
import { ApiRx, WsProvider } from '@polkadot/api';
import { ApiOptions } from '@polkadot/api/types';
import * as edgewareDefinitions from 'edgeware-node-types/dist/definitions';
import { of } from 'rxjs';

import { BlockNumber, SignedBlock } from '@polkadot/types/interfaces/runtime';
const types = Object
  .values(edgewareDefinitions)
  .reduce((res, { types }): object => ({ ...res, ...types }), {});

const local = 'ws://localhost:9944';
const mainnet = 'ws://mainnet1.edgewa.re:9944';
const options: ApiOptions = {
  provider : new WsProvider(local),
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
};

const api = new ApiRx(options);

api.isReady.pipe(
  switchMap((api: ApiRx) => of(api)),
).subscribe(async (api: ApiRx) => {
  // const signedBlock: SignedBlock = await api.rpc.chain.getBlock().toPromise();
  // const highest = signedBlock.block.header.number.toNumber();
  // const map = await pollAllAccounts(api, highest);
  subscribeToBlocks(api);
})


const parseBlock = (signedBlock: SignedBlock, cb) => {
  const blockNum = signedBlock.block.header.number.toNumber();
  // get extrinsics
  const extrinsics = signedBlock.block.extrinsics;
  // get accounts from extrinsics
  extrinsics.toArray().forEach(e => {
    // store signer account in map
    let signer;
    let other;

    if (e.signer.toHex() !== '0x00') {
      signer = e.signer.toHex();
    }
    console.log(e.toHuman());
    if ((e.method.section === 'balances' && e.method.method === 'transfer')
      || (e.method.section === 'staking' && e.method.method === 'bond')
    ) {
      // Store recipient of transfer
      other = e.method.args[0].toHex();
    }

    cb({ blockNum, signer, other })
  });
};

const pollAllAccounts = async (api: ApiRx, highest: number): Promise<{ [number: number]: { signer: string; other: string } }> => {
  const m: { [number: number]: { signer: string; other: string } } = {};
  for (let i = highest; i > 0; i--) {
    // returns Hash
    const blockHash = await api.rpc.chain.getBlockHash(i).toPromise();
    const signedBlock = await api.rpc.chain.getBlock(blockHash).toPromise();
    const cb = ({ blockNum, signer, other }) => {
      if (signer || other) {
        if (!(blockNum in m)) {
          m[blockNum] = {
            signer: null,
            other: null,
          };
        }

        m[blockNum].signer = signer;
        m[blockNum].other = other;
        console.log(m);
      }
    }
    parseBlock(signedBlock, cb);
  }

  return m;
}

const subscribeToBlocks = (api: ApiRx) => {
  const m: { [number: number]: { signer: string; other: string } } = {};
  api.rpc.chain.subscribeNewHeads().subscribe(async (header) => {
    const signedBlock = await api.rpc.chain.getBlock(header.hash).toPromise();
    const cb = ({ blockNum, signer, other }) => {
      if (signer || other) {
        if (!(blockNum in m)) {
          m[blockNum] = {
            signer: null,
            other: null,
          };
        }

        m[blockNum].signer = signer;
        m[blockNum].other = other;
        console.log(m);
      }
    }
    parseBlock(signedBlock, cb);
  })
}