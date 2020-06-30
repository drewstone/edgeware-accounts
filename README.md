# edgeware-accounts

A utility for polling and subscribing to Edgeware based chains in order to scrape all accounts. The two main functions are:
1. Poll historical data and scrape accounts from historical extrinsics
2. Subscribe to new data and scrape accounts from new extrinsics

# Usage
Install all node modules with `yarn` or `npm i`.
```
Usage: yarn start -s -u <url> -t <timeout>

Options:
  -u, --url <url>          URL of Substrate node to connect to (defaults to "ws://localhost:9944")
  -s, --subscribe          To subscribe from the chain head
  -p, --poll               To poll to the chain head
  -t, --timeout <timeout>  Timeout from subscribing from the chain head
  -h, --help               display help for command

Examples:

  Subscribe on local       $ yarn start -s
  Subscribe on Edgeware    $ yarn start -s -u edgeware
  Poll on local            $ yarn start -p
```