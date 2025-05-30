import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { hardhat } from "viem/chains";
import { GenderEnum } from "../../types";
import { getDobEpochFromAge } from "../../lib/utils";

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

  describe("Voter Functions", function () {
    describe("addVoter", function () {
      it("should revert if under 18", async function () {
        const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);

        await expect(
          voterDatabase.write.addVoter([
            "Alice",
            getDobEpochFromAge(17),
            GenderEnum.MALE,
            "Some Address",
            "alice@example.com",
          ])
        ).to.be.rejectedWith("VoterDatabase__NotEligible");
      });

      it("should revert if already registered", async function () {
        const { voterDatabase, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );
        const hash = await voterDatabase.write.addVoter([
          "Alice",
          getDobEpochFromAge(20),
          GenderEnum.FEMALE,
          "Some Address",
          "alice@example.com",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });
        await expect(
          voterDatabase.write.addVoter([
            "Alice",
            getDobEpochFromAge(20),
            GenderEnum.FEMALE,
            "Some Address",
            "alice@example.com",
          ])
        ).to.be.rejectedWith("VoterDatabase__AlreadyRegistered");
      });

      it("should emit VoterRegistered on success", async function () {
        const { voterDatabase, owner, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );

        const hash = await voterDatabase.write.addVoter([
          "Alice",
          getDobEpochFromAge(20),
          GenderEnum.MALE,
          "Some Address",
          "alice@example.com",
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
          getDobEpochFromAge(25),
          GenderEnum.MALE,
          "123 Main St",
          "alice@example.com",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        const details = await voterDatabase.read.getMyDetails();
        assert.equal(details[0], "Alice");
        assert.equal(details[1], getDobEpochFromAge(25));
        assert.equal(details[2], GenderEnum.MALE);
        assert.equal(details[3], "123 Main St");
        assert.equal(details[4], "alice@example.com");
        assert.equal(details[5], 0n); // timesVoted should be 0
        assert.isAtLeast(Number(details[6]), 1); // registrationTimestamp should be valid
      });
    });

    describe("updateVoter", function () {
      it("should revert if not registered", async function () {
        const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);

        await expect(
          voterDatabase.write.updateVoter([
            "Bob",
            getDobEpochFromAge(30),
            GenderEnum.FEMALE,
            "New Address",
            "bob@example.com",
          ])
        ).to.be.rejectedWith("VoterDatabase__NotRegistered");
      });

      it("should revert if already voted", async function () {
        const { voterDatabase, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );
        const hash1 = await voterDatabase.write.addVoter([
          "Bob",
          getDobEpochFromAge(30),
          GenderEnum.FEMALE,
          "Some Address",
          "bob@example.com",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await voterDatabase.write.markVoted();
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        await expect(
          voterDatabase.write.updateVoter([
            "BobUpdated",
            getDobEpochFromAge(31),
            GenderEnum.FEMALE,
            "Updated Address",
            "bobupdated@example.com",
          ])
        ).to.be.rejectedWith("VoterDatabase__CannotUpdateAfterVoting");
      });

      it("should emit VoterUpdated on success", async function () {
        const { voterDatabase, owner, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );
        const hash1 = await voterDatabase.write.addVoter([
          "Charlie",
          getDobEpochFromAge(22),
          GenderEnum.MALE,
          "Some Address",
          "charlie@example.com",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await voterDatabase.write.updateVoter([
          "Charles",
          getDobEpochFromAge(23),
          GenderEnum.MALE,
          "New Address",
          "charles@example.com",
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
          getDobEpochFromAge(40),
          GenderEnum.MALE,
          "Old Street",
          "david@example.com",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await voterDatabase.write.updateVoter([
          "Dave",
          getDobEpochFromAge(41),
          GenderEnum.FEMALE,
          "New Street",
          "dave@example.com",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const details = await voterDatabase.read.getMyDetails();
        assert.equal(details[0], "Dave");
        assert.equal(details[1], getDobEpochFromAge(41));
        assert.equal(details[2], GenderEnum.FEMALE);
        assert.equal(details[3], "New Street");
        assert.equal(details[4], "dave@example.com");
        assert.equal(details[5], 0n); // timesVoted should still be 0
        assert.isAtLeast(Number(details[6]), 1); // registrationTimestamp should still be valid
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
          getDobEpochFromAge(30),
          GenderEnum.FEMALE,
          "Some Address",
          "emily@example.com",
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
          getDobEpochFromAge(25),
          GenderEnum.MALE,
          "Some Address",
          "frank@example.com",
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

      it("should update voter's voting status", async function () {
        const { voterDatabase, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );

        const hash1 = await voterDatabase.write.addVoter([
          "Helen",
          getDobEpochFromAge(42),
          GenderEnum.FEMALE,
          "Some Address",
          "helen@example.com",
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
  });

  describe("Admin Functions", function () {
    describe("adminAddVoter", function () {
      it("should revert if called by non-admin", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );

        await expect(
          voterDatabase.write.adminAddVoter(
            [
              otherAccount.account.address,
              "Tom",
              getDobEpochFromAge(25),
              GenderEnum.MALE,
              "Some Address",
              "tom@example.com",
              0n,
            ],
            { account: otherAccount.account }
          )
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should revert with zero address", async function () {
        const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);

        await expect(
          voterDatabase.write.adminAddVoter([
            "0x0000000000000000000000000000000000000000",
            "Tom",
            getDobEpochFromAge(25),
            GenderEnum.MALE,
            "Some Address",
            "tom@example.com",
            0n,
          ])
        ).to.be.rejectedWith("VoterDatabase__InvalidAddress");
      });

      it("should emit AdminAddedVoter on success", async function () {
        const { voterDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployVoterDatabaseFixture);

        const hash = await voterDatabase.write.adminAddVoter([
          otherAccount.account.address,
          "Tom",
          getDobEpochFromAge(25),
          GenderEnum.MALE,
          "Some Address",
          "tom@example.com",
          0n,
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
      it("should revert if called by non-admin", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );

        await expect(
          voterDatabase.write.adminUpdateVoter(
            [
              otherAccount.account.address,
              "Tom Updated",
              getDobEpochFromAge(26),
              GenderEnum.FEMALE,
              "New Address",
              "tom-updated@example.com",
              0n,
            ],
            { account: otherAccount.account }
          )
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should revert if voter not registered", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );

        await expect(
          voterDatabase.write.adminUpdateVoter([
            otherAccount.account.address,
            "Tom Updated",
            getDobEpochFromAge(26),
            GenderEnum.FEMALE,
            "New Address",
            "tom-updated@example.com",
            0n,
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
          getDobEpochFromAge(25),
          GenderEnum.MALE,
          "Some Address",
          "tom@example.com",
          0n,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Then update the voter
        const hash2 = await voterDatabase.write.adminUpdateVoter([
          otherAccount.account.address,
          "Tom Updated",
          getDobEpochFromAge(26),
          GenderEnum.FEMALE,
          "New Address",
          "tom-updated@example.com",
          1n,
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
          getDobEpochFromAge(30),
          GenderEnum.MALE,
          "Some Address",
          "jerry@example.com",
          1n,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Should still be able to update
        const hash2 = await voterDatabase.write.adminUpdateVoter([
          otherAccount.account.address,
          "Jerry Updated",
          getDobEpochFromAge(31),
          GenderEnum.FEMALE,
          "New Address",
          "jerry-updated@example.com",
          1n,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Verify details were updated but voting status preserved
        const voterDetails = await voterDatabase.read.adminGetVoterDetails([
          otherAccount.account.address,
        ]);
        assert.equal(voterDetails[0], "Jerry Updated");
        assert.equal(voterDetails[1], getDobEpochFromAge(31));
        assert.equal(voterDetails[2], GenderEnum.FEMALE);
        assert.equal(voterDetails[3], "New Address");
        assert.equal(voterDetails[4], "jerry-updated@example.com");
        assert.equal(voterDetails[5], 1n);
      });
    });

    describe("adminRemoveVoter", function () {
      it("should revert if called by non-admin", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.write.adminRemoveVoter([otherAccount.account.address], {
            account: otherAccount.account,
          })
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
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
          getDobEpochFromAge(33),
          GenderEnum.FEMALE,
          "Some Address",
          "kate@example.com",
          0n,
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
          getDobEpochFromAge(27),
          GenderEnum.MALE,
          "Some Address",
          "liam@example.com",
          0n,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Then remove the voter
        const hash2 = await voterDatabase.write.adminRemoveVoter([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Try to get voter details
        await expect(
          voterDatabase.read.adminGetVoterDetails([
            otherAccount.account.address,
          ])
        ).to.be.rejectedWith("VoterDatabase__NotRegistered");
      });
    });

    describe("adminMarkVoted", function () {
      it("should revert if called by non-admin", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.write.adminMarkVoted([otherAccount.account.address], {
            account: otherAccount.account,
          })
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should revert if voter not registered", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.write.adminMarkVoted([otherAccount.account.address])
        ).to.be.rejectedWith("VoterDatabase__NotRegistered");
      });

      it("should emit AdminUpdatedVotingStatus on success", async function () {
        const { voterDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployVoterDatabaseFixture);
        // First add a voter
        const hash1 = await voterDatabase.write.adminAddVoter([
          otherAccount.account.address,
          "Maria",
          getDobEpochFromAge(29),
          GenderEnum.FEMALE,
          "Some Address",
          "maria@example.com",
          0n,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Then mark them as voted
        const hash2 = await voterDatabase.write.adminMarkVoted([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events = await voterDatabase.getEvents.AdminUpdatedVotingStatus();
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
        // Add a voter with timesVoted = 0
        const hash1 = await voterDatabase.write.adminAddVoter([
          otherAccount.account.address,
          "Nina",
          getDobEpochFromAge(31),
          GenderEnum.FEMALE,
          "Some Address",
          "nina@example.com",
          0n,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Verify initial state
        let voterDetails = await voterDatabase.read.adminGetVoterDetails([
          otherAccount.account.address,
        ]);
        assert.equal(voterDetails[5], 0n);

        // Mark as voted
        const hash2 = await voterDatabase.write.adminMarkVoted([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Verify updated state
        voterDetails = await voterDatabase.read.adminGetVoterDetails([
          otherAccount.account.address,
        ]);
        assert.equal(voterDetails[5], 1n);

        // Mark as voted again to increment counter
        const hash3 = await voterDatabase.write.adminMarkVoted([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        // Verify counter increased
        voterDetails = await voterDatabase.read.adminGetVoterDetails([
          otherAccount.account.address,
        ]);
        assert.equal(voterDetails[5], 2n);
      });
    });
  });

  describe("Query Functions", function () {
    describe("Voter Query Functions", function () {
      describe("getMyDetails", function () {
        it("should revert if not registered", async function () {
          const { voterDatabase } = await loadFixture(
            deployVoterDatabaseFixture
          );
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
            getDobEpochFromAge(38),
            GenderEnum.MALE,
            "456 Oak St",
            "quinn@example.com",
          ]);
          await publicClient.waitForTransactionReceipt({ hash });

          const details = await voterDatabase.read.getMyDetails();
          assert.equal(details[0], "Quinn");
          assert.equal(details[1], getDobEpochFromAge(38));
          assert.equal(details[2], GenderEnum.MALE);
          assert.equal(details[3], "456 Oak St");
          assert.equal(details[4], "quinn@example.com");
          assert.equal(details[5], 0n);
          assert.isAtLeast(Number(details[6]), 1); // registrationTimestamp should be valid
        });
      });

      describe("getMyRegistrationStatus", function () {
        it("should return false if not registered", async function () {
          const { voterDatabase } = await loadFixture(
            deployVoterDatabaseFixture
          );
          const status = await voterDatabase.read.getMyRegistrationStatus();
          assert.equal(status, false);
        });

        it("should return true if registered", async function () {
          const { voterDatabase, publicClient } = await loadFixture(
            deployVoterDatabaseFixture
          );

          const hash = await voterDatabase.write.addVoter([
            "Ryan",
            getDobEpochFromAge(27),
            GenderEnum.MALE,
            "Some Address",
            "ryan@example.com",
          ]);
          await publicClient.waitForTransactionReceipt({ hash });

          const status = await voterDatabase.read.getMyRegistrationStatus();
          assert.equal(status, true);
        });
      });

      describe("getMyVotingStatus", function () {
        it("should revert if not registered", async function () {
          const { voterDatabase } = await loadFixture(
            deployVoterDatabaseFixture
          );
          await expect(
            voterDatabase.read.getMyVotingStatus()
          ).to.be.rejectedWith("VoterDatabase__NotRegistered");
        });

        it("should return false if not voted", async function () {
          const { voterDatabase, publicClient } = await loadFixture(
            deployVoterDatabaseFixture
          );

          const hash = await voterDatabase.write.addVoter([
            "Samantha",
            getDobEpochFromAge(33),
            GenderEnum.FEMALE,
            "Some Address",
            "samantha@example.com",
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
            getDobEpochFromAge(29),
            GenderEnum.MALE,
            "Some Address",
            "tyler@example.com",
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash1 });

          const hash2 = await voterDatabase.write.markVoted();
          await publicClient.waitForTransactionReceipt({ hash: hash2 });

          const status = await voterDatabase.read.getMyVotingStatus();
          assert.equal(status, true);
        });
      });
    });

    describe("Admin Query Functions", function () {
      describe("adminGetAllVoters and adminGetVoterCount", function () {
        it("should revert if called by non-admin", async function () {
          const { voterDatabase, otherAccount } = await loadFixture(
            deployVoterDatabaseFixture
          );
          await expect(
            voterDatabase.read.adminGetAllVoters({
              account: otherAccount.account,
            })
          ).to.be.rejectedWith("AdminManagement__NotAdmin");

          await expect(
            voterDatabase.read.adminGetVoterCount({
              account: otherAccount.account,
            })
          ).to.be.rejectedWith("AdminManagement__NotAdmin");
        });

        it("should return empty array when no voters registered", async function () {
          const { voterDatabase } = await loadFixture(
            deployVoterDatabaseFixture
          );

          const voters = await voterDatabase.read.adminGetAllVoters();
          assert.equal(voters.length, 0);

          const count = await voterDatabase.read.adminGetVoterCount();
          assert.equal(count, 0n);
        });

        it("should return all registered voters", async function () {
          const { voterDatabase, otherAccount, thirdAccount, publicClient } =
            await loadFixture(deployVoterDatabaseFixture);

          // Add two voters
          const hash1 = await voterDatabase.write.adminAddVoter([
            otherAccount.account.address,
            "User One",
            getDobEpochFromAge(30),
            GenderEnum.MALE,
            "Address One",
            "user1@example.com",
            0n,
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash1 });

          const hash2 = await voterDatabase.write.adminAddVoter([
            thirdAccount.account.address,
            "User Two",
            getDobEpochFromAge(35),
            GenderEnum.FEMALE,
            "Address Two",
            "user2@example.com",
            1n,
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash2 });

          // Get all voters
          const voters = await voterDatabase.read.adminGetAllVoters();
          assert.equal(voters.length, 2);
          assert.include(
            voters.map((addr) => getAddress(addr)),
            getAddress(otherAccount.account.address)
          );
          assert.include(
            voters.map((addr) => getAddress(addr)),
            getAddress(thirdAccount.account.address)
          );

          // Get voter count
          const count = await voterDatabase.read.adminGetVoterCount();
          assert.equal(count, 2n);
        });

        it("should update correctly after removing a voter", async function () {
          const { voterDatabase, otherAccount, thirdAccount, publicClient } =
            await loadFixture(deployVoterDatabaseFixture);

          // Add two voters
          const hash1 = await voterDatabase.write.adminAddVoter([
            otherAccount.account.address,
            "User One",
            getDobEpochFromAge(30),
            GenderEnum.MALE,
            "Address One",
            "user1@example.com",
            0n,
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash1 });

          const hash2 = await voterDatabase.write.adminAddVoter([
            thirdAccount.account.address,
            "User Two",
            getDobEpochFromAge(35),
            GenderEnum.FEMALE,
            "Address Two",
            "user2@example.com",
            1n,
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash2 });

          // Remove one voter
          const hash3 = await voterDatabase.write.adminRemoveVoter([
            otherAccount.account.address,
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash3 });

          // Get all voters - should have one remaining
          const voters = await voterDatabase.read.adminGetAllVoters();
          assert.equal(voters.length, 1);
          assert.equal(
            getAddress(voters[0]),
            getAddress(thirdAccount.account.address)
          );

          // Get voter count
          const count = await voterDatabase.read.adminGetVoterCount();
          assert.equal(count, 1n);
        });
      });

      describe("adminGetVoterDetails", function () {
        it("should revert if called by non-admin", async function () {
          const { voterDatabase, otherAccount } = await loadFixture(
            deployVoterDatabaseFixture
          );
          await expect(
            voterDatabase.read.adminGetVoterDetails(
              [otherAccount.account.address],
              { account: otherAccount.account }
            )
          ).to.be.rejectedWith("AdminManagement__NotAdmin");
        });

        it("should revert if voter not registered", async function () {
          const { voterDatabase, otherAccount } = await loadFixture(
            deployVoterDatabaseFixture
          );
          await expect(
            voterDatabase.read.adminGetVoterDetails([
              otherAccount.account.address,
            ])
          ).to.be.rejectedWith("VoterDatabase__NotRegistered");
        });

        it("should return correct voter details", async function () {
          const { voterDatabase, otherAccount, publicClient } =
            await loadFixture(deployVoterDatabaseFixture);
          const hash = await voterDatabase.write.adminAddVoter([
            otherAccount.account.address,
            "Test User",
            getDobEpochFromAge(42),
            GenderEnum.FEMALE,
            "Test Address",
            "testuser@example.com",
            1n,
          ]);
          await publicClient.waitForTransactionReceipt({ hash });

          const details = await voterDatabase.read.adminGetVoterDetails([
            otherAccount.account.address,
          ]);

          assert.equal(details[0], "Test User");
          assert.equal(details[1], getDobEpochFromAge(42));
          assert.equal(details[2], GenderEnum.FEMALE);
          assert.equal(details[3], "Test Address");
          assert.equal(details[4], "testuser@example.com");
          assert.equal(details[5], 1n);
        });
      });
    });
  });

  describe("Admin Management Functions", function () {
    describe("addAdmin", function () {
      it("should revert if called by non-owner", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.write.addAdmin([otherAccount.account.address], {
            account: otherAccount.account,
          })
        ).to.be.rejectedWith("AdminManagement__NotOwner");
      });

      it("should revert with zero address", async function () {
        const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);
        await expect(
          voterDatabase.write.addAdmin([
            "0x0000000000000000000000000000000000000000",
          ])
        ).to.be.rejectedWith("AdminManagement__InvalidAddress");
      });

      it("should revert if address is already an admin", async function () {
        const { voterDatabase, otherAccount, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );
        const hash = await voterDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        await expect(
          voterDatabase.write.addAdmin([otherAccount.account.address])
        ).to.be.rejectedWith("AdminManagement__AlreadyAdmin");
      });

      it("should emit AdminAdded on success", async function () {
        const { voterDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployVoterDatabaseFixture);
        const hash = await voterDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        const events = await voterDatabase.getEvents.AdminAdded();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.admin,
          getAddress(otherAccount.account.address)
        );
        assert.equal(events[0].args.owner, getAddress(owner.account.address));
      });
    });

    describe("removeAdmin", function () {
      it("should revert if called by non-owner", async function () {
        const { voterDatabase, otherAccount, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );
        // Make otherAccount an admin first
        const hash = await voterDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        await expect(
          voterDatabase.write.removeAdmin([otherAccount.account.address], {
            account: otherAccount.account,
          })
        ).to.be.rejectedWith("AdminManagement__NotOwner");
      });

      it("should revert if address is not an admin", async function () {
        const { voterDatabase, otherAccount } = await loadFixture(
          deployVoterDatabaseFixture
        );
        await expect(
          voterDatabase.write.removeAdmin([otherAccount.account.address])
        ).to.be.rejectedWith("AdminManagement__AdminNotFound");
      });

      it("should emit AdminRemoved on success", async function () {
        const { voterDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployVoterDatabaseFixture);
        // Add admin first
        const hash1 = await voterDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Then remove
        const hash2 = await voterDatabase.write.removeAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events = await voterDatabase.getEvents.AdminRemoved();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.admin,
          getAddress(otherAccount.account.address)
        );
        assert.equal(events[0].args.owner, getAddress(owner.account.address));
      });
    });

    describe("Admin Query Functions", function () {
      it("should correctly identify admin status", async function () {
        const {
          voterDatabase,
          owner,
          otherAccount,
          thirdAccount,
          publicClient,
        } = await loadFixture(deployVoterDatabaseFixture);

        // Owner should always be admin
        const isAdminOwner = await voterDatabase.read.isAdmin([
          owner.account.address,
        ]);
        assert.equal(isAdminOwner, true);

        // Other accounts should not be admin initially
        let isAdminOther = await voterDatabase.read.isAdmin([
          otherAccount.account.address,
        ]);
        assert.equal(isAdminOther, false);

        // Add otherAccount as admin
        const hash = await voterDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        // Now otherAccount should be admin
        isAdminOther = await voterDatabase.read.isAdmin([
          otherAccount.account.address,
        ]);
        assert.equal(isAdminOther, true);

        // Third account should still not be admin
        const isAdminThird = await voterDatabase.read.isAdmin([
          thirdAccount.account.address,
        ]);
        assert.equal(isAdminThird, false);
      });

      it("should return correct admin count and list", async function () {
        const { voterDatabase, otherAccount, thirdAccount, publicClient } =
          await loadFixture(deployVoterDatabaseFixture);

        // Initially should have no admins (owner is not counted in admin array)
        let adminCount = await voterDatabase.read.getAdminCount();
        assert.equal(adminCount, 0n);
        let admins = await voterDatabase.read.getAllAdmins();
        assert.equal(admins.length, 0);

        // Add two admins
        const hash1 = await voterDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });
        const hash2 = await voterDatabase.write.addAdmin([
          thirdAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Should now have two admins
        adminCount = await voterDatabase.read.getAdminCount();
        assert.equal(adminCount, 2n);
        admins = await voterDatabase.read.getAllAdmins();
        assert.equal(admins.length, 2);
        assert.include(
          admins.map((addr) => getAddress(addr)),
          getAddress(otherAccount.account.address)
        );
        assert.include(
          admins.map((addr) => getAddress(addr)),
          getAddress(thirdAccount.account.address)
        );
      });

      it("should correctly report my admin status", async function () {
        const { voterDatabase, otherAccount, publicClient } = await loadFixture(
          deployVoterDatabaseFixture
        );

        // Owner should be admin
        let amIAdmin = await voterDatabase.read.amIAdmin();
        assert.equal(amIAdmin, true);

        // Add otherAccount as admin
        const hash = await voterDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        // otherAccount should see itself as admin
        amIAdmin = await voterDatabase.read.amIAdmin({
          account: otherAccount.account,
        });
        assert.equal(amIAdmin, true);
      });

      it("should return the correct owner", async function () {
        const { voterDatabase, owner } = await loadFixture(
          deployVoterDatabaseFixture
        );
        const contractOwner = await voterDatabase.read.getOwner();
        assert.equal(
          getAddress(contractOwner),
          getAddress(owner.account.address)
        );
      });
    });
  });
});
