import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("VoterDatabase Unit Tests", () => {
  async function deployVoterDatabaseFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await hre.viem.getWalletClients();

    const voterDatabase = await hre.viem.deployContract("VoterDatabase", []);

    const publicClient = await hre.viem.getPublicClient();

    return {
      voterDatabase,
      owner,
      otherAccount,
      publicClient,
    };
  }

  describe("addVoter", async function () {
    it("should revert when voter is below 18", async function () {
      const { voterDatabase } = await loadFixture(deployVoterDatabaseFixture);

      await expect(
        voterDatabase.write.addVoter(["John Doe", BigInt(15)])
      ).to.be.rejectedWith("VoterDatabase__NotEligible");
    });

    it("should revert when voter tries to register again", async function () {
      const { voterDatabase, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );

      const hash = await voterDatabase.write.addVoter(["John Doe", BigInt(20)]);
      await publicClient.waitForTransactionReceipt({ hash });

      await expect(
        voterDatabase.write.addVoter(["John Doe", BigInt(20)])
      ).to.be.rejectedWith("VoterDatabase__AlreadyRegistered");
    });

    it("should emit an event on successful registration", async function () {
      const { voterDatabase, owner, publicClient } = await loadFixture(
        deployVoterDatabaseFixture
      );

      const hash = await voterDatabase.write.addVoter(["John Doe", BigInt(20)]);
      await publicClient.waitForTransactionReceipt({ hash });

      // get the VoterRegistered events in the latest block
      const voterRegisteredEvents =
        await voterDatabase.getEvents.VoterRegistered();
      // there should be one event emitted
      expect(voterRegisteredEvents).to.have.lengthOf(1);
      // event should have one emitted value, the voter address, in this case is the owner
      // wrap it with getAddress as Viem can return uppercase hex string (address), which will
      // cause the assertion to fail
      assert.equal(
        voterRegisteredEvents[0].args.voter,
        getAddress(owner.account.address)
      );
    });
  });
});
