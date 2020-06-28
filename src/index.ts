import { switchMap, first } from 'rxjs/operators';
import { combineLatest, Observable } from 'rxjs';
import { ApiRx, WsProvider } from '@polkadot/api';
import { ApiOptions } from '@polkadot/api/types';
import * as edgewareDefinitions from 'edgeware-node-types/dist/definitions';
import { of } from 'rxjs';

import { BlockNumber, SignedBlock } from '@polkadot/types/interfaces/runtime';
const types = Object.values(edgewareDefinitions).reduce((res, { types }): object => ({ ...res, ...types }), {});

const options: ApiOptions = {
  provider : new WsProvider('ws://mainnet1.edgewa.re:9944'),
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
  const signedBlock: SignedBlock = await api.rpc.chain.getBlock().toPromise();
  const highest = signedBlock.block.header.number.toNumber();
  const map = await pollAllAccounts(api, highest);
})


const pollAllAccounts = async (api: ApiRx, highest: Number): Promise<{
  [number: number]: string,
}> => {
  const m: { [number: number]: string } = {};
  for (let i = highest; i > 0; i--) {
    // returns Hash
    const blockHash = await api.rpc.chain.getBlockHash(i).toPromise();
    // returns SignedBlock
    const signedBlock = await api.rpc.chain.getBlock(blockHash).toPromise();
    const blockNum = signedBlock.block.header.number.toNumber();
    // get extrinsics
    const extrinsics = signedBlock.block.extrinsics;
    // get accounts from extrinsics
    extrinsics.toArray().forEach(e => {
      // store signer account in map
      m[blockNum] = e.signer.toString();
      // if extrinsic is balance transfer
      // from: https://github.com/polkadot-js/api/blob/bec6dba14a59dabd025c875b49fa73ffc72620e5/packages/types/src/extrinsic/Extrinsic.spec.ts#L74
      // TODO: Need to verify callIndex of target extrinsics
      if (e.callIndex === new Uint8Array([6, 0])) {
        // Store recipient of transfer
        m[blockNum] = e.args[0].toString();
      }
    });
  }

  return m;
}