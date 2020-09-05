import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiRx } from '@polkadot/api';
import { AccountId } from '@polkadot/types/interfaces';
import { Vec } from '@polkadot/types';
import { local } from './';
import { eApi, testnetAccounts } from './edgeware';
const fs = require('fs');

const buf = fs.readFileSync('./uin.json');
const arr = JSON.parse(buf);

const api = eApi(local);

const accounts = api.createType('Vec<AccountId>', new Uint8Array(arr.accounts))
  .toString()
  .split(', ')
  .map(e => {
    console.log(e);
    e = e.replace('[', '');
    e = e.replace(']', '');
    return e;
  });