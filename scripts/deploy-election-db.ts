import hre from "hardhat";
import "@nomicfoundation/hardhat-verify";
import { sepolia } from "viem/chains";
import { verifyContract } from "../lib/verify";
import VoterDatabaseModule from "../ignition/modules/VoterDatabase";
import CandidateDatabaseModule from "../ignition/modules/CandidateDatabase";
import ElectionDatabaseModule from "../ignition/modules/ElectionDatabase";
import { Address } from "viem";

async function main() {
  // Initialize variables with null and use explicit checks
  let electionDatabaseAddress: Address,
    candidateDatabaseAddress: Address,
    voterDatabaseAddress: Address;

  try {
    const { voterDatabase } = await hre.ignition.deploy(VoterDatabaseModule);
    console.log(`VoterDatabase deployed to: ${voterDatabase.address}`);

    console.log("waiting five seconds before deploying CandidateDatabase");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const { candidateDatabase } = await hre.ignition.deploy(
      CandidateDatabaseModule
    );
    console.log(`CandidateDatabase deployed to: ${candidateDatabase.address}`);

    console.log(`Waiting five seconds before deploying ElectionDatabase`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    voterDatabaseAddress = voterDatabase.address;
    candidateDatabaseAddress = candidateDatabase.address;
  } catch (error) {
    console.error(error);
    throw error;
  }

  if (!voterDatabaseAddress || !candidateDatabaseAddress) {
    throw new Error("VoterDatabase or CandidateDatabase address is missing");
  }

  try {
    const { electionDatabase } = await hre.ignition.deploy(
      ElectionDatabaseModule,
      {
        parameters: {
          ElectionDatabaseModule: {
            voterDatabase: voterDatabaseAddress,
            candidateDatabase: candidateDatabaseAddress,
          },
        },
      }
    );
    console.log(`ElectionDatabase deployed to: ${electionDatabase.address}`);
    electionDatabaseAddress = electionDatabase.address;
  } catch (error) {
    console.error(error);
    throw error;
  }

  if (!electionDatabaseAddress) {
    throw new Error("ElectionDatabase address is missing");
  }

  if (
    hre.network.config.chainId === sepolia.id &&
    process.env.ETHERSCAN_API_KEY
  ) {
    console.log("Waiting ten seconds before verifying");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    await verifyContract(voterDatabaseAddress, []);
    await verifyContract(candidateDatabaseAddress, []);
    await verifyContract(electionDatabaseAddress, [
      voterDatabaseAddress,
      candidateDatabaseAddress,
    ]);
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
