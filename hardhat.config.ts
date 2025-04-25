import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import dotenv from "dotenv";

dotenv.config();

// RPC URL for Sepolia testnet, the fallback value is just an example
const SEPOLIA_RPC_URL: string =
  process.env.SEPOLIA_RPC_URL ||
  "https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY";
// private key for an account in MetaMask wallet, the fallback value is random
const PRIVATE_KEY: string =
  process.env.PRIVATE_KEY ||
  "0x11ee3108a03081fe260ecdc106554d09d9d1209bcafd46942b10e02943effc4a";
const ETHERSCAN_API_KEY: string = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  // default, you can change network on the go, by passing
  // `--network hardhat` or `--network localhost` to hardhat run
  defaultNetwork: "hardhat",
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL, // Get from Alchemy or Infura
      accounts: [PRIVATE_KEY], // Get from MetaMask
      chainId: 11155111, // Sepolia testnet chain ID: https://chainlist.org/
    },
    localhost: {
      // start by `hardhat node`
      url: "http://127.0.0.1:8545/",
      // acoounts: [] //auto-filled by hardhat. Thanks hardhat :)
      chainId: 31337, // uses the same chainId as `hardhat` network
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },

  solidity: {
    version: "0.8.28",
  },
  mocha: {
    timeout: 200000, // 200 seconds max for running tests
  },
};

export default config;
