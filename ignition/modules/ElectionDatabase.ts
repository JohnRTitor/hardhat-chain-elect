// Deploy with: hardhat ignition deploy ignition/modules/ElectionDatabase.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ElectionDatabaseModule = buildModule("ElectionDatabaseModule", (m) => {
  const voterDatabase = m.getParameter("voterDatabase");
  const candidateDatabase = m.getParameter("candidateDatabase");

  const electionDatabase = m.contract("ElectionDatabase", [
    voterDatabase,
    candidateDatabase,
  ]);

  return { electionDatabase };
});

export default ElectionDatabaseModule;
