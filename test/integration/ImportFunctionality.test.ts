import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { hardhat } from "viem/chains";
import { GenderEnum } from "../../types";
import { getDobEpochFromAge } from "../../lib/utils";

describe("Import Functionality Tests", function () {
  before(function () {
    // we want to run this only on hardhat development chains
    if (hre.network.config.chainId != hardhat.id) {
      this.skip();
    }
  });

  async function deployMultipleDatabasesFixture() {
    const [owner, voter1, voter2, candidate1, candidate2] = await hre.viem.getWalletClients();
    
    // Deploy two sets of databases (source and destination)
    // Source databases - these will have data to import from
    const sourceVoterDb = await hre.viem.deployContract("VoterDatabase", []);
    const sourceCandidateDb = await hre.viem.deployContract("CandidateDatabase", []);
    
    // Destination databases - these will import data from source
    const destVoterDb = await hre.viem.deployContract("VoterDatabase", []);
    const destCandidateDb = await hre.viem.deployContract("CandidateDatabase", []);
    
    const publicClient = await hre.viem.getPublicClient();
    
    // Add some data to the source databases
    // Add voters
    const voter1Hash = await sourceVoterDb.write.adminAddVoter([
      voter1.account.address,
      "John Source",
      getDobEpochFromAge(30),
      GenderEnum.MALE,
      "123 Source St",
      "john@source.com",
      0n
    ]);
    await publicClient.waitForTransactionReceipt({ hash: voter1Hash });
    
    const voter2Hash = await sourceVoterDb.write.adminAddVoter([
      voter2.account.address,
      "Jane Source",
      getDobEpochFromAge(25),
      GenderEnum.FEMALE,
      "456 Source Ave",
      "jane@source.com",
      1n
    ]);
    await publicClient.waitForTransactionReceipt({ hash: voter2Hash });
    
    // Add candidates
    const candidate1Hash = await sourceCandidateDb.write.adminAddCandidate([
      candidate1.account.address,
      "Alice Source",
      getDobEpochFromAge(35),
      GenderEnum.FEMALE,
      "789 Source Blvd",
      "alice@source.com",
      "PhD in Source Studies",
      "Source for all!"
    ]);
    await publicClient.waitForTransactionReceipt({ hash: candidate1Hash });
    
    const candidate2Hash = await sourceCandidateDb.write.adminAddCandidate([
      candidate2.account.address,
      "Bob Source",
      getDobEpochFromAge(40),
      GenderEnum.MALE,
      "101 Source Circle",
      "bob@source.com",
      "MBA, Source Expert",
      "True Source leadership!"
    ]);
    await publicClient.waitForTransactionReceipt({ hash: candidate2Hash });
    
    return { 
      sourceVoterDb, 
      sourceCandidateDb, 
      destVoterDb, 
      destCandidateDb,
      owner, 
      voter1, 
      voter2, 
      candidate1, 
      candidate2, 
      publicClient 
    };
  }

  describe("Voter Import Functionality", function () {
    it("should allow importing a single voter", async function () {
      const { 
        sourceVoterDb, 
        destVoterDb, 
        voter1, 
        publicClient 
      } = await loadFixture(deployMultipleDatabasesFixture);
      
      // Import a single voter from source to destination
      const importHash = await destVoterDb.write.adminImportVoter([
        sourceVoterDb.address,
        voter1.account.address
      ]);
      await publicClient.waitForTransactionReceipt({ hash: importHash });
      
      // Verify the voter was successfully imported
      const voterDetails = await destVoterDb.read.adminGetVoterDetails([voter1.account.address]);
      assert.equal(voterDetails[0], "John Source", "Voter name should match source");
      assert.equal(voterDetails[1], getDobEpochFromAge(30), "Voter DoB should match source");
      assert.equal(Number(voterDetails[2]), GenderEnum.MALE, "Voter gender should match source");
      assert.equal(voterDetails[3], "123 Source St", "Voter address should match source");
      assert.equal(voterDetails[4], "john@source.com", "Voter email should match source");
      assert.equal(voterDetails[5], 0n, "Voter voting status should match source");
    });

    it("should allow batch importing voters", async function () {
      const { 
        sourceVoterDb, 
        destVoterDb, 
        voter1, 
        voter2, 
        publicClient 
      } = await loadFixture(deployMultipleDatabasesFixture);
      
      // Get initial voter count in destination
      let voterCount = await destVoterDb.read.adminGetVoterCount();
      assert.equal(voterCount, 0n, "Initial voter count should be 0");
      
      // Batch import voters
      const importHash = await destVoterDb.write.adminBatchImportVoters([
        sourceVoterDb.address,
        [voter1.account.address, voter2.account.address]
      ]);
      await publicClient.waitForTransactionReceipt({ hash: importHash });
      
      // Verify voters were imported
      voterCount = await destVoterDb.read.adminGetVoterCount();
      assert.equal(voterCount, 2n, "Voter count should be 2 after import");
      
      // Check if voter data is correct
      const voter2Details = await destVoterDb.read.adminGetVoterDetails([voter2.account.address]);
      assert.equal(voter2Details[0], "Jane Source", "Voter name should match source");
      assert.equal(voter2Details[4], "jane@source.com", "Voter email should match source");
      assert.equal(voter2Details[5], 1n, "Voter voting status should match source");
    });

    it("should allow importing all voters", async function () {
      const { 
        sourceVoterDb, 
        destVoterDb, 
        publicClient 
      } = await loadFixture(deployMultipleDatabasesFixture);
      
      // Import all voters
      const importHash = await destVoterDb.write.adminImportAllVoters([
        sourceVoterDb.address
      ]);
      await publicClient.waitForTransactionReceipt({ hash: importHash });
      
      // Verify all voters were imported
      const voterCount = await destVoterDb.read.adminGetVoterCount();
      const sourceVoterCount = await sourceVoterDb.read.adminGetVoterCount();
      assert.equal(voterCount, sourceVoterCount, "All voters should have been imported");
      
      // Get all voters from destination and verify against source
      const destVoters = await destVoterDb.read.adminGetAllVoters();
      const sourceVoters = await sourceVoterDb.read.adminGetAllVoters();
      
      assert.equal(destVoters.length, sourceVoters.length, "All voters should have been imported");
      for (let i = 0; i < sourceVoters.length; i++) {
        assert.include(
          destVoters.map((addr) => getAddress(addr)),
          getAddress(sourceVoters[i]),
          `Voter at index ${i} should have been imported`
        );
      }
    });
    
    it("should handle duplicate imports correctly", async function () {
      const { 
        sourceVoterDb, 
        destVoterDb, 
        voter1, 
        publicClient 
      } = await loadFixture(deployMultipleDatabasesFixture);
      
      // Import a voter
      const importHash1 = await destVoterDb.write.adminImportVoter([
        sourceVoterDb.address,
        voter1.account.address
      ]);
      await publicClient.waitForTransactionReceipt({ hash: importHash1 });
      
      // Try to import the same voter again
      await expect(
        destVoterDb.write.adminImportVoter([
          sourceVoterDb.address,
          voter1.account.address
        ])
      ).to.be.rejectedWith("VoterDatabase__AlreadyRegistered");
      
      // Batch import should skip existing voters
      const initialCount = await destVoterDb.read.adminGetVoterCount();
      const importHash2 = await destVoterDb.write.adminBatchImportVoters([
        sourceVoterDb.address,
        [voter1.account.address] // Attempt to import already imported voter
      ]);
      await publicClient.waitForTransactionReceipt({ hash: importHash2 });
      
      const finalCount = await destVoterDb.read.adminGetVoterCount();
      assert.equal(finalCount, initialCount, "No new voters should have been imported");
    });
  });

  describe("Candidate Import Functionality", function () {
    it("should allow importing a single candidate", async function () {
      const { 
        sourceCandidateDb, 
        destCandidateDb, 
        candidate1, 
        publicClient 
      } = await loadFixture(deployMultipleDatabasesFixture);
      
      // Import a single candidate from source to destination
      const importHash = await destCandidateDb.write.adminImportCandidate([
        sourceCandidateDb.address,
        candidate1.account.address
      ]);
      await publicClient.waitForTransactionReceipt({ hash: importHash });
      
      // Verify the candidate was successfully imported
      const candidateDetails = await destCandidateDb.read.getCandidateDetails([candidate1.account.address]);
      assert.equal(candidateDetails[0], "Alice Source", "Candidate name should match source");
      assert.equal(candidateDetails[1], getDobEpochFromAge(35), "Candidate DoB should match source");
      assert.equal(Number(candidateDetails[2]), GenderEnum.FEMALE, "Candidate gender should match source");
      assert.equal(candidateDetails[3], "789 Source Blvd", "Candidate address should match source");
      assert.equal(candidateDetails[4], "alice@source.com", "Candidate email should match source");
      assert.equal(candidateDetails[5], "PhD in Source Studies", "Candidate qualifications should match source");
      assert.equal(candidateDetails[6], "Source for all!", "Candidate manifesto should match source");
    });

    it("should allow batch importing candidates", async function () {
      const { 
        sourceCandidateDb, 
        destCandidateDb, 
        candidate1, 
        candidate2, 
        publicClient 
      } = await loadFixture(deployMultipleDatabasesFixture);
      
      // Get initial candidate count in destination
      let candidateCount = await destCandidateDb.read.getCandidateCount();
      assert.equal(candidateCount, 0n, "Initial candidate count should be 0");
      
      // Batch import candidates
      const importHash = await destCandidateDb.write.adminBatchImportCandidates([
        sourceCandidateDb.address,
        [candidate1.account.address, candidate2.account.address]
      ]);
      await publicClient.waitForTransactionReceipt({ hash: importHash });
      
      // Verify candidates were imported
      candidateCount = await destCandidateDb.read.getCandidateCount();
      assert.equal(candidateCount, 2n, "Candidate count should be 2 after import");
      
      // Check if candidate data is correct
      const candidate2Details = await destCandidateDb.read.getCandidateDetails([candidate2.account.address]);
      assert.equal(candidate2Details[0], "Bob Source", "Candidate name should match source");
      assert.equal(candidate2Details[4], "bob@source.com", "Candidate email should match source");
      assert.equal(candidate2Details[5], "MBA, Source Expert", "Candidate qualifications should match source");
      assert.equal(candidate2Details[6], "True Source leadership!", "Candidate manifesto should match source");
    });

    it("should allow importing all candidates", async function () {
      const { 
        sourceCandidateDb, 
        destCandidateDb, 
        publicClient 
      } = await loadFixture(deployMultipleDatabasesFixture);
      
      // Import all candidates
      const importHash = await destCandidateDb.write.adminImportAllCandidates([
        sourceCandidateDb.address
      ]);
      await publicClient.waitForTransactionReceipt({ hash: importHash });
      
      // Verify all candidates were imported
      const candidateCount = await destCandidateDb.read.getCandidateCount();
      const sourceCandidateCount = await sourceCandidateDb.read.getCandidateCount();
      assert.equal(candidateCount, sourceCandidateCount, "All candidates should have been imported");
      
      // Get all candidates from destination and verify against source
      const destCandidates = await destCandidateDb.read.getAllCandidates();
      const sourceCandidates = await sourceCandidateDb.read.getAllCandidates();
      
      assert.equal(destCandidates.length, sourceCandidates.length, "All candidates should have been imported");
      for (let i = 0; i < sourceCandidates.length; i++) {
        assert.include(
          destCandidates.map((addr) => getAddress(addr)),
          getAddress(sourceCandidates[i]),
          `Candidate at index ${i} should have been imported`
        );
      }
    });
    
    it("should handle duplicate candidate imports correctly", async function () {
      const { 
        sourceCandidateDb, 
        destCandidateDb, 
        candidate1, 
        publicClient 
      } = await loadFixture(deployMultipleDatabasesFixture);
      
      // Import a candidate
      const importHash1 = await destCandidateDb.write.adminImportCandidate([
        sourceCandidateDb.address,
        candidate1.account.address
      ]);
      await publicClient.waitForTransactionReceipt({ hash: importHash1 });
      
      // Try to import the same candidate again
      await expect(
        destCandidateDb.write.adminImportCandidate([
          sourceCandidateDb.address,
          candidate1.account.address
        ])
      ).to.be.rejectedWith("CandidateDatabase__AlreadyRegistered");
      
      // Batch import should skip existing candidates
      const initialCount = await destCandidateDb.read.getCandidateCount();
      const importHash2 = await destCandidateDb.write.adminBatchImportCandidates([
        sourceCandidateDb.address,
        [candidate1.account.address] // Attempt to import already imported candidate
      ]);
      await publicClient.waitForTransactionReceipt({ hash: importHash2 });
      
      const finalCount = await destCandidateDb.read.getCandidateCount();
      assert.equal(finalCount, initialCount, "No new candidates should have been imported");
    });
  });

  describe("Import Error Handling", function () {
    it("should handle importing from invalid source contracts", async function () {
      const { 
        destVoterDb, 
        destCandidateDb, 
        voter1, 
        candidate1 
      } = await loadFixture(deployMultipleDatabasesFixture);
      
      // Try to import a voter from an invalid address (using candidate contract address)
      await expect(
        destVoterDb.write.adminImportVoter([
          destCandidateDb.address, // Invalid source for voters
          voter1.account.address
        ])
      ).to.be.rejectedWith("VoterDatabase__ImportFailed");
      
      // Try to import a candidate from an invalid address (using voter contract address)
      await expect(
        destCandidateDb.write.adminImportCandidate([
          destVoterDb.address, // Invalid source for candidates
          candidate1.account.address
        ])
      ).to.be.rejectedWith("CandidateDatabase__ImportFailed");
    });
    
    it("should enforce admin-only restrictions for imports", async function () {
      const { 
        sourceVoterDb, 
        sourceCandidateDb, 
        destVoterDb, 
        destCandidateDb, 
        voter1, 
        candidate1, 
        voter2 
      } = await loadFixture(deployMultipleDatabasesFixture);
      
      // Try to import a voter as a non-admin
      await expect(
        destVoterDb.write.adminImportVoter(
          [sourceVoterDb.address, voter1.account.address],
          { account: voter2.account }
        )
      ).to.be.rejectedWith("AdminManagement__NotAdmin");
      
      // Try to import a candidate as a non-admin
      await expect(
        destCandidateDb.write.adminImportCandidate(
          [sourceCandidateDb.address, candidate1.account.address],
          { account: voter2.account }
        )
      ).to.be.rejectedWith("AdminManagement__NotAdmin");
    });
  });
});