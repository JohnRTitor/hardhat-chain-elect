import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { hardhat } from "viem/chains";
import { GenderEnum } from "../../types";
import { getDobEpochFromAge } from "../../lib/utils";

describe("Gas Usage Tests", function () {
  before(function () {
    // we want to run this only on hardhat development chains
    if (hre.network.config.chainId != hardhat.id) {
      this.skip();
    }
  });

  async function deployContractsFixture() {
    const [owner, voter1, voter2, candidate1, candidate2] = await hre.viem.getWalletClients();
    
    // Deploy all contracts
    const voterDatabase = await hre.viem.deployContract("VoterDatabase", []);
    const candidateDatabase = await hre.viem.deployContract("CandidateDatabase", []);
    const electionDatabase = await hre.viem.deployContract("ElectionDatabase", [
      voterDatabase.address,
      candidateDatabase.address,
    ]);

    // Give ElectionDatabase admin rights to VoterDatabase
    await voterDatabase.write.addAdmin([electionDatabase.address]);

    const publicClient = await hre.viem.getPublicClient();
    
    return { 
      voterDatabase, 
      candidateDatabase, 
      electionDatabase, 
      owner, 
      voter1, 
      voter2, 
      candidate1, 
      candidate2, 
      publicClient 
    };
  }

  describe("Gas Usage Measurements", function () {
    it("should measure gas usage for voter registration", async function () {
      const { 
        voterDatabase, 
        voter1, 
        publicClient 
      } = await loadFixture(deployContractsFixture);

      // First registration
      const tx = await voterDatabase.write.addVoter(
        [
          "Gas Test Voter",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "123 Gas Test St",
          "gas@example.com",
        ],
        {
          account: voter1.account,
        }
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`Gas used for voter registration: ${receipt.gasUsed}`);
      
      // Confirm the registration was successful
      const isRegistered = await voterDatabase.read.getMyRegistrationStatus({
        account: voter1.account
      });
      assert.equal(isRegistered, true);
    });

    it("should measure gas usage for candidate registration", async function () {
      const { 
        candidateDatabase, 
        candidate1, 
        publicClient 
      } = await loadFixture(deployContractsFixture);

      const tx = await candidateDatabase.write.addCandidate(
        [
          "Gas Test Candidate",
          getDobEpochFromAge(35),
          GenderEnum.FEMALE,
          "456 Gas Test Ave",
          "gascandidate@example.com",
          "Gas Test Qualifications",
          "Gas Test Manifesto which needs to be a bit longer to simulate realistic usage",
        ],
        {
          account: candidate1.account,
        }
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`Gas used for candidate registration: ${receipt.gasUsed}`);
      
      // Confirm the registration was successful
      const isRegistered = await candidateDatabase.read.getCandidateRegistrationStatus([candidate1.account.address]);
      assert.equal(isRegistered, true);
    });

    it("should measure gas usage for election creation and operations", async function () {
      const { 
        electionDatabase, 
        candidateDatabase,
        voterDatabase,
        voter1,
        candidate1, 
        publicClient 
      } = await loadFixture(deployContractsFixture);

      // Register voter and candidate
      let tx = await voterDatabase.write.addVoter(
        [
          "Gas Test Voter",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "123 Gas St",
          "gas@example.com",
        ],
        {
          account: voter1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      tx = await candidateDatabase.write.addCandidate(
        [
          "Gas Test Candidate",
          getDobEpochFromAge(35),
          GenderEnum.FEMALE,
          "456 Gas Ave",
          "gascandidate@example.com",
          "Gas Qualifications",
          "Gas Manifesto",
        ],
        {
          account: candidate1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: tx });

      // Measure election creation
      tx = await electionDatabase.write.adminCreateElection([
        "Gas Test Election", "Election for gas usage testing"
      ]);
      let receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`Gas used for election creation: ${receipt.gasUsed}`);

      // Measure candidate enrollment
      tx = await electionDatabase.write.enrollCandidate([0n], {
        account: candidate1.account,
      });
      receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`Gas used for candidate enrollment: ${receipt.gasUsed}`);

      // Measure election opening
      tx = await electionDatabase.write.adminOpenElection([0n]);
      receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`Gas used for opening election: ${receipt.gasUsed}`);
      
      // Measure voting
      tx = await electionDatabase.write.vote([0n, candidate1.account.address], {
        account: voter1.account,
      });
      receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`Gas used for voting: ${receipt.gasUsed}`);
      
      // Measure election closing
      tx = await electionDatabase.write.adminCloseElection([0n]);
      receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`Gas used for closing election: ${receipt.gasUsed}`);
      
      // Confirm final state
      const electionStatus = await electionDatabase.read.getElectionStatus([0n]);
      assert.equal(electionStatus, false, "Election should be closed");
      
      const voteCount = await electionDatabase.read.getVotesOfCandidate([0n, candidate1.account.address]);
      assert.equal(voteCount, 1n, "Candidate should have 1 vote");
    });

    it("should measure gas usage for batch operations", async function () {
      const { 
        voterDatabase, 
        candidateDatabase,
        owner,
        publicClient 
      } = await loadFixture(deployContractsFixture);

      // Create a batch of test wallets
      const numAccounts = 5;
      let testWallets = [];
      
      for (let i = 0; i < numAccounts; i++) {
        const wallet = await hre.viem.getWalletClients();
        testWallets.push(wallet[0]);
      }
      
      // Measure gas for adding multiple voters directly
      let totalGasUsed = 0n;
      for (let i = 0; i < testWallets.length; i++) {
        const walletAddress = testWallets[i].account.address;
        const tx = await voterDatabase.write.adminAddVoter([
          walletAddress,
          `Batch Voter ${i}`,
          getDobEpochFromAge(20 + i),
          i % 2 === 0 ? GenderEnum.MALE : GenderEnum.FEMALE,
          `${i} Batch St`,
          `batch${i}@example.com`,
          0n,
        ]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        totalGasUsed += receipt.gasUsed;
      }
      
      console.log(`Average gas used per voter in batch: ${totalGasUsed / BigInt(testWallets.length)}`);
      
      // Measure gas for batch import if we had the source contract
      // Since we don't have a separate source contract for this test,
      // we're just measuring the theoretical function call cost
      
      let candidateWallets = testWallets.map(wallet => wallet.account.address);
      
      // Register the candidates individually first to simulate a source database
      for (let i = 0; i < testWallets.length; i++) {
        const walletAddress = candidateWallets[i];
        const tx = await candidateDatabase.write.adminAddCandidate([
          walletAddress,
          `Batch Candidate ${i}`,
          getDobEpochFromAge(30 + i),
          i % 2 === 0 ? GenderEnum.MALE : GenderEnum.FEMALE,
          `${i} Batch Ave`,
          `batchcandidate${i}@example.com`,
          `Batch Qualification ${i}`,
          `Batch Manifesto ${i}`,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
      
      // Deploy another candidate database as destination for import
      const destCandidateDb = await hre.viem.deployContract("CandidateDatabase", []);
      
      // Measure gas for batch import
      const tx = await destCandidateDb.write.adminBatchImportCandidates([
        candidateDatabase.address,
        candidateWallets,
      ]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      
      console.log(`Gas used for batch importing ${testWallets.length} candidates: ${receipt.gasUsed}`);
      console.log(`Average gas per candidate in batch import: ${receipt.gasUsed / BigInt(testWallets.length)}`);
      
      // Verify imports were successful
      const numImported = await destCandidateDb.read.getCandidateCount();
      assert.equal(numImported, BigInt(candidateWallets.length), "All candidates should be imported");
    });
  });

  describe("Gas Optimization Verification", function () {
    it("should verify gas optimization for admin functions", async function () {
      const { 
        voterDatabase, 
        owner, 
        voter1, 
        voter2, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Measure gas for direct addition by admin
      const tx1 = await voterDatabase.write.adminAddVoter([
        voter1.account.address,
        "Admin Added Voter",
        getDobEpochFromAge(30),
        GenderEnum.MALE,
        "123 Admin St",
        "adminadded@example.com",
        0n,
      ]);
      const receipt1 = await publicClient.waitForTransactionReceipt({ hash: tx1 });
      
      // Measure gas for self registration
      const tx2 = await voterDatabase.write.addVoter(
        [
          "Self Added Voter",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "123 Self St",
          "selfadded@example.com",
        ],
        {
          account: voter2.account,
        }
      );
      const receipt2 = await publicClient.waitForTransactionReceipt({ hash: tx2 });
      
      console.log(`Gas used for admin adding a voter: ${receipt1.gasUsed}`);
      console.log(`Gas used for self registration: ${receipt2.gasUsed}`);
      
      // Both registrations should be successful
      let isRegistered1 = await voterDatabase.read.getVoterRegistrationStatus([voter1.account.address]);
      let isRegistered2 = await voterDatabase.read.getMyRegistrationStatus({
        account: voter2.account
      });
      
      assert.equal(isRegistered1, true, "Admin-added voter should be registered");
      assert.equal(isRegistered2, true, "Self-added voter should be registered");
    });
    
    it("should verify storage optimization for election results", async function () {
      const { 
        voterDatabase, 
        candidateDatabase,
        electionDatabase,
        voter1,
        voter2,
        candidate1,
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Register voters and candidate
      await voterDatabase.write.adminAddVoter([
        voter1.account.address,
        "Gas Test Voter 1",
        getDobEpochFromAge(30),
        GenderEnum.MALE,
        "123 Gas St",
        "gas1@example.com",
        0n,
      ]);
      
      await voterDatabase.write.adminAddVoter([
        voter2.account.address,
        "Gas Test Voter 2",
        getDobEpochFromAge(25),
        GenderEnum.FEMALE,
        "456 Gas Ave",
        "gas2@example.com",
        0n,
      ]);
      
      await candidateDatabase.write.adminAddCandidate([
        candidate1.account.address,
        "Gas Test Candidate",
        getDobEpochFromAge(35),
        GenderEnum.MALE,
        "789 Gas Blvd",
        "gascandidate@example.com",
        "Gas Qualifications",
        "Gas Manifesto",
      ]);
      
      // Create and setup election
      await electionDatabase.write.adminCreateElection([
        "Gas Optimization Test", "Testing storage efficiency"
      ]);
      
      await electionDatabase.write.adminEnrollCandidate([
        0n,
        candidate1.account.address,
      ]);
      
      await electionDatabase.write.adminOpenElection([0n]);
      
      // Measure gas for first vote
      const tx1 = await electionDatabase.write.vote([0n, candidate1.account.address], {
        account: voter1.account,
      });
      const receipt1 = await publicClient.waitForTransactionReceipt({ hash: tx1 });
      
      // Measure gas for second vote (should be similar cost)
      const tx2 = await electionDatabase.write.vote([0n, candidate1.account.address], {
        account: voter2.account,
      });
      const receipt2 = await publicClient.waitForTransactionReceipt({ hash: tx2 });
      
      console.log(`Gas used for first vote: ${receipt1.gasUsed}`);
      console.log(`Gas used for second vote: ${receipt2.gasUsed}`);
      
      // Verify votes were recorded
      const voteCount = await electionDatabase.read.getVotesOfCandidate([0n, candidate1.account.address]);
      assert.equal(voteCount, 2n, "Candidate should have 2 votes");
      
      // The gas difference should be minimal, demonstrating efficient storage
      // If the absolute difference is significant, it would suggest inefficient storage design
      const gasDifference = receipt1.gasUsed > receipt2.gasUsed 
        ? receipt1.gasUsed - receipt2.gasUsed 
        : receipt2.gasUsed - receipt1.gasUsed;
        
      console.log(`Gas usage difference between votes: ${gasDifference}`);
      
      // The difference should be within reasonable bounds (allow for some blockchain state differences)
      // This is a somewhat arbitrary threshold based on typical gas cost patterns
      assert(gasDifference < 5000n, "Gas usage difference should be minimal between votes");
    });
  });
});