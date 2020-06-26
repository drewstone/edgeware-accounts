import { switchMap, first } from 'rxjs/operators';
import { combineLatest } from 'rxjs';
import { ApiRx, WsProvider } from '@polkadot/api';
import { ApiOptions } from '@polkadot/api/types';
import * as edgewareDefinitions from 'edgeware-node-types/dist/definitions';
import { of } from 'rxjs';

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
  switchMap((api: ApiRx) => {
    return api.query.system.events();
  }),
).subscribe((events) => {
  console.log(events);
})