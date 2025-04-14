# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
pnpm hardhat help
pnpm hardhat test
REPORT_GAS=true pnpm hardhat test
pnpm hardhat node
pnpm hardhat ignition deploy ./ignition/modules/Lock.ts
```

## Commands ran to init

### Pnpm version

```bash
git init
devenv init # for Nix users only
# Use devenv.nix configuration from this repo
pnpm add -D hardhat solhint prettier dotenv
pnpm add -D eslint @eslint/js typescript typescript-eslint
pnpm hardhat init
# Choose advanced Typescript project with Viem
pnpm solhint init
# Use prettier, solhint, eslint configuration from this repo
# Optional: use zed-editor (.zed) tasks configuration from this repo
```

### Yarn version

```bash
git init
devenv init # for Nix users only
# Use devenv.nix configuration from this repo
yarn set version stable
yarn config set nodeLinker node-modules # As zed-editor doesn't properly support Yarn PnP
yarn add -D hardhat solhint prettier dotenv
yarn add -D eslint @eslint/js typescript typescript-eslint
yarn hardhat init
# Choose advanced Typescript project with Viem
yarn solhint init
# Use prettier, solhint, eslint configuration from this repo
# Optional: use zed-editor (.zed) tasks configuration from this repo
```
