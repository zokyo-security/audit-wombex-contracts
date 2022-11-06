## Install dependency

```bash
cd @defi-wonderland/smock
yarn
yarn link
cd ..
cd ..
yarn link @defi-wonderland/smock
yarn add --dev @types/chai-as-promised chai-as-promised
```

## Run tests

```bash
yarn hardhat test "test/zokyo/test*.spec.ts"
```

## Run coverage

```bash
yarn hardhat coverage --testfiles "test/zokyo/test*.spec.ts" --solcoverjs test/zokyo/.solcover.js
```
