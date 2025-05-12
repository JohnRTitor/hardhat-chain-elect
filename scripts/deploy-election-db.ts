import hre from "hardhat";
import "@nomicfoundation/hardhat-verify";
import { sepolia } from "viem/chains";
import { verifyContract } from "../lib/verify";
import VoterDatabaseModule from "../ignition/modules/VoterDatabase";
import CandidateDatabaseModule from "../ignition/modules/CandidateDatabase";
import ElectionDatabaseModule from "../ignition/modules/ElectionDatabase";
import { Address, getAddress } from "viem";

/**
 * Delay execution for a specified number of milliseconds
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Deploy all database contracts and set up permissions
 */
async function main() {
  try {
    // Step 1: Deploy VoterDatabase
    console.log("Deploying VoterDatabase contract...");
    const { voterDatabase } = await hre.ignition.deploy(VoterDatabaseModule);
    const voterDatabaseAddress: Address = voterDatabase.address;
    console.log(`VoterDatabase deployed to: ${voterDatabaseAddress}`);
    await delay(3000);

    // Step 2: Deploy CandidateDatabase
    console.log("Deploying CandidateDatabase contract...");
    const { candidateDatabase } = await hre.ignition.deploy(
      CandidateDatabaseModule
    );
    const candidateDatabaseAddress: Address = candidateDatabase.address;
    console.log(`CandidateDatabase deployed to: ${candidateDatabaseAddress}`);
    await delay(3000);

    // Step 3: Deploy ElectionDatabase with dependencies
    console.log("Deploying ElectionDatabase contract...");
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
    const electionDatabaseAddress = electionDatabase.address;
    console.log(`ElectionDatabase deployed to: ${electionDatabaseAddress}`);
    console.log("----------------------------------------------------");
    await delay(3000);

    // Step 4: Set up admin permissions
    console.log("Setting up admin permissions...");
    const voterDatabaseContract = await hre.viem.getContractAt(
      "VoterDatabase",
      voterDatabaseAddress
    );
    const candidateDatabaseContract = await hre.viem.getContractAt(
      "CandidateDatabase",
      candidateDatabaseAddress
    );

    const publicClient = await hre.viem.getPublicClient();

    console.log("Granting ElectionDatabase admin access in VoterDatabase...");
    const hash1 = await voterDatabaseContract.write.addAdmin([
      getAddress(electionDatabaseAddress),
    ]);
    await publicClient.waitForTransactionReceipt({ hash: hash1 });

    console.log(
      "Granting ElectionDatabase admin access in CandidateDatabase..."
    );
    const hash2 = await candidateDatabaseContract.write.addAdmin([
      getAddress(electionDatabaseAddress),
    ]);
    await publicClient.waitForTransactionReceipt({ hash: hash2 });

    console.log("Admin permissions setup successfully!");
    console.log("----------------------------------------------------");

    // Step 5: Verify contracts on Sepolia if applicable
    if (
      hre.network.config.chainId === sepolia.id &&
      process.env.ETHERSCAN_API_KEY
    ) {
      console.log("Waiting before contract verification...");
      await delay(7000);

      console.log("Verifying contracts on Etherscan...");
      await verifyContract(voterDatabaseAddress, []);
      await verifyContract(candidateDatabaseAddress, []);
      await verifyContract(electionDatabaseAddress, [
        voterDatabaseAddress,
        candidateDatabaseAddress,
      ]);
      console.log("Contracts verified successfully!");
      console.log("----------------------------------------------------");
    }
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => {
    console.log("Deployment completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.log("Something went wrong! See the logs for more information.");
    console.error(error);
    process.exit(1);
  });
