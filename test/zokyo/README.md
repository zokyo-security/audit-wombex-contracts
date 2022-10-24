## Install dependency

```bash
npm i --save-dev @defi-wonderland/smock
```

## Run tests

```bash
npx hardhat test test/zokyo/testWmx.js
```

## Run coverage

```bash
npx hardhat coverage --testfiles test/zokyo/testWmx.js --solcoverjs test/zokyo/.solcover.js
npx hardhat coverage --testfiles test/zokyo/testWomDepositor.js --solcoverjs test/zokyo/.solcover.js


npx hardhat coverage --testfiles test/zokyo/testWmxMath.js --solcoverjs test/zokyo/.solcover.js

```
