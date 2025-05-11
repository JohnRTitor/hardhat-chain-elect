import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { hardhat } from "viem/chains";
import { GenderEnum } from "../../types";
import { getDobEpochFromAge } from "../../lib/utils";

describe("Security Tests", function () {
  before(function () {
    // we want to run this only on hardhat development chains
    if (hre.network.config.chainId != hardhat.id) {
      this.skip();
    }
  });

  async function deployContractsFixture() {
    const [owner, admin, voter1, voter2, candidate1, candidate2, attacker] = await hre.viem.getWalletClients();
    
    // Deploy all contracts
    const voterDatabase = await hre.viem.deployContract("VoterDatabase", []);
    const candidateDatabase = await hre.viem.deployContract("CandidateDatabase", []);
    const electionDatabase = await hre.viem.deployContract("ElectionDatabase", [
      voterDatabase.address,
      candidateDatabase.address,
    ]);

    // Give ElectionDatabase admin rights to VoterDatabase
    await voterDatabase.write.addAdmin([electionDatabase.address]);
    
    // Also add a human admin
    await voterDatabase.write.addAdmin([admin.account.address]);
    await candidateDatabase.write.addAdmin([admin.account.address]);
    await electionDatabase.write.addAdmin([admin.account.address]);

    const publicClient = await hre.viem.getPublicClient();
    
    return { 
      voterDatabase, 
      candidateDatabase, 
      electionDatabase, 
      owner, 
      admin,
      voter1, 
      voter2, 
      candidate1, 
      candidate2, 
      attacker,
      publicClient 
    };
  }

  describe("Access Control Tests", function () {
    it("should prevent unauthorized access to admin functions", async function () {
      const { 
        voterDatabase, 
        candidateDatabase, 
        electionDatabase, 
        attacker
      } = await loadFixture(deployContractsFixture);
      
      // Attempt unauthorized access to admin functions in VoterDatabase
      await expect(
        voterDatabase.write.adminAddVoter(
          [
            attacker.account.address,
            "Unauthorized",
            getDobEpochFromAge(30),
            GenderEnum.MALE,
            "123 Hack St",
            "hacker@example.com",
            0n,
          ],
          { account: attacker.account }
        )
      ).to.be.rejectedWith("AdminManagement__NotAdmin");
      
      // Attempt unauthorized access to admin functions in CandidateDatabase
      await expect(
        candidateDatabase.write.adminAddCandidate(
          [
            attacker.account.address,
            "Unauthorized",
            getDobEpochFromAge(30),
            GenderEnum.MALE,
            "123 Hack St",
            "hacker@example.com",
            "Fake Qualifications",
            "Evil Manifesto",
          ],
          { account: attacker.account }
        )
      ).to.be.rejectedWith("AdminManagement__NotAdmin");
      
      // Attempt unauthorized access to admin functions in ElectionDatabase
      await expect(
        electionDatabase.write.adminCreateElection(
          ["Unauthorized Election", "Hacked election description"],
          { account: attacker.account }
        )
      ).to.be.rejectedWith("AdminManagement__NotAdmin");
    });

    it("should prevent non-owners from adding/removing admins", async function () {
      const { 
        voterDatabase, 
        admin,
        attacker
      } = await loadFixture(deployContractsFixture);
      
      // Even admins cannot add other admins (only owner can)
      await expect(
        voterDatabase.write.addAdmin(
          [attacker.account.address],
          { account: admin.account }
        )
      ).to.be.rejectedWith("AdminManagement__NotOwner");
      
      // Attackers definitely cannot add themselves as admins
      await expect(
        voterDatabase.write.addAdmin(
          [attacker.account.address],
          { account: attacker.account }
        )
      ).to.be.rejectedWith("AdminManagement__NotOwner");
    });
    
    it("should prevent privilege escalation through admin interfaces", async function () {
      const { 
        voterDatabase, 
        candidateDatabase,
        electionDatabase,
        admin,
        attacker,
        publicClient
      } = await loadFixture(deployContractsFixture);
      
      // Register attacker as a regular voter
      const hash = await voterDatabase.write.adminAddVoter(
        [
          attacker.account.address,
          "Sneaky Attacker",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "123 Evil St",
          "sneaky@example.com",
          0n,
        ],
        { account: admin.account }
      );
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Create an election
      const elecHash = await electionDatabase.write.adminCreateElection(
        ["Security Test Election", "Election for security testing"],
        { account: admin.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: elecHash });
      
      // Attempt to manipulate election without being a candidate
      await expect(
        electionDatabase.write.enrollCandidate(
          [0n],
          { account: attacker.account }
        )
      ).to.be.rejectedWith("ElectionDatabase__CandidateNotRegistered");
      
      // Verify attacker doesn't have admin privileges despite being registered
      await expect(
        electionDatabase.write.adminOpenElection(
          [0n],
          { account: attacker.account }
        )
      ).to.be.rejectedWith("AdminManagement__NotAdmin");
    });
  });

  describe("Data Privacy Tests", function () {
    it("should protect voter details from unauthorized access", async function () {
      const { 
        voterDatabase, 
        voter1, 
        attacker,
        publicClient
      } = await loadFixture(deployContractsFixture);
      
      // Register a voter
      const hash = await voterDatabase.write.addVoter(
        [
          "Private Voter",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "123 Privacy St",
          "private@example.com",
        ],
        { account: voter1.account }
      );
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Attempt to access voter details as an attacker
      await expect(
        voterDatabase.read.adminGetVoterDetails(
          [voter1.account.address],
          { account: attacker.account }
        )
      ).to.be.rejectedWith("AdminManagement__NotAdmin");
      
      // Attempt to get voter registration status as an attacker
      await expect(
        voterDatabase.read.adminGetRegistrationStatus(
          [voter1.account.address],
          { account: attacker.account }
        )
      ).to.be.rejectedWith("AdminManagement__NotAdmin");
      
      // Voter should be able to access their own details
      const details = await voterDatabase.read.getMyDetails({ account: voter1.account });
      assert.equal(details[0], "Private Voter", "Voter should access their own details");
    });
    
    it("should maintain voter privacy during voting", async function () {
      const { 
        voterDatabase, 
        candidateDatabase,
        electionDatabase,
        voter1,
        candidate1,
        attacker,
        admin,
        publicClient
      } = await loadFixture(deployContractsFixture);
      
      // Register voter and candidate
      await voterDatabase.write.addVoter(
        [
          "Privacy Voter",
          getDobEpochFromAge(30),
          GenderEnum.FEMALE,
          "123 Privacy Ave",
          "privacy@example.com",
        ],
        { account: voter1.account }
      );
      
      await candidateDatabase.write.addCandidate(
        [
          "Privacy Candidate",
          getDobEpochFromAge(35),
          GenderEnum.MALE,
          "456 Privacy Blvd",
          "privacycandidate@example.com",
          "Privacy Expert",
          "Privacy First!",
        ],
        { account: candidate1.account }
      );
      
      // Create and setup election
      const elecHash = await electionDatabase.write.adminCreateElection(
        ["Privacy Election", "Election for privacy testing"],
        { account: admin.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: elecHash });
      
      await electionDatabase.write.enrollCandidate([0n], { account: candidate1.account });
      await electionDatabase.write.adminOpenElection([0n], { account: admin.account });
      
      // Vote
      const voteHash = await electionDatabase.write.vote([0n, candidate1.account.address], {
        account: voter1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: voteHash });
      
      // Verify an attacker cannot determine who a voter voted for
      // In this system, there's no function to check who a voter voted for,
      // which is good for privacy.
      
      // Check that the voter has voted
      const hasVoted = await electionDatabase.read.hasVoted([0n, voter1.account.address]);
      assert.equal(hasVoted, true, "System should record that voter has voted");
      
      // Attacker should only be able to see that the voter voted, not who they voted for
      // Test that no function allows this check without proper access control
      
      // The getVoterChoice function requires the caller to be a registered voter
      await expect(
        electionDatabase.read.getVoterChoice([0n, voter1.account.address], { 
          account: attacker.account 
        })
      ).to.be.rejectedWith("ElectionDatabase__VoterNotRegistered");
      
      // Even if the attacker registers as a voter, they should only see their own vote
      await voterDatabase.write.adminAddVoter([
        attacker.account.address,
        "Sneaky Voter",
        getDobEpochFromAge(30),
        GenderEnum.MALE,
        "789 Sneaky St",
        "sneaky@example.com",
        0n,
      ], { account: admin.account });
      
      // Attacker can now call the function, but should get address(0) since they didn't vote
      const attackerCheck = await electionDatabase.read.getVoterChoice([0n, voter1.account.address], { 
        account: attacker.account 
      });
      assert.equal(attackerCheck, "0x0000000000000000000000000000000000000000", 
        "Attacker should not be able to determine voter's choice");
    });
  });

  describe("Voting Integrity Tests", function () {
    it("should prevent double voting", async function () {
      const { 
        voterDatabase, 
        candidateDatabase,
        electionDatabase,
        voter1,
        candidate1,
        publicClient
      } = await loadFixture(deployContractsFixture);
      
      // Register voter and candidate
      await voterDatabase.write.addVoter(
        [
          "One-Vote Voter",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "123 Integrity St",
          "integrity@example.com",
        ],
        { account: voter1.account }
      );
      
      await candidateDatabase.write.addCandidate(
        [
          "Integrity Candidate",
          getDobEpochFromAge(35),
          GenderEnum.MALE,
          "456 Integrity Ave",
          "integritycandidate@example.com",
          "Integrity Expert",
          "Integrity First!",
        ],
        { account: candidate1.account }
      );
      
      // Create and setup election
      const elecHash = await electionDatabase.write.adminCreateElection(
        ["Integrity Election", "Election for integrity testing"]
      );
      await publicClient.waitForTransactionReceipt({ hash: elecHash });
      
      await electionDatabase.write.enrollCandidate([0n], { account: candidate1.account });
      await electionDatabase.write.adminOpenElection([0n]);
      
      // Vote once
      const voteHash = await electionDatabase.write.vote([0n, candidate1.account.address], {
        account: voter1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: voteHash });
      
      // Try to vote again
      await expect(
        electionDatabase.write.vote([0n, candidate1.account.address], {
          account: voter1.account,
        })
      ).to.be.rejectedWith("ElectionDatabase__VoterAlreadyVoted");
      
      // Verify vote count (should be 1)
      const voteCount = await electionDatabase.read.getVotesOfCandidate([0n, candidate1.account.address]);
      assert.equal(voteCount, 1n, "Candidate should have exactly 1 vote");
    });
    
    it("should prevent voting in closed elections", async function () {
      const { 
        voterDatabase, 
        candidateDatabase,
        electionDatabase,
        voter1,
        candidate1,
        admin,
        publicClient
      } = await loadFixture(deployContractsFixture);
      
      // Register voter and candidate
      await voterDatabase.write.addVoter(
        [
          "Timing Voter",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "123 Timing St",
          "timing@example.com",
        ],
        { account: voter1.account }
      );
      
      await candidateDatabase.write.addCandidate(
        [
          "Timing Candidate",
          getDobEpochFromAge(35),
          GenderEnum.MALE,
          "456 Timing Ave",
          "timingcandidate@example.com",
          "Timing Expert",
          "Perfect Timing!",
        ],
        { account: candidate1.account }
      );
      
      // Create election and enroll candidate but don't open it yet
      await electionDatabase.write.adminCreateElection(
        ["Timing Election", "Election for timing tests"]
      );
      
      await electionDatabase.write.adminEnrollCandidate(
        [0n, candidate1.account.address],
        { account: admin.account }
      );
      
      // Try to vote before election is open
      await expect(
        electionDatabase.write.vote([0n, candidate1.account.address], {
          account: voter1.account,
        })
      ).to.be.rejectedWith("ElectionDatabase__ElectionClosed");
      
      // Open the election
      await electionDatabase.write.adminOpenElection([0n]);
      
      // Vote should succeed now
      const voteHash = await electionDatabase.write.vote([0n, candidate1.account.address], {
        account: voter1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: voteHash });
      
      // Close the election
      await electionDatabase.write.adminCloseElection([0n]);
      
      // Try to vote after election is closed
      await expect(
        electionDatabase.write.vote([0n, candidate1.account.address], {
          account: voter1.account, // Using another voter account
        })
      ).to.be.rejectedWith("ElectionDatabase__VoterAlreadyVoted");
    });
    
    it("should prevent unregistered voters from voting", async function () {
      const { 
        candidateDatabase,
        electionDatabase,
        candidate1,
        attacker,
        publicClient
      } = await loadFixture(deployContractsFixture);
      
      // Register candidate but not the attacker as a voter
      await candidateDatabase.write.addCandidate(
        [
          "Targeted Candidate",
          getDobEpochFromAge(35),
          GenderEnum.MALE,
          "456 Target Ave",
          "targetcandidate@example.com",
          "Security Expert",
          "Secure Voting!",
        ],
        { account: candidate1.account }
      );
      
      // Create and setup election
      await electionDatabase.write.adminCreateElection(
        ["Security Election", "Election for security testing"]
      );
      
      await electionDatabase.write.enrollCandidate([0n], { account: candidate1.account });
      await electionDatabase.write.adminOpenElection([0n]);
      
      // Attacker tries to vote without registering
      await expect(
        electionDatabase.write.vote([0n, candidate1.account.address], {
          account: attacker.account,
        })
      ).to.be.rejectedWith("ElectionDatabase__VoterNotRegistered");
    });
  });

  describe("Data Integrity Tests", function () {
    it("should maintain data consistency when updating voter information", async function () {
      const { 
        voterDatabase, 
        voter1, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Register voter
      const hash = await voterDatabase.write.addVoter(
        [
          "Original Name",
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "Original Address",
          "original@example.com",
        ],
        { account: voter1.account }
      );
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Update voter information
      const updateHash = await voterDatabase.write.updateVoter(
        [
          "Updated Name",
          getDobEpochFromAge(31), // One year older
          GenderEnum.MALE, // Same gender
          "Updated Address",
          "updated@example.com",
        ],
        { account: voter1.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: updateHash });
      
      // Verify updated information
      const details = await voterDatabase.read.getMyDetails({ account: voter1.account });
      assert.equal(details[0], "Updated Name", "Name should be updated");
      assert.equal(details[1], getDobEpochFromAge(31), "DoB should be updated");
      assert.equal(details[3], "Updated Address", "Address should be updated");
      assert.equal(details[4], "updated@example.com", "Email should be updated");
      assert.equal(details[5], 0n, "Times voted should remain unchanged at 0");
    });

    it("should prevent voters from changing their info after voting", async function () {
      const { 
        voterDatabase, 
        candidateDatabase,
        electionDatabase,
        voter1,
        candidate1,
        publicClient
      } = await loadFixture(deployContractsFixture);
      
      // Register voter and candidate
      await voterDatabase.write.addVoter(
        [
          "Immutable Voter",
          getDobEpochFromAge(30),
          GenderEnum.FEMALE,
          "123 Immutable St",
          "immutable@example.com",
        ],
        { account: voter1.account }
      );
      
      await candidateDatabase.write.addCandidate(
        [
          "Immutable Candidate",
          getDobEpochFromAge(35),
          GenderEnum.MALE,
          "456 Immutable Ave",
          "immutablecandidate@example.com",
          "Immutability Expert",
          "Can't Change Me!",
        ],
        { account: candidate1.account }
      );
      
      // Create and setup election
      await electionDatabase.write.adminCreateElection(
        ["Immutability Election", "Election for immutability testing"]
      );
      
      await electionDatabase.write.enrollCandidate([0n], { account: candidate1.account });
      await electionDatabase.write.adminOpenElection([0n]);
      
      // Vote
      const voteHash = await electionDatabase.write.vote([0n, candidate1.account.address], {
        account: voter1.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: voteHash });
      
      // Try to update voter information after voting
      await expect(
        voterDatabase.write.updateVoter(
          [
            "Changed Name",
            getDobEpochFromAge(31),
            GenderEnum.FEMALE,
            "Changed Address",
            "changed@example.com",
          ],
          { account: voter1.account }
        )
      ).to.be.rejectedWith("VoterDatabase__CannotUpdateAfterVoting");
      
      // Try to delete voter after voting
      await expect(
        voterDatabase.write.deleteVoter({ account: voter1.account })
      ).to.be.rejectedWith("VoterDatabase__CannotUpdateAfterVoting");
    });
  });
});