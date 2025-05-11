import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { hardhat } from "viem/chains";

describe("Admin Management Integration Tests", function () {
  before(function () {
    // we want to run this only on hardhat development chains
    if (hre.network.config.chainId != hardhat.id) {
      this.skip();
    }
  });

  async function deployContractsFixture() {
    const [owner, admin1, admin2, nonAdmin, randomUser] = await hre.viem.getWalletClients();
    
    // Deploy all three contracts
    const voterDatabase = await hre.viem.deployContract("VoterDatabase", []);
    const candidateDatabase = await hre.viem.deployContract("CandidateDatabase", []);
    const electionDatabase = await hre.viem.deployContract("ElectionDatabase", [
      voterDatabase.address,
      candidateDatabase.address,
    ]);

    const publicClient = await hre.viem.getPublicClient();
    
    return { 
      voterDatabase, 
      candidateDatabase, 
      electionDatabase, 
      owner, 
      admin1, 
      admin2, 
      nonAdmin,
      randomUser,
      publicClient 
    };
  }

  describe("Admin Permissions Across Contracts", function () {
    it("should consistently enforce admin permissions across all contracts", async function () {
      const { 
        voterDatabase, 
        candidateDatabase, 
        electionDatabase, 
        owner, 
        admin1, 
        admin2, 
        nonAdmin, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Add admin1 as admin to all contracts
      const voterAdminHash = await voterDatabase.write.addAdmin([admin1.account.address]);
      await publicClient.waitForTransactionReceipt({ hash: voterAdminHash });
      
      const candidateAdminHash = await candidateDatabase.write.addAdmin([admin1.account.address]);
      await publicClient.waitForTransactionReceipt({ hash: candidateAdminHash });
      
      const electionAdminHash = await electionDatabase.write.addAdmin([admin1.account.address]);
      await publicClient.waitForTransactionReceipt({ hash: electionAdminHash });
      
      // Add admin2 only to voterDatabase to test different admin configurations
      const voter2AdminHash = await voterDatabase.write.addAdmin([admin2.account.address]);
      await publicClient.waitForTransactionReceipt({ hash: voter2AdminHash });
      
      // Test admin status for each contract
      // VoterDatabase
      assert.equal(await voterDatabase.read.isAdmin([owner.account.address]), true, "Owner should be admin of VoterDatabase");
      assert.equal(await voterDatabase.read.isAdmin([admin1.account.address]), true, "Admin1 should be admin of VoterDatabase");
      assert.equal(await voterDatabase.read.isAdmin([admin2.account.address]), true, "Admin2 should be admin of VoterDatabase");
      assert.equal(await voterDatabase.read.isAdmin([nonAdmin.account.address]), false, "NonAdmin should not be admin of VoterDatabase");
      
      // CandidateDatabase
      assert.equal(await candidateDatabase.read.isAdmin([owner.account.address]), true, "Owner should be admin of CandidateDatabase");
      assert.equal(await candidateDatabase.read.isAdmin([admin1.account.address]), true, "Admin1 should be admin of CandidateDatabase");
      assert.equal(await candidateDatabase.read.isAdmin([admin2.account.address]), false, "Admin2 should not be admin of CandidateDatabase");
      
      // ElectionDatabase
      assert.equal(await electionDatabase.read.isAdmin([owner.account.address]), true, "Owner should be admin of ElectionDatabase");
      assert.equal(await electionDatabase.read.isAdmin([admin1.account.address]), true, "Admin1 should be admin of ElectionDatabase");
      assert.equal(await electionDatabase.read.isAdmin([admin2.account.address]), false, "Admin2 should not be admin of ElectionDatabase");
    });
    
    it("should enforce admin-only functions across all contracts", async function () {
      const { 
        voterDatabase, 
        candidateDatabase, 
        electionDatabase, 
        admin1, 
        nonAdmin, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Add admin1 as admin to all contracts
      const voterAdminHash = await voterDatabase.write.addAdmin([admin1.account.address]);
      await publicClient.waitForTransactionReceipt({ hash: voterAdminHash });
      
      const candidateAdminHash = await candidateDatabase.write.addAdmin([admin1.account.address]);
      await publicClient.waitForTransactionReceipt({ hash: candidateAdminHash });
      
      const electionAdminHash = await electionDatabase.write.addAdmin([admin1.account.address]);
      await publicClient.waitForTransactionReceipt({ hash: electionAdminHash });

      // Test admin functions with admin account
      // Create election with admin account
      const elecHash = await electionDatabase.write.adminCreateElection(
        ["Test Election", "Election for testing purposes"],
        { account: admin1.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: elecHash });
      
      // Test admin functions with non-admin account (should all fail)
      await expect(
        electionDatabase.write.adminCreateElection(
          ["Test Election", "Election for testing purposes"],
          { account: nonAdmin.account }
        )
      ).to.be.rejectedWith("AdminManagement__NotAdmin");
      
      await expect(
        voterDatabase.write.adminGetAllVoters({ account: nonAdmin.account })
      ).to.be.rejectedWith("AdminManagement__NotAdmin");
      
      await expect(
        candidateDatabase.write.adminAddCandidate(
          [
            nonAdmin.account.address,
            "Test Candidate",
            Math.floor(new Date().getTime() / 1000) - 30 * 365 * 24 * 60 * 60, // 30 years old
            0, // Male
            "123 Admin St",
            "candidate@example.com",
            "BSc",
            "Test Manifesto",
          ],
          { account: nonAdmin.account }
        )
      ).to.be.rejectedWith("AdminManagement__NotAdmin");
    });
    
    it("should handle admin removal correctly", async function () {
      const { 
        voterDatabase, 
        admin1, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Add admin1 as admin
      const addHash = await voterDatabase.write.addAdmin([admin1.account.address]);
      await publicClient.waitForTransactionReceipt({ hash: addHash });
      
      // Verify admin status
      assert.equal(await voterDatabase.read.isAdmin([admin1.account.address]), true, "Admin1 should be admin");
      
      // Get initial admin count
      const adminCountBefore = await voterDatabase.read.getAdminCount();
      
      // Remove admin1
      const removeHash = await voterDatabase.write.removeAdmin([admin1.account.address]);
      await publicClient.waitForTransactionReceipt({ hash: removeHash });
      
      // Verify admin status after removal
      assert.equal(await voterDatabase.read.isAdmin([admin1.account.address]), false, "Admin1 should no longer be admin");
      
      // Verify admin count has decreased
      const adminCountAfter = await voterDatabase.read.getAdminCount();
      assert.equal(Number(adminCountBefore) - 1, Number(adminCountAfter), "Admin count should decrease by 1");
      
      // Admin should no longer be able to call admin functions
      await expect(
        voterDatabase.write.adminGetAllVoters({ account: admin1.account })
      ).to.be.rejectedWith("AdminManagement__NotAdmin");
    });
  });
  
  describe("Cross-Contract Admin Operations", function () {
    it("should allow ElectionDatabase with admin rights to modify VoterDatabase", async function () {
      const { 
        voterDatabase, 
        electionDatabase, 
        nonAdmin, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Give ElectionDatabase admin rights to VoterDatabase
      const adminHash = await voterDatabase.write.addAdmin([electionDatabase.address]);
      await publicClient.waitForTransactionReceipt({ hash: adminHash });
      
      // Verify the admin status
      assert.equal(await voterDatabase.read.isAdmin([electionDatabase.address]), true, "ElectionDatabase should be admin of VoterDatabase");
      
      // Create an election
      const elecHash = await electionDatabase.write.adminCreateElection(
        ["Test Election", "Election for testing admin operations"]
      );
      await publicClient.waitForTransactionReceipt({ hash: elecHash });
      
      // Register a voter directly on VoterDatabase to simulate a user that will vote
      const voterHash = await voterDatabase.write.addVoter(
        [
          "Test Voter",
          Math.floor(new Date().getTime() / 1000) - 25 * 365 * 24 * 60 * 60, // 25 years old
          0, // Male
          "123 Voter St",
          "voter@example.com",
        ],
        { account: nonAdmin.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: voterHash });
      
      // Mark this voter as having voted through ElectionDatabase
      // (in a real scenario, this would happen as part of the voting process)
      await voterDatabase.write.adminMarkVoted([nonAdmin.account.address], {
        account: electionDatabase.account 
      });
      
      // Verify the voter was marked as having voted
      const hasVoted = await voterDatabase.read.getMyVotingStatus({
        account: nonAdmin.account
      });
      assert.equal(hasVoted, true, "Voter should be marked as having voted");
    });
    
    it("should handle complex admin hierarchies correctly", async function () {
      const { 
        voterDatabase, 
        candidateDatabase, 
        electionDatabase, 
        admin1, 
        admin2, 
        randomUser, 
        publicClient 
      } = await loadFixture(deployContractsFixture);
      
      // Create a hierarchy:
      // - admin1 is admin of all three contracts
      // - admin2 is admin of VoterDatabase and can make admin1 an admin of ElectionDatabase
      
      // Setup admin2 as admin of VoterDatabase
      const admin2Hash = await voterDatabase.write.addAdmin([admin2.account.address]);
      await publicClient.waitForTransactionReceipt({ hash: admin2Hash });
      
      // Setup admin1 as admin of CandidateDatabase
      const admin1CandHash = await candidateDatabase.write.addAdmin([admin1.account.address]);
      await publicClient.waitForTransactionReceipt({ hash: admin1CandHash });
      
      // Admin2 should NOT be able to add admin1 to ElectionDatabase
      await expect(
        electionDatabase.write.addAdmin([admin1.account.address], { account: admin2.account })
      ).to.be.rejectedWith("AdminManagement__NotOwner");
      
      // Only owner can add admin1 to ElectionDatabase
      const admin1ElecHash = await electionDatabase.write.addAdmin([admin1.account.address]);
      await publicClient.waitForTransactionReceipt({ hash: admin1ElecHash });
      
      // Now admin1 should be able to add another user as admin to ElectionDatabase
      const randUserHash = await electionDatabase.write.addAdmin([randomUser.account.address], {
        account: admin1.account
      });
      await publicClient.waitForTransactionReceipt({ hash: randUserHash });
      
      // This should fail because only owner can add admins
      await expect(
        electionDatabase.write.addAdmin([randomUser.account.address], { account: admin1.account })
      ).to.be.rejectedWith("AdminManagement__NotOwner");
      
      // Verify final admin statuses
      assert.equal(await voterDatabase.read.isAdmin([admin1.account.address]), false);
      assert.equal(await voterDatabase.read.isAdmin([admin2.account.address]), true);
      assert.equal(await candidateDatabase.read.isAdmin([admin1.account.address]), true);
      assert.equal(await candidateDatabase.read.isAdmin([admin2.account.address]), false);
      assert.equal(await electionDatabase.read.isAdmin([admin1.account.address]), true);
      assert.equal(await electionDatabase.read.isAdmin([admin2.account.address]), false);
    });
  });
});