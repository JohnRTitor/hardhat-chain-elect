// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition
// Deploy with: hardhat ignition deploy ignition/modules/VoterDatabase.ts

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const VoterDatabaseModule = buildModule("VoterDatabaseModule", (m) => {
  const voterDatabase = m.contract("VoterDatabase");

  return { voterDatabase };
});

export default VoterDatabaseModule;
