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
    const [owner, otherAccount] = await hre.viem.getWalletClients();
    const voterDatabase = await hre.viem.deployContract("VoterDatabase", []);
    const publicClient = await hre.viem.getPublicClient();
    return { voterDatabase, owner, otherAccount, publicClient };
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
      const { voterDatabase, publicClient } = await loadFixture(
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
    });
  });

  // Rest of the test cases stay unchanged unless you want to test new fields in other scenarios
});
