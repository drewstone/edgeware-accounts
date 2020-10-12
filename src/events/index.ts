const _ = require('lodash');
const fs = require('fs');
const request = require('request-promise');
const { Registration } = require('@polkadot/types/interfaces');
const identities = require('./identities').default;
const subs = require('./subsOf').default;
const supers = require('./superOf').default;

const options = (body) => ({
  method: 'POST',
  uri: 'https://edgeware.subscan.io/api/open/extrinsic',
  headers: { 'Content-Type': 'application/json' },
  json: true,
  body: body,
});

const makeRequest = (data) => {
  if (data.length > 0) {
    return data.map(async (elt) => {
      if (elt) {
        if (elt['Action'] === 'identity(IdentitySet)') {
          return request(options({
            hash: elt['Extrinsic Hash'],
          })).then(res => {
            return {
              response: res,
              hash: elt['Extrinsic Hash'],
            };
          })
        }
      }
    });
  }

  return [];
};

const parseData = (data) => {
  return data
    .toString()
    .split('\n')
    .map(line => line.split(','))
    .filter(split => split.length > 1)
    .map((split, inx) => {
      if (inx)
      return {
        'Extrinsic Id': split[0],
        'Block Number': Number(split[1]),
        'Extrinsic Hash': split[2],
        'Block Timestamp': split[3],
        'Action': split[4],
      };
    });
};

export default (api) => {
  return new Promise(async (resolve, reject) => {
    const files: any[] = await new Promise((resolve, reject) => {
      fs.readdir('./src/events/data', (err, files) => {
        if (err) reject(err);
        else resolve(files);
      });     
    });

    const results = await Promise.all([
      files
      .filter(file => file.includes('csv'))
      .map(async file => {
        return await new Promise((resolve, reject) => {
          fs.readFile(`./src/events/data/${file}`, async (e, data) => {
            if (e) reject(e);
            else {
              const res = makeRequest((parseData(data)));
              if (res.length > 0) {
                const t = await Promise.all(res);
                resolve(t.filter((x) => !!x));
              }
            }
          });
        });
      }),
    ]);

    const r = results[0];
    let unwrapped = await Promise.all(r);
    unwrapped = _.flattenDeep(unwrapped)
      .map(elt => elt.response.data.extrinsic)
      .filter(elt => !!elt)
    console.log(unwrapped);
    const m = {};
    for (let i = 0; i < unwrapped.length; i++) {
      const acc = unwrapped[i]['from'];
      if (acc in m) {
        if (unwrapped[i]['block_timestamp'] > m[acc]['block_timestamp']) {
          m[acc] = unwrapped[i];
        }
      } else {
        m[acc] = unwrapped[i];
      }
    }

    // write identities to file
    // fs.writeFileSync('./identities.txt', api.createType('Vec<(AccountId, IdentityInfo)>', unwrapped).toU8a().toString(), 'utf8');
    fs.writeFileSync('./identities-dump.txt', JSON.stringify(m, null, 4));
    process.exit(0);
  });
}

export const scrape = async (api) => {
  const dumpData = JSON.parse(fs.readFileSync('./identities-dump.txt'));
  const hashMap = Object.keys(dumpData).reduce((prev, curr) => {
    const hash = api.createType('AccountId', curr).hash.toString('hex');
    prev[hash] = curr;
    return prev;
  }, {});
  const ids = identities();
  const subsOf = subs();
  const superOfs = supers();

  const idMap = ids.map(id => {
    const hash = id[0][0];
    const registration = id[1];
    return [(hashMap[hash]) ? hashMap[hash] : hash, registration];
  }).reduce((prev, curr) => {
    prev[curr[0]] = curr[1];
    return prev;
  }, {});

  const subMap = subsOf.map(sub => {
    const hash = sub[0][0];
    const subData = sub[1];

    return [(hashMap[hash]) ? hashMap[hash] : hash, subData];
  }).reduce((prev, curr) => {
    prev[curr[0]] = curr[1];
    return prev;
  }, {});

  const superMap = superOfs.map(sup => {
    const hash = sup[0][0];
    const superData = sup[1];
    return [(hashMap[hash]) ? hashMap[hash] : hash, superData];
  }).reduce((prev, curr) => {
    prev[curr[0]] = curr[1];
    return prev;
  }, {});

  fs.writeFileSync('./idees.txt', JSON.stringify(idMap, null, 4));
  fs.writeFileSync('./subidees.txt', JSON.stringify(subMap, null, 4));
  fs.writeFileSync('./superidees.txt', JSON.stringify(superMap, null, 4));
  const registrations = api.createType('Vec<(AccountId, Registration<Balance>)>',
    Object.keys(idMap).filter(key => !key.includes('0x')).map(key => ([key, idMap[key]]))
  ).toU8a().toString();
  const subIdentities = api.createType('Vec<(AccountId, (Balance, Vec<AccountId>))>',
    Object.keys(subMap).filter(key => !key.includes('0x')).map(key => ([key, subMap[key]]))
  ).toU8a().toString();
  const superIdentities = api.createType('Vec<(AccountId, (AccountId, Data))>',
    Object.keys(superMap).filter(key => !key.includes('0x')).map(key => ([key, superMap[key]]))
  ).toU8a().toString();
  fs.writeFileSync('./data/identities.txt', registrations, 'utf8');
  fs.writeFileSync('./data/subIdentities.txt', subIdentities, 'utf8');
  fs.writeFileSync('./data/superIdentities.txt', superIdentities, 'utf8');
};
