import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { hardhat } from "viem/chains";

describe("VoterDatabase Unit Tests", function () {
  before(function () {
    // we want to run this only on hardhat development chains
    if (hre.network.config.chainId != hardhat.id) {
      this.skip();
    }
  });

  async function deployVoterDatabaseFixture() {
    const [owner, otherAccount, thirdAccount] =
      await hre.viem.getWalletClients();
    const voterDatabase = await hre.viem.deployContract("VoterDatabase", []);
    const publicClient = await hre.viem.getPublicClient();
    return { voterDatabase, owner, otherAccount, thirdAccount, publicClient };
  }

  describe("addVoter", function () {
    it("should revert if under 18", async function () {
      const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);
      await expect(
        voterDatabase.write.addVoter(["Alice", BigInt(17), 0, "Some Address"])
      ).to.be.rejectedWith("VoterDatabase__NotEligible");
    });

    it("should revert if already registered", async function () {
      const { voterDatabase, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash = await voterDatabase.write.addVoter([
        "Alice",
        BigInt(20),
        1,
        "Some Address",
      ]);
      await publicClient.waitForTransactionReceipt({ hash });
      await expect(
        voterDatabase.write.addVoter(["Alice", BigInt(20), 1, "Some Address"])
      ).to.be.rejectedWith("VoterDatabase__AlreadyRegistered");
    });

    it("should emit VoterRegistered on success", async function () {
      const { voterDatabase, owner, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash = await voterDatabase.write.addVoter([
        "Alice",
        BigInt(20),
        0,
        "Some Address",
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const events = await voterDatabase.getEvents.VoterRegistered();
      expect(events).to.have.lengthOf(1);
      assert.equal(events[0].args.voter, getAddress(owner.account.address));
    });

    it("should correctly store voter details", async function () {
      const { voterDatabase, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash = await voterDatabase.write.addVoter([
        "Alice",
        BigInt(25),
        0,
        "123 Main St",
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const details = await voterDatabase.read.getMyDetails();
      assert.equal(details[0], "Alice");
      assert.equal(details[1], 25n);
      assert.equal(details[2], 0);
      assert.equal(details[3], "123 Main St");
      assert.equal(details[4], false); // hasVoted should be false
    });
  });

  describe("updateVoter", function () {
    it("should revert if not registered", async function () {
      const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);
      await expect(
        voterDatabase.write.updateVoter(["Bob", BigInt(30), 1, "New Address"])
      ).to.be.rejectedWith("VoterDatabase__NotRegistered");
    });

    it("should revert if already voted", async function () {
      const { voterDatabase, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash1 = await voterDatabase.write.addVoter([
        "Bob",
        BigInt(30),
        1,
        "Some Address",
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await voterDatabase.write.markVoted();
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      await expect(
        voterDatabase.write.updateVoter([
          "BobUpdated",
          BigInt(31),
          1,
          "Updated Address",
        ])
      ).to.be.rejectedWith("VoterDatabase__CannotUpdateAfterVoting");
    });

    it("should emit VoterUpdated on success", async function () {
      const { voterDatabase, owner, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash1 = await voterDatabase.write.addVoter([
        "Charlie",
        BigInt(22),
        0,
        "Some Address",
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await voterDatabase.write.updateVoter([
        "Charles",
        BigInt(23),
        0,
        "New Address",
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const events = await voterDatabase.getEvents.VoterUpdated();
      expect(events).to.have.lengthOf(1);
      assert.equal(events[0].args.voter, getAddress(owner.account.address));
    });

    it("should correctly update voter details", async function () {
      const { voterDatabase, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash1 = await voterDatabase.write.addVoter([
        "David",
        BigInt(40),
        0,
        "Old Street",
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await voterDatabase.write.updateVoter([
        "Dave",
        BigInt(41),
        1,
        "New Street",
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const details = await voterDatabase.read.getMyDetails();
      assert.equal(details[0], "Dave");
      assert.equal(details[1], 41n);
      assert.equal(details[2], 1);
      assert.equal(details[3], "New Street");
      assert.equal(details[4], false); // hasVoted should still be false
    });
  });

  describe("deleteVoter", function () {
    it("should revert if not registered", async function () {
      const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);
      await expect(voterDatabase.write.deleteVoter()).to.be.rejectedWith(
        "VoterDatabase__NotRegistered"
      );
    });

    it("should emit VoterDeleted on success", async function () {
      const { voterDatabase, owner, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash1 = await voterDatabase.write.addVoter([
        "Emily",
        BigInt(30),
        1,
        "Some Address",
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await voterDatabase.write.deleteVoter();
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const events = await voterDatabase.getEvents.VoterDeleted();
      expect(events).to.have.lengthOf(1);
      assert.equal(events[0].args.voter, getAddress(owner.account.address));
    });

    it("should remove voter from registration", async function () {
      const { voterDatabase, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash1 = await voterDatabase.write.addVoter([
        "Frank",
        BigInt(25),
        0,
        "Some Address",
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await voterDatabase.write.deleteVoter();
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const isRegistered = await voterDatabase.read.getMyRegistrationStatus();
      assert.equal(isRegistered, false);
    });
  });

  describe("markVoted", function () {
    it("should revert if not registered", async function () {
      const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);
      await expect(voterDatabase.write.markVoted()).to.be.rejectedWith(
        "VoterDatabase__NotRegistered"
      );
    });

    it("should emit VoterVoted on success", async function () {
      const { voterDatabase, owner, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash1 = await voterDatabase.write.addVoter([
        "Grace",
        BigInt(35),
        1,
        "Some Address",
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await voterDatabase.write.markVoted();
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const events = await voterDatabase.getEvents.VoterVoted();
      expect(events).to.have.lengthOf(1);
      assert.equal(events[0].args.voter, getAddress(owner.account.address));
    });

    it("should update voter's voting status", async function () {
      const { voterDatabase, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash1 = await voterDatabase.write.addVoter([
        "Helen",
        BigInt(42),
        1,
        "Some Address",
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const statusBefore = await voterDatabase.read.getMyVotingStatus();
      assert.equal(statusBefore, false);

      const hash2 = await voterDatabase.write.markVoted();
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const statusAfter = await voterDatabase.read.getMyVotingStatus();
      assert.equal(statusAfter, true);
    });
  });

  describe("Admin Functions", function () {
    describe("adminAddVoter", function () {
      it("should revert if called by non-owner", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.write.adminAddVoter(
            [
              otherAccount.account.address,
              "Tom",
              BigInt(25),
              0,
              "Some Address",
              false,
            ],
            { account: otherAccount.account }
          )
        ).to.be.rejectedWith("VoterDatabase__NotOwner");
      });

      it("should revert with zero address", async function () {
        const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);
        await expect(
          voterDatabase.write.adminAddVoter([
            "0x0000000000000000000000000000000000000000",
            "Tom",
            BigInt(25),
            0,
            "Some Address",
            false,
          ])
        ).to.be.rejectedWith("VoterDatabase__InvalidAddress");
      });

      it("should emit AdminAddedVoter on success", async function () {
        const { voterDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployVoterDatabaseFixture);
        const hash = await voterDatabase.write.adminAddVoter([
          otherAccount.account.address,
          "Tom",
          BigInt(25),
          0,
          "Some Address",
          false,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        const events = await voterDatabase.getEvents.AdminAddedVoter();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.voter,
          getAddress(otherAccount.account.address)
        );
        assert.equal(events[0].args.admin, getAddress(owner.account.address));
      });
    });

    describe("adminUpdateVoter", function () {
      it("should revert if called by non-owner", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.write.adminUpdateVoter(
            [
              otherAccount.account.address,
              "Tom Updated",
              BigInt(26),
              1,
              "New Address",
            ],
            { account: otherAccount.account }
          )
        ).to.be.rejectedWith("VoterDatabase__NotOwner");
      });

      it("should revert if voter not registered", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.write.adminUpdateVoter([
            otherAccount.account.address,
            "Tom Updated",
            BigInt(26),
            1,
            "New Address",
          ])
        ).to.be.rejectedWith("VoterDatabase__NotRegistered");
      });

      it("should emit AdminUpdatedVoter on success", async function () {
        const { voterDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployVoterDatabaseFixture);
        // First add a voter
        const hash1 = await voterDatabase.write.adminAddVoter([
          otherAccount.account.address,
          "Tom",
          BigInt(25),
          0,
          "Some Address",
          false,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Then update the voter
        const hash2 = await voterDatabase.write.adminUpdateVoter([
          otherAccount.account.address,
          "Tom Updated",
          BigInt(26),
          1,
          "New Address",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events = await voterDatabase.getEvents.AdminUpdatedVoter();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.voter,
          getAddress(otherAccount.account.address)
        );
        assert.equal(events[0].args.admin, getAddress(owner.account.address));
      });

      it("should update voter even if they have voted", async function () {
        const { voterDatabase, otherAccount, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );
        // Add a voter who has voted
        const hash1 = await voterDatabase.write.adminAddVoter([
          otherAccount.account.address,
          "Jerry",
          BigInt(30),
          0,
          "Some Address",
          true,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Should still be able to update
        const hash2 = await voterDatabase.write.adminUpdateVoter([
          otherAccount.account.address,
          "Jerry Updated",
          BigInt(31),
          1,
          "New Address",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Verify details were updated but voting status preserved
        const voterDetails = await voterDatabase.read.getVoterDetails([
          otherAccount.account.address,
        ]);
        assert.equal(voterDetails[0], "Jerry Updated");
        assert.equal(voterDetails[1], 31n);
        assert.equal(voterDetails[2], 1);
        assert.equal(voterDetails[3], "New Address");
        assert.equal(voterDetails[4], true); // hasVoted should still be true
      });
    });

    describe("adminRemoveVoter", function () {
      it("should revert if called by non-owner", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.write.adminRemoveVoter([otherAccount.account.address], {
            account: otherAccount.account,
          })
        ).to.be.rejectedWith("VoterDatabase__NotOwner");
      });

      it("should revert if voter not registered", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.write.adminRemoveVoter([otherAccount.account.address])
        ).to.be.rejectedWith("VoterDatabase__NotRegistered");
      });

      it("should emit AdminRemovedVoter on success", async function () {
        const { voterDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployVoterDatabaseFixture);
        // First add a voter
        const hash1 = await voterDatabase.write.adminAddVoter([
          otherAccount.account.address,
          "Kate",
          BigInt(33),
          1,
          "Some Address",
          false,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Then remove the voter
        const hash2 = await voterDatabase.write.adminRemoveVoter([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events = await voterDatabase.getEvents.AdminRemovedVoter();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.voter,
          getAddress(otherAccount.account.address)
        );
        assert.equal(events[0].args.admin, getAddress(owner.account.address));
      });

      it("should actually remove voter from database", async function () {
        const { voterDatabase, otherAccount, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );
        // First add a voter
        const hash1 = await voterDatabase.write.adminAddVoter([
          otherAccount.account.address,
          "Liam",
          BigInt(27),
          0,
          "Some Address",
          false,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Then remove the voter
        const hash2 = await voterDatabase.write.adminRemoveVoter([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Try to get voter details
        await expect(
          voterDatabase.read.getVoterDetails([otherAccount.account.address])
        ).to.be.rejectedWith("VoterDatabase__NotRegistered");
      });
    });

    describe("adminSetVotingStatus", function () {
      it("should revert if called by non-owner", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.write.adminSetVotingStatus(
            [otherAccount.account.address, true],
            { account: otherAccount.account }
          )
        ).to.be.rejectedWith("VoterDatabase__NotOwner");
      });

      it("should revert if voter not registered", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.write.adminSetVotingStatus([
            otherAccount.account.address,
            true,
          ])
        ).to.be.rejectedWith("VoterDatabase__NotRegistered");
      });

      it("should emit VotingStatusReset on success", async function () {
        const { voterDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployVoterDatabaseFixture);
        // First add a voter
        const hash1 = await voterDatabase.write.adminAddVoter([
          otherAccount.account.address,
          "Maria",
          BigInt(29),
          1,
          "Some Address",
          false,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Then set their voting status
        const hash2 = await voterDatabase.write.adminSetVotingStatus([
          otherAccount.account.address,
          true,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events = await voterDatabase.getEvents.VotingStatusReset();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.voter,
          getAddress(otherAccount.account.address)
        );
        assert.equal(events[0].args.admin, getAddress(owner.account.address));
      });

      it("should properly update voting status", async function () {
        const { voterDatabase, otherAccount, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );
        // Add a voter with hasVoted = false
        const hash1 = await voterDatabase.write.adminAddVoter([
          otherAccount.account.address,
          "Nina",
          BigInt(31),
          1,
          "Some Address",
          false,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Verify initial state
        let voterDetails = await voterDatabase.read.getVoterDetails([
          otherAccount.account.address,
        ]);
        assert.equal(voterDetails[4], false);

        // Set voting status to true
        const hash2 = await voterDatabase.write.adminSetVotingStatus([
          otherAccount.account.address,
          true,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Verify updated state
        voterDetails = await voterDatabase.read.getVoterDetails([
          otherAccount.account.address,
        ]);
        assert.equal(voterDetails[4], true);

        // Reset voting status to false
        const hash3 = await voterDatabase.write.adminSetVotingStatus([
          otherAccount.account.address,
          false,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        // Verify reset state
        voterDetails = await voterDatabase.read.getVoterDetails([
          otherAccount.account.address,
        ]);
        assert.equal(voterDetails[4], false);
      });
    });
  });

  describe("Query Functions", function () {
    describe("getMyDetails", function () {
      it("should revert if not registered", async function () {
        const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);
        await expect(voterDatabase.read.getMyDetails()).to.be.rejectedWith(
          "VoterDatabase__NotRegistered"
        );
      });

      it("should return correct voter details", async function () {
        const { voterDatabase, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );
        const hash = await voterDatabase.write.addVoter([
          "Quinn",
          BigInt(38),
          0,
          "456 Oak St",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        const details = await voterDatabase.read.getMyDetails();
        assert.equal(details[0], "Quinn");
        assert.equal(details[1], 38n);
        assert.equal(details[2], 0);
        assert.equal(details[3], "456 Oak St");
        assert.equal(details[4], false);
      });
    });

    describe("getMyRegistrationStatus", function () {
      it("should return false if not registered", async function () {
        const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);
        const status = await voterDatabase.read.getMyRegistrationStatus();
        assert.equal(status, false);
      });

      it("should return true if registered", async function () {
        const { voterDatabase, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );
        const hash = await voterDatabase.write.addVoter([
          "Ryan",
          BigInt(27),
          0,
          "Some Address",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        const status = await voterDatabase.read.getMyRegistrationStatus();
        assert.equal(status, true);
      });
    });

    describe("getMyVotingStatus", function () {
      it("should revert if not registered", async function () {
        const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);
        await expect(voterDatabase.read.getMyVotingStatus()).to.be.rejectedWith(
          "VoterDatabase__NotRegistered"
        );
      });

      it("should return false if not voted", async function () {
        const { voterDatabase, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );
        const hash = await voterDatabase.write.addVoter([
          "Samantha",
          BigInt(33),
          1,
          "Some Address",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        const status = await voterDatabase.read.getMyVotingStatus();
        assert.equal(status, false);
      });

      it("should return true if voted", async function () {
        const { voterDatabase, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );
        const hash1 = await voterDatabase.write.addVoter([
          "Tyler",
          BigInt(29),
          0,
          "Some Address",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await voterDatabase.write.markVoted();
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const status = await voterDatabase.read.getMyVotingStatus();
        assert.equal(status, true);
      });
    });

    describe("getAllVoters and getVoterCount", function () {
      it("should revert if called by non-owner", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.read.getAllVoters({ account: otherAccount.account })
        ).to.be.rejectedWith("VoterDatabase__NotOwner");

        await expect(
          voterDatabase.read.getVoterCount({ account: otherAccount.account })
        ).to.be.rejectedWith("VoterDatabase__NotOwner");
      });
    });
  });
});
