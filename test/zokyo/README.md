## Install dependency

```bash
yarn add --dev @defi-wonderland/smock @types/chai-as-promised chai-as-promised
```

## Run tests

```bash
yarn hardhat test "test/zokyo/test*.spec.ts"
```

## Run coverage

```bash
yarn hardhat coverage --testfiles "test/zokyo/test*.spec.ts" --solcoverjs test/zokyo/.solcover.js
```
