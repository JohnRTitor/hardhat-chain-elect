import hre from "hardhat";
import "@nomicfoundation/hardhat-verify";
import { sepolia } from "viem/chains";
import { verifyContract } from "../lib/verify";
import CandidateDatabaseModule from "../ignition/modules/CandidateDatabase";

async function main() {
  const { candidateDatabase } = await hre.ignition.deploy(
    CandidateDatabaseModule
  );

  console.log(`CandidateDatabase deployed to: ${candidateDatabase.address}`);

  if (
    hre.network.config.chainId === sepolia.id &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verifyContract(candidateDatabase.address, []);
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
