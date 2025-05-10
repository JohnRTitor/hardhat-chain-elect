// Run with `ts-node scripts/create-frontend-deployment-files.ts`
// Specify the output dir manually with:
// DEPLOY_OUT_DIR=/home/masum/Dev-Environment/Blockchains/blockchain-websites/nextjs-chain-elect/src/constants ts-node scripts/create-frontend-deployment-files.ts

import fs from "fs";
import path from "path";
import { Abi } from "viem";

// Specify the output directory for deployment files
const outputDir = process.env.DEPLOY_OUT_DIR || "./deployments";

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read deployment addresses from ignition
const deployedAddressesPath = path.join(
  __dirname,
  "../ignition/deployments/chain-11155111/deployed_addresses.json"
);
const deployedAddresses = JSON.parse(
  fs.readFileSync(deployedAddressesPath, "utf8")
);

// Read the ABIs from the artifacts
const candidateDBArtifactPath = path.join(
  __dirname,
  "../artifacts/contracts/CandidateDatabase.sol/CandidateDatabase.json"
);
const voterDBArtifactPath = path.join(
  __dirname,
  "../artifacts/contracts/VoterDatabase.sol/VoterDatabase.json"
);
const electionDBArtifactPath = path.join(
  __dirname,
  "../artifacts/contracts/VoterDatabase.sol/VoterDatabase.json"
);

const candidateDBArtifact = JSON.parse(
  fs.readFileSync(candidateDBArtifactPath, "utf8")
);
const voterDBArtifact = JSON.parse(
  fs.readFileSync(voterDBArtifactPath, "utf8")
);
const electionDBArtifact = JSON.parse(
  fs.readFileSync(electionDBArtifactPath, "utf8")
);

// Create deployment files
const createDeploymentFile = (name: string, address: string, abi: Abi[]) => {
  const deploymentFile = {
    addresses: {
      sepolia: address,
    },
    abi,
  };

  const outputPath = path.join(outputDir, `${name}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentFile, null, 2));
  console.log(`Created deployment file at: ${outputPath}`);
};

// Extract addresses
const candidateDBAddress =
  deployedAddresses["CandidateDatabaseModule#CandidateDatabase"];
const voterDBAddress = deployedAddresses["VoterDatabaseModule#VoterDatabase"];
const electionDbAddress =
  deployedAddresses["ElectionDatabaseModule#ElectionDatabase"];

// Create the deployment files
createDeploymentFile(
  "CandidateDatabase",
  candidateDBAddress,
  candidateDBArtifact.abi
);
createDeploymentFile("VoterDatabase", voterDBAddress, voterDBArtifact.abi);
createDeploymentFile(
  "ElectionDatabase",
  electionDbAddress,
  electionDBArtifact.abi
);

console.log("Deployment files created successfully!");
