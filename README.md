# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
yarn hardhat help
yarn hardhat test
REPORT_GAS=true yarn hardhat test
yarn hardhat node
yarn hardhat ignition deploy ./ignition/modules/Lock.ts
```

## Commands ran to init

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
