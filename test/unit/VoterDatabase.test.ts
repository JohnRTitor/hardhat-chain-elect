import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { developmentChains } from "../../helper-hardhat-config";

describe("VoterDatabase Unit Tests", function () {
  before(function () {
    // we want to run this only on development chains
    if (!developmentChains.includes(hre.network.name)) {
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
        voterDatabase.write.addVoter(["Alice", BigInt(17)])
      ).to.be.rejectedWith("VoterDatabase__NotEligible");
    });

    it("should revert if already registered", async function () {
      const { voterDatabase, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash = await voterDatabase.write.addVoter(["Alice", BigInt(20)]);
      await publicClient.waitForTransactionReceipt({ hash });
      await expect(
        voterDatabase.write.addVoter(["Alice", BigInt(20)])
      ).to.be.rejectedWith("VoterDatabase__AlreadyRegistered");
    });

    it("should emit VoterRegistered on success", async function () {
      const { voterDatabase, owner, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash = await voterDatabase.write.addVoter(["Alice", BigInt(20)]);
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
        voterDatabase.write.updateVoter(["Bob", BigInt(30)])
      ).to.be.rejectedWith("VoterDatabase__NotRegistered");
    });

    it("should revert if already voted", async function () {
      const { voterDatabase, publicClient, owner } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash1 = await voterDatabase.write.addVoter(["Bob", BigInt(30)]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await voterDatabase.write.markVoted([
        getAddress(owner.account.address),
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      await expect(
        voterDatabase.write.updateVoter(["BobUpdated", BigInt(31)])
      ).to.be.rejectedWith("VoterDatabase__CannotUpdateAfterVoting");
    });

    it("should emit VoterUpdated on success", async function () {
      const { voterDatabase, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash1 = await voterDatabase.write.addVoter(["Charlie", BigInt(22)]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await voterDatabase.write.updateVoter([
        "Charles",
        BigInt(23),
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const events = await voterDatabase.getEvents.VoterUpdated();
      expect(events).to.have.lengthOf(1);
    });
  });

  describe("deleteVoter", function () {
    it("should revert if not owner", async function () {
      const { voterDatabase, otherAccount } = await loadFixture(
        deployVoterDatabaseFixture
      );
      await expect(
        voterDatabase.write.deleteVoter([otherAccount.account.address], {
          account: otherAccount.account,
        })
      ).to.be.rejectedWith("VoterDatabase__NotOwner");
    });

    it("should revert if not registered", async function () {
      const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);
      await expect(
        voterDatabase.write.deleteVoter([
          "0x000000000000000000000000000000000000dead",
        ])
      ).to.be.rejectedWith("VoterDatabase__NotRegistered");
    });

    it("should remove voter from the system", async function () {
      const { voterDatabase, otherAccount, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );

      const hash1 = await voterDatabase.write.addVoter(["Dave", BigInt(28)], {
        account: otherAccount.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await voterDatabase.write.deleteVoter([
        otherAccount.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const events = await voterDatabase.getEvents.VoterDeleted();
      expect(events).to.have.lengthOf(1);
      assert.equal(
        events[0].args.voter,
        getAddress(otherAccount.account.address)
      );

      await expect(
        voterDatabase.read.getVoterDetails([otherAccount.account.address])
      ).to.be.rejectedWith("VoterDatabase__NotRegistered");
    });
  });

  describe("markVoted", function () {
    it("should revert if not owner", async function () {
      const { voterDatabase, otherAccount, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash = await voterDatabase.write.addVoter(["Eve", BigInt(30)], {
        account: otherAccount.account,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      await expect(
        voterDatabase.write.markVoted([otherAccount.account.address], {
          account: otherAccount.account,
        })
      ).to.be.rejectedWith("VoterDatabase__NotOwner");
    });

    it("should emit VoterVoted on success", async function () {
      const { voterDatabase, otherAccount, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash1 = await voterDatabase.write.addVoter(["Eve", BigInt(30)], {
        account: otherAccount.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await voterDatabase.write.markVoted([
        otherAccount.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const events = await voterDatabase.getEvents.VoterVoted();
      expect(events).to.have.lengthOf(1);
      assert.equal(
        events[0].args.voter,
        getAddress(otherAccount.account.address)
      );
    });
  });

  describe("getVoterDetails", function () {
    it("should return correct voter info", async function () {
      const { voterDatabase, owner, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );

      const hash = await voterDatabase.write.addVoter(["Frank", BigInt(30)]);
      await publicClient.waitForTransactionReceipt({ hash });

      const result = await voterDatabase.read.getVoterDetails([
        owner.account.address,
      ]);
      expect(result).to.deep.equal(["Frank", BigInt(30), false]);
    });
  });

  describe("getMyDetails", function () {
    it("should revert if not registered", async function () {
      const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);
      await expect(voterDatabase.read.getMyDetails()).to.be.rejectedWith(
        "VoterDatabase__NotRegistered"
      );
    });

    it("should return own voter details", async function () {
      const { voterDatabase, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );
      const hash = await voterDatabase.write.addVoter(["Grace", BigInt(29)]);
      await publicClient.waitForTransactionReceipt({ hash });

      const result = await voterDatabase.read.getMyDetails();
      expect(result).to.deep.equal(["Grace", BigInt(29), false]);
    });
  });

  describe("getAllVoters", function () {
    it("should return list of all voter addresses", async function () {
      const { voterDatabase, owner, otherAccount, publicClient } =
        await loadFixture(deployVoterDatabaseFixture);

      const hash1 = await voterDatabase.write.addVoter(["Henry", BigInt(21)]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await voterDatabase.write.addVoter(["Ivy", BigInt(22)], {
        account: otherAccount.account,
      });
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const result = await voterDatabase.read.getAllVoters();
      expect(result).to.have.lengthOf(2);
      expect(result).to.include(getAddress(owner.account.address));
      expect(result).to.include(getAddress(otherAccount.account.address));
    });
  });
});
