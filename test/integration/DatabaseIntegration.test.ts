import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { hardhat } from "viem/chains";
import { GenderEnum } from "../../types";
import { getDobEpochFromAge } from "../../lib/utils";

describe("Database Integration Tests", function () {
  before(function () {
    // we want to run this only on hardhat development chains
    if (hre.network.config.chainId != hardhat.id) {
      this.skip();
    }
  });

  async function deployDatabasesFixture() {
    const [owner, voter1, voter2, candidate1, candidate2] = await hre.viem.getWalletClients();
    
    // Deploy VoterDatabase
    const voterDatabase = await hre.viem.deployContract("VoterDatabase", []);
    
    // Deploy CandidateDatabase
    const candidateDatabase = await hre.viem.deployContract("CandidateDatabase", []);
    
    // Deploy ElectionDatabase with the addresses of the other contracts
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

  describe("Database Integration", function () {
    it("should properly set up database references in ElectionDatabase", async function () {
      const { voterDatabase, candidateDatabase, electionDatabase } = await loadFixture(deployDatabasesFixture);
      
      const databases = await electionDatabase.read.getDatabases();
      assert.equal(getAddress(databases[0]), getAddress(voterDatabase.address));
      assert.equal(getAddress(databases[1]), getAddress(candidateDatabase.address));
    });

    it("should allow ElectionDatabase to mark voters through VoterDatabase", async function () {
      const { voterDatabase, electionDatabase, voter1, publicClient } = await loadFixture(deployDatabasesFixture);
      
      // Register voter1
      const hash1 = await voterDatabase.write.addVoter(
        [
          "Test Voter",
          getDobEpochFromAge(25),
          GenderEnum.MALE,
          "123 Test St",
          "test@example.com",
        ],
        {
          account: voter1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: hash1 });
      
      // Verify initial state
      const initialVotingStatus = await voterDatabase.read.getMyVotingStatus({
        account: voter1.account,
      });
      assert.equal(initialVotingStatus, false);

      // Have ElectionDatabase mark voter as voted (simulating a vote)
      // In a real scenario, this would be part of the vote function
      await voterDatabase.write.adminMarkVoted([voter1.account.address], {
        account: electionDatabase.account,
      });
      
      // Verify voter has been marked as voted
      const finalVotingStatus = await voterDatabase.read.getMyVotingStatus({
        account: voter1.account,
      });
      assert.equal(finalVotingStatus, true);
    });

    it("should respect voter age restrictions across contracts", async function () {
      const { voterDatabase, candidateDatabase, voter1, candidate1, publicClient } = 
        await loadFixture(deployDatabasesFixture);
      
      // Try to register an underage voter
      await expect(
        voterDatabase.write.addVoter(
          [
            "Underage Voter",
            getDobEpochFromAge(17), // Under 18
            GenderEnum.MALE,
            "123 Young St",
            "young@example.com",
          ],
          {
            account: voter1.account,
          }
        )
      ).to.be.rejectedWith("VoterDatabase__NotEligible");
      
      // Try to register an underage candidate
      await expect(
        candidateDatabase.write.addCandidate(
          [
            "Underage Candidate",
            getDobEpochFromAge(17), // Under 18
            GenderEnum.MALE,
            "456 Young Ave",
            "youngcandidate@example.com",
            "High School Student",
            "Youth representation",
          ],
          {
            account: candidate1.account,
          }
        )
      ).to.be.rejectedWith("CandidateDatabase__NotEligible");
    });
  });

  describe("Full Election Flow", function () {
    it("should support a complete election cycle from registration to voting", async function () {
      const { 
        voterDatabase, 
        candidateDatabase, 
        electionDatabase,
        owner, 
        voter1, 
        voter2, 
        candidate1, 
        candidate2, 
        publicClient 
      } = await loadFixture(deployDatabasesFixture);
      
      // 1. Register voters
      const voteHash1 = await voterDatabase.write.addVoter(
        [
          "John Voter",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "123 Voter St",
          "john@example.com",
        ],
        {
          account: voter1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: voteHash1 });
      
      const voteHash2 = await voterDatabase.write.addVoter(
        [
          "Jane Voter",
          getDobEpochFromAge(25),
          GenderEnum.FEMALE,
          "456 Voter Ave",
          "jane@example.com",
        ],
        {
          account: voter2.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: voteHash2 });
      
      // 2. Register candidates
      const candHash1 = await candidateDatabase.write.addCandidate(
        [
          "Alice Candidate",
          getDobEpochFromAge(35),
          GenderEnum.FEMALE,
          "789 Candidate Blvd",
          "alice@example.com",
          "PhD in Political Science",
          "Vote for progress!",
        ],
        {
          account: candidate1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: candHash1 });
      
      const candHash2 = await candidateDatabase.write.addCandidate(
        [
          "Bob Candidate",
          getDobEpochFromAge(40),
          GenderEnum.MALE,
          "101 Candidate Circle",
          "bob@example.com",
          "MBA, Former Mayor",
          "Experience matters!",
        ],
        {
          account: candidate2.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: candHash2 });
      
      // 3. Create an election
      const elecHash = await electionDatabase.write.adminCreateElection(
        ["City Mayor Election 2023", "Election for the position of City Mayor"]
      );
      await publicClient.waitForTransactionReceipt({ hash: elecHash });
      
      // 4. Enroll candidates in election
      const enrollHash1 = await electionDatabase.write.enrollCandidate([0n], {
        account: candidate1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: enrollHash1 });
      
      const enrollHash2 = await electionDatabase.write.enrollCandidate([0n], {
        account: candidate2.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: enrollHash2 });
      
      // Verify candidates are registered
      const enrolledCandidates = await electionDatabase.read.getRegisteredCandidates([0n]);
      assert.equal(enrolledCandidates.length, 2);
      assert.include(
        enrolledCandidates.map((addr) => getAddress(addr)),
        getAddress(candidate1.account.address)
      );
      assert.include(
        enrolledCandidates.map((addr) => getAddress(addr)),
        getAddress(candidate2.account.address)
      );
      
      // 5. Open the election
      const openHash = await electionDatabase.write.adminOpenElection([0n]);
      await publicClient.waitForTransactionReceipt({ hash: openHash });
      
      const isActive = await electionDatabase.read.getElectionStatus([0n]);
      assert.equal(isActive, true);
      
      // 6. Cast votes
      const voteHash = await electionDatabase.write.vote(
        [0n, candidate1.account.address],
        {
          account: voter1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: voteHash });
      
      // Verify vote was cast
      const voteCount = await electionDatabase.read.getVotesOfCandidate([
        0n,
        candidate1.account.address,
      ]);
      assert.equal(voteCount, 1n);
      
      // Verify voter status was updated
      const hasVoted = await electionDatabase.read.hasVoted([0n, voter1.account.address]);
      assert.equal(hasVoted, true);
      
      const voterStatus = await voterDatabase.read.getMyVotingStatus({
        account: voter1.account,
      });
      assert.equal(voterStatus, true);
      
      // 7. Close the election
      const closeHash = await electionDatabase.write.adminCloseElection([0n]);
      await publicClient.waitForTransactionReceipt({ hash: closeHash });
      
      const isActiveAfterClose = await electionDatabase.read.getElectionStatus([0n]);
      assert.equal(isActiveAfterClose, false);
      
      // 8. Get the winner
      const winner = await electionDatabase.read.getWinner([0n]);
      assert.equal(getAddress(winner), getAddress(candidate1.account.address));
    });
  });
});