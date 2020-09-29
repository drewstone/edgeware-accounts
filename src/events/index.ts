const _ = require('lodash');
const fs = require('fs');
const request = require('request-promise');
const { Registration } = require('@polkadot/types/interfaces');

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
			fs.readdir('./src/events', (err, files) => {
				if (err) reject(err);
				else resolve(files);
			});			
		});

		const results = await Promise.all([
			files
			.filter(file => file.includes('csv'))
			.map(async file => {
				return await new Promise((resolve, reject) => {
					fs.readFile(`./src/events/${file}`, async (e, data) => {
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
			.map(elt => [elt.from, elt.params[0].value])
		// write identities to file
		fs.writeFileSync('./identities.txt', api.createType('Vec<(AccountId, IdentityInfo)>', unwrapped).toU8a().toString(), 'utf8');
		process.exit(0);
	});
}
