import hre from "hardhat";
import "@nomicfoundation/hardhat-verify";
import { sepolia } from "viem/chains";
import VoterDatabaseModule from "../ignition/modules/VoterDatabase";
import { verifyContract } from "../lib/verify";

async function main() {
  const { voterDatabase } = await hre.ignition.deploy(VoterDatabaseModule);

  console.log(`VoterDatabase deployed to: ${voterDatabase.address}`);

  if (
    hre.network.config.chainId === sepolia.id &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verifyContract(voterDatabase.address, []);
  }
}

main()
  .then(() => {
    console.log("Script executed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
