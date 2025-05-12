#!/usr/bin/env ts-node
/**
 * Frontend Deployment Files Generator
 *
 * Creates JSON files with contract ABIs and addresses for frontend usage.
 *
 * Usage:
 * - Basic: `ts-node scripts/create-frontend-deployment-files.ts`
 * - With custom output: `DEPLOY_OUT_DIR=./path/to/output ts-node scripts/create-frontend-deployment-files.ts`
 * - Example: `DEPLOY_OUT_DIR=/home/masum/Dev-Environment/Blockchains/blockchain-websites/nextjs-chain-elect/src/constants ts-node scripts/create-frontend-deployment-files.ts`
 */

import fs from "fs";
import path from "path";
import { Abi, Address } from "viem";

// Configuration
const NETWORK = "sepolia";
const CHAIN_ID = "11155111";

// Contract definitions
interface Contract {
  name: string;
  moduleName: string;
  artifactPath: string;
}

const contracts: Contract[] = [
  {
    name: "CandidateDatabase",
    moduleName: "CandidateDatabaseModule#CandidateDatabase",
    artifactPath:
      "../artifacts/contracts/CandidateDatabase.sol/CandidateDatabase.json",
  },
  {
    name: "VoterDatabase",
    moduleName: "VoterDatabaseModule#VoterDatabase",
    artifactPath: "../artifacts/contracts/VoterDatabase.sol/VoterDatabase.json",
  },
  {
    name: "ElectionDatabase",
    moduleName: "ElectionDatabaseModule#ElectionDatabase",
    artifactPath:
      "../artifacts/contracts/ElectionDatabase.sol/ElectionDatabase.json",
  },
];

// Setup output directory
const outputDir = process.env.DEPLOY_OUT_DIR || "./deployments";
fs.mkdirSync(outputDir, { recursive: true });

// Read deployment addresses
const deployedAddressesPath = path.join(
  __dirname,
  `../ignition/deployments/chain-${CHAIN_ID}/deployed_addresses.json`
);

try {
  const deployedAddresses = JSON.parse(
    fs.readFileSync(deployedAddressesPath, "utf8")
  );

  // Process each contract
  contracts.forEach((contract) => {
    try {
      // Read contract ABI
      const artifactPath = path.join(__dirname, contract.artifactPath);
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

      // Get contract address
      const address = deployedAddresses[contract.moduleName];
      if (!address) {
        throw new Error(`Address not found for ${contract.moduleName}`);
      }

      // Create and write deployment file
      const deploymentFile: {
        addresses: Record<string, Address>;
        abi: Abi;
      } = {
        addresses: { [NETWORK]: address },
        abi: artifact.abi,
      };

      const outputPath = path.join(outputDir, `${contract.name}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(deploymentFile, null, 2));
      console.log(`✅ Created ${contract.name} deployment file`);
    } catch (err) {
      const error = err as Error;
      console.error(`❌ Error processing ${contract.name}:`, error.message);
    }
  });

  console.log(`\n🎉 Deployment files created successfully in ${outputDir}`);
} catch (err) {
  const error = err as Error;
  console.error(`❌ Failed to create deployment files:`, error.message);
  process.exit(1);
}
