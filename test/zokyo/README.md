## Install dependency

```bash
npm i --save-dev @defi-wonderland/smock
```

## Run tests

```bash
npx hardhat test "test/zokyo/test*.js"
```

## Run coverage

```bash
npx hardhat coverage --testfiles "test/zokyo/test*.js" --solcoverjs test/zokyo/.solcover.js
```
