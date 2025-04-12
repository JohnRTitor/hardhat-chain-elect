// Deploy with: hardhat ignition deploy ignition/modules/CandidateDatabase.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CandidateDatabaseModule = buildModule("CandidateDatabaseModule", (m) => {
  const candidateDatabase = m.contract("CandidateDatabase");

  return { candidateDatabase };
});

export default CandidateDatabaseModule;
