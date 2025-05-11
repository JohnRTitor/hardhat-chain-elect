import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { hardhat } from "viem/chains";
import { GenderEnum } from "../../types";
import { getDobEpochFromAge } from "../../lib/utils";

describe("Edge Cases Tests", function () {
  before(function () {
    // we want to run this only on hardhat development chains
    if (hre.network.config.chainId != hardhat.id) {
      this.skip();
    }
  });

  async function deployContractsFixture() {
    const [owner, voter1, voter2, candidate1, candidate2, attacker] = await hre.viem.getWalletClients();
    
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
      attacker,
      publicClient 
    };
  }

  describe("Boundary Conditions", function () {
    it("should handle minimum eligible age exactly at boundary", async function () {
      const { 
        voterDatabase, 
        voter1, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Register voter at exactly 18 years old
      const hash = await voterDatabase.write.addVoter(
        [
          "Exactly18",
          getDobEpochFromAge(18), // Exactly 18 years old
          GenderEnum.MALE,
          "18 Boundary St",
          "eighteen@example.com",
        ],
        {
          account: voter1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Verify registration was successful
      const isRegistered = await voterDatabase.read.getMyRegistrationStatus({
        account: voter1.account
      });
      assert.equal(isRegistered, true, "Voter exactly 18 should be registered");
    });

    it("should handle extremely old ages correctly", async function () {
      const { 
        candidateDatabase, 
        candidate1, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Register candidate with a very old age (e.g., 120)
      const hash = await candidateDatabase.write.addCandidate(
        [
          "SuperOld",
          getDobEpochFromAge(120),
          GenderEnum.MALE,
          "999 Ancients Ave",
          "ancient@example.com",
          "Centuries of Experience",
          "Wisdom of Ages",
        ],
        {
          account: candidate1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Verify registration was successful
      const isRegistered = await candidateDatabase.read.getCandidateRegistrationStatus([candidate1.account.address]);
      assert.equal(isRegistered, true, "Very old candidate should be registered");
    });
    
    it("should handle elections with maximum number of candidates", async function () {
      const { 
        candidateDatabase, 
        electionDatabase, 
        owner, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Create an election
      const elecHash = await electionDatabase.write.adminCreateElection([
        "Mass Election", "Election with many candidates"
      ]);
      await publicClient.waitForTransactionReceipt({ hash: elecHash });
      
      // Deploy multiple wallets for candidates
      const numCandidates = 10; // Can be increased based on gas limits
      let candidates = [];
      
      // Create and register multiple candidates 
      for (let i = 0; i < numCandidates; i++) {
        // Create a new wallet for each candidate
        const wallet = await hre.viem.getWalletClients();
        const candidateWallet = wallet[0]; // Always get first in new array
        candidates.push(candidateWallet);
        
        // Register candidate through admin function (for simplicity)
        const hash = await candidateDatabase.write.adminAddCandidate([
          candidateWallet.account.address,
          `Candidate ${i}`,
          getDobEpochFromAge(30 + i),
          i % 2 ? GenderEnum.MALE : GenderEnum.FEMALE,
          `${i} Candidate St`,
          `candidate${i}@example.com`,
          `Qualification ${i}`,
          `Manifesto ${i}`,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });
        
        // Enroll candidate in election through admin function
        const enrollHash = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidateWallet.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: enrollHash });
      }
      
      // Verify all candidates were enrolled
      const enrolledCandidates = await electionDatabase.read.getRegisteredCandidates([0n]);
      assert.equal(enrolledCandidates.length, numCandidates, `All ${numCandidates} candidates should be enrolled`);
    });
  });

  describe("Invalid Operations", function () {
    it("should prevent re-opening an already open election", async function () {
      const { 
        electionDatabase, 
        candidateDatabase, 
        candidate1, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Create an election
      const elecHash = await electionDatabase.write.adminCreateElection([
        "Duplicate Open Test", "Testing duplicate open operations"
      ]);
      await publicClient.waitForTransactionReceipt({ hash: elecHash });
      
      // Register and enroll candidate
      const regHash = await candidateDatabase.write.addCandidate(
        [
          "Candidate",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "123 Test St",
          "candidate@example.com",
          "Test Qualification",
          "Test Manifesto"
        ],
        {
          account: candidate1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: regHash });
      
      const enrollHash = await electionDatabase.write.enrollCandidate([0n], {
        account: candidate1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: enrollHash });
      
      // Open the election
      const openHash = await electionDatabase.write.adminOpenElection([0n]);
      await publicClient.waitForTransactionReceipt({ hash: openHash });
      
      // Try to open it again
      // This should still work but have no effect since it's already open
      const reopenHash = await electionDatabase.write.adminOpenElection([0n]);
      await publicClient.waitForTransactionReceipt({ hash: reopenHash });
      
      // Verify election is still active
      const isActive = await electionDatabase.read.getElectionStatus([0n]);
      assert.equal(isActive, true, "Election should remain active after duplicate open");
    });

    it("should prevent enrolling in non-existent elections", async function () {
      const { 
        electionDatabase, 
        candidateDatabase, 
        candidate1, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Register candidate
      const regHash = await candidateDatabase.write.addCandidate(
        [
          "Candidate",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "123 Test St",
          "candidate@example.com",
          "Test Qualification",
          "Test Manifesto"
        ],
        {
          account: candidate1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: regHash });
      
      // Try to enroll in non-existent election
      const nonexistentElectionId = 999n;
      await expect(
        electionDatabase.write.enrollCandidate([nonexistentElectionId], {
          account: candidate1.account,
        })
      ).to.be.rejectedWith("ElectionDatabase__ElectionNotFound");
    });
    
    it("should prevent getting the winner of an election with no votes", async function () {
      const { 
        electionDatabase, 
        candidateDatabase, 
        candidate1, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Create an election
      const elecHash = await electionDatabase.write.adminCreateElection([
        "No Votes Election", "Election with no votes cast"
      ]);
      await publicClient.waitForTransactionReceipt({ hash: elecHash });
      
      // Register and enroll candidate
      const regHash = await candidateDatabase.write.addCandidate(
        [
          "Candidate",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "123 Test St",
          "candidate@example.com",
          "Test Qualification",
          "Test Manifesto"
        ],
        {
          account: candidate1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: regHash });
      
      const enrollHash = await electionDatabase.write.enrollCandidate([0n], {
        account: candidate1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: enrollHash });
      
      // Open the election
      const openHash = await electionDatabase.write.adminOpenElection([0n]);
      await publicClient.waitForTransactionReceipt({ hash: openHash });
      
      // Get the winner (should be address(0) since no votes were cast)
      const winner = await electionDatabase.read.getWinner([0n]);
      assert.equal(winner, "0x0000000000000000000000000000000000000000", "Winner should be zero address when no votes");
      
      // Close the election
      const closeHash = await electionDatabase.write.adminCloseElection([0n]);
      await publicClient.waitForTransactionReceipt({ hash: closeHash });
    });
  });

  describe("Race Conditions and Multiple Updates", function () {
    it("should handle sequential updates to voter information correctly", async function () {
      const { 
        voterDatabase, 
        voter1, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Register voter
      const regHash = await voterDatabase.write.addVoter(
        [
          "Original Name",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "Original Address",
          "original@example.com",
        ],
        {
          account: voter1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: regHash });
      
      // Update voter information multiple times in sequence
      const updates = [
        {
          name: "First Update",
          age: 31,
          gender: GenderEnum.MALE,
          address: "First Update Address",
          email: "first@example.com"
        },
        {
          name: "Second Update",
          age: 32,
          gender: GenderEnum.FEMALE,
          address: "Second Update Address",
          email: "second@example.com"
        },
        {
          name: "Final Update",
          age: 33,
          gender: GenderEnum.MALE,
          address: "Final Update Address",
          email: "final@example.com"
        }
      ];
      
      for (const update of updates) {
        const updateHash = await voterDatabase.write.updateVoter(
          [
            update.name,
            getDobEpochFromAge(update.age),
            update.gender,
            update.address,
            update.email,
          ],
          {
            account: voter1.account,
          }
        );
        await publicClient.waitForTransactionReceipt({ hash: updateHash });
      }
      
      // Verify final state
      const finalDetails = await voterDatabase.read.getMyDetails({
        account: voter1.account
      });
      const lastUpdate = updates[updates.length - 1];
      
      assert.equal(finalDetails[0], lastUpdate.name, "Name should match last update");
      assert.equal(finalDetails[1], getDobEpochFromAge(lastUpdate.age), "Age should match last update");
      assert.equal(Number(finalDetails[2]), lastUpdate.gender, "Gender should match last update");
      assert.equal(finalDetails[3], lastUpdate.address, "Address should match last update");
      assert.equal(finalDetails[4], lastUpdate.email, "Email should match last update");
    });

    it("should handle tie votes correctly", async function () {
      const { 
        voterDatabase,
        candidateDatabase, 
        electionDatabase, 
        voter1, 
        voter2, 
        candidate1, 
        candidate2, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Create an election
      const elecHash = await electionDatabase.write.adminCreateElection([
        "Tie Election", "Election to test tie votes"
      ]);
      await publicClient.waitForTransactionReceipt({ hash: elecHash });
      
      // Register voters
      const voter1Hash = await voterDatabase.write.addVoter(
        [
          "Voter One",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "123 Voter St",
          "voter1@example.com",
        ],
        {
          account: voter1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: voter1Hash });
      
      const voter2Hash = await voterDatabase.write.addVoter(
        [
          "Voter Two",
          getDobEpochFromAge(25),
          GenderEnum.FEMALE,
          "456 Voter Ave",
          "voter2@example.com",
        ],
        {
          account: voter2.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: voter2Hash });
      
      // Register candidates
      const cand1Hash = await candidateDatabase.write.addCandidate(
        [
          "Candidate One",
          getDobEpochFromAge(35),
          GenderEnum.MALE,
          "123 Candidate St",
          "candidate1@example.com",
          "Qualification One",
          "Manifesto One",
        ],
        {
          account: candidate1.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: cand1Hash });
      
      const cand2Hash = await candidateDatabase.write.addCandidate(
        [
          "Candidate Two",
          getDobEpochFromAge(40),
          GenderEnum.FEMALE,
          "456 Candidate Ave",
          "candidate2@example.com",
          "Qualification Two",
          "Manifesto Two",
        ],
        {
          account: candidate2.account,
        }
      );
      await publicClient.waitForTransactionReceipt({ hash: cand2Hash });
      
      // Enroll candidates
      const enroll1Hash = await electionDatabase.write.enrollCandidate([0n], {
        account: candidate1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: enroll1Hash });
      
      const enroll2Hash = await electionDatabase.write.enrollCandidate([0n], {
        account: candidate2.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: enroll2Hash });
      
      // Open the election
      const openHash = await electionDatabase.write.adminOpenElection([0n]);
      await publicClient.waitForTransactionReceipt({ hash: openHash });
      
      // Cast votes - one for each candidate
      const vote1Hash = await electionDatabase.write.vote([0n, candidate1.account.address], {
        account: voter1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: vote1Hash });
      
      const vote2Hash = await electionDatabase.write.vote([0n, candidate2.account.address], {
        account: voter2.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: vote2Hash });
      
      // Get the winner - should be the first candidate enrolled in case of tie
      const winner = await electionDatabase.read.getWinner([0n]);
      assert.equal(getAddress(winner), getAddress(candidate1.account.address), 
        "First enrolled candidate should win in case of tie");
      
      // Verify vote counts
      const votes1 = await electionDatabase.read.getVotesOfCandidate([0n, candidate1.account.address]);
      const votes2 = await electionDatabase.read.getVotesOfCandidate([0n, candidate2.account.address]);
      assert.equal(votes1, 1n, "Candidate 1 should have 1 vote");
      assert.equal(votes2, 1n, "Candidate 2 should have 1 vote");
    });
  });

  describe("Zero Address and Deployment Edge Cases", function () {
    it("should revert when attempting to deploy ElectionDatabase with zero address", async function () {
      await expect(
        hre.viem.deployContract("ElectionDatabase", [
          "0x0000000000000000000000000000000000000000", // Zero address for VoterDatabase
          "0x0000000000000000000000000000000000000000"  // Zero address for CandidateDatabase
        ])
      ).to.be.rejectedWith("ElectionDatabase__InvalidAddress");
    });

    it("should handle zero address checks in admin functions", async function () {
      const { 
        voterDatabase, 
        candidateDatabase 
      } = await loadFixture(deployContractsFixture);
      
      // Try to add zero address as admin
      await expect(
        voterDatabase.write.addAdmin(["0x0000000000000000000000000000000000000000"])
      ).to.be.rejectedWith("AdminManagement__InvalidAddress");
      
      // Try to add zero address as voter
      await expect(
        voterDatabase.write.adminAddVoter([
          "0x0000000000000000000000000000000000000000",
          "Zero Address",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "Zero Street",
          "zero@example.com",
          0n
        ])
      ).to.be.rejectedWith("VoterDatabase__InvalidAddress");
      
      // Try to add zero address as candidate
      await expect(
        candidateDatabase.write.adminAddCandidate([
          "0x0000000000000000000000000000000000000000",
          "Zero Candidate",
          getDobEpochFromAge(35),
          GenderEnum.MALE,
          "Zero Avenue",
          "zerocandidate@example.com",
          "Zero Qualification",
          "Zero Manifesto"
        ])
      ).to.be.rejectedWith("CandidateDatabase__InvalidAddress");
    });
  });
});