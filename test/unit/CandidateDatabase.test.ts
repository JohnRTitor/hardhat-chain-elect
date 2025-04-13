import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { developmentChains } from "../../helper-hardhat-config";

describe("CandidateDatabase Unit Tests", () => {
  before(function () {
    // we want to run this only on development chains
    if (!developmentChains.includes(hre.network.name)) {
      this.skip();
    }
  });

  async function deployCandidateDatabaseFixture() {
    const [owner, otherAccount] = await hre.viem.getWalletClients();

    const candidateDatabase = await hre.viem.deployContract(
      "CandidateDatabase",
      []
    );
    const publicClient = await hre.viem.getPublicClient();

    return { candidateDatabase, owner, otherAccount, publicClient };
  }

  describe("addCandidate", () => {
    it("should revert when candidate is under 18", async () => {
      const { candidateDatabase } = await loadFixture(
        deployCandidateDatabaseFixture
      );

      await expect(
        candidateDatabase.write.addCandidate([
          "Alice",
          BigInt(16),
          "alice@mail.com",
        ])
      ).to.be.rejectedWith("CandidateDatabase__NotEligible");
    });

    it("should revert when already registered", async () => {
      const { candidateDatabase, publicClient } = await loadFixture(
        deployCandidateDatabaseFixture
      );

      const hash = await candidateDatabase.write.addCandidate([
        "Alice",
        BigInt(25),
        "alice@mail.com",
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      await expect(
        candidateDatabase.write.addCandidate([
          "Alice",
          BigInt(25),
          "alice@mail.com",
        ])
      ).to.be.rejectedWith("CandidateDatabase__AlreadyRegistered");
    });

    it("should emit CandidateRegistered on success", async () => {
      const { candidateDatabase, owner, publicClient } = await loadFixture(
        deployCandidateDatabaseFixture
      );

      const hash = await candidateDatabase.write.addCandidate([
        "Alice",
        BigInt(25),
        "alice@mail.com",
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const candidateRegisteredEvents =
        await candidateDatabase.getEvents.CandidateRegistered();
      expect(candidateRegisteredEvents).to.have.lengthOf(1);
      assert(
        candidateRegisteredEvents[0].args.candidate,
        getAddress(owner.account.address)
      );
    });
  });

  describe("updateCandidate", () => {
    it("should revert if not registered", async () => {
      const { candidateDatabase } = await loadFixture(
        deployCandidateDatabaseFixture
      );

      await expect(
        candidateDatabase.write.updateCandidate([
          "Bob",
          BigInt(30),
          "bob@mail.com",
        ])
      ).to.be.rejectedWith("CandidateDatabase__NotRegistered");
    });

    it("should emit CandidateUpdated on success", async () => {
      const { candidateDatabase, publicClient } = await loadFixture(
        deployCandidateDatabaseFixture
      );

      const hash1 = await candidateDatabase.write.addCandidate([
        "Bob",
        BigInt(30),
        "bob@mail.com",
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await candidateDatabase.write.updateCandidate([
        "Bobby",
        BigInt(31),
        "bobby@mail.com",
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const events = await candidateDatabase.getEvents.CandidateUpdated();
      expect(events).to.have.lengthOf(1);
    });
  });

  describe("deleteCandidate", () => {
    it("should revert if called by non-owner", async () => {
      const { candidateDatabase, otherAccount } = await loadFixture(
        deployCandidateDatabaseFixture
      );

      await expect(
        candidateDatabase.write.deleteCandidate(
          [otherAccount.account.address],
          { account: otherAccount.account }
        )
      ).to.be.rejectedWith("CandidateDatabase__NotOwner");
    });

    it("should revert if trying to delete non-registered candidate", async () => {
      const { candidateDatabase } = await loadFixture(
        deployCandidateDatabaseFixture
      );

      await expect(
        candidateDatabase.write.deleteCandidate([
          "0x000000000000000000000000000000000000dead",
        ])
      ).to.be.rejectedWith("CandidateDatabase__NotRegistered");
    });

    it("should emit CandidateDeleted on success", async () => {
      const { candidateDatabase, otherAccount, publicClient } =
        await loadFixture(deployCandidateDatabaseFixture);

      const hash1 = await candidateDatabase.write.addCandidate(
        ["John", BigInt(28), "john@mail.com"],
        { account: otherAccount.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await candidateDatabase.write.deleteCandidate([
        otherAccount.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const events = await candidateDatabase.getEvents.CandidateDeleted();
      expect(events).to.have.lengthOf(1);
      assert.equal(
        events[0].args.candidate,
        getAddress(otherAccount.account.address)
      );
    });
  });

  describe("getCandidateDetails", () => {
    it("should return candidate details correctly", async () => {
      const { candidateDatabase, owner, publicClient } = await loadFixture(
        deployCandidateDatabaseFixture
      );

      const hash = await candidateDatabase.write.addCandidate([
        "Alice",
        BigInt(22),
        "alice@mail.com",
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const result = await candidateDatabase.read.getCandidateDetails([
        owner.account.address,
      ]);

      expect(result).to.deep.equal(["Alice", BigInt(22), "alice@mail.com"]);
    });
  });

  describe("getMyCandidateDetails", () => {
    it("should revert if not registered", async () => {
      const { candidateDatabase } = await loadFixture(
        deployCandidateDatabaseFixture
      );

      await expect(
        candidateDatabase.read.getMyCandidateDetails()
      ).to.be.rejectedWith("CandidateDatabase__NotRegistered");
    });

    it("should return caller's profile if registered", async () => {
      const { candidateDatabase, publicClient } = await loadFixture(
        deployCandidateDatabaseFixture
      );

      const hash = await candidateDatabase.write.addCandidate([
        "Charlie",
        BigInt(24),
        "charlie@mail.com",
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const result = await candidateDatabase.read.getMyCandidateDetails();

      expect(result).to.deep.equal(["Charlie", BigInt(24), "charlie@mail.com"]);
    });
  });

  describe("getAllCandidates", () => {
    it("should return all registered candidate addresses", async () => {
      const { candidateDatabase, owner, otherAccount, publicClient } =
        await loadFixture(deployCandidateDatabaseFixture);

      const hash1 = await candidateDatabase.write.addCandidate([
        "Alice",
        BigInt(22),
        "alice@mail.com",
      ]);
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await candidateDatabase.write.addCandidate(
        ["Bob", BigInt(23), "bob@mail.com"],
        { account: otherAccount.account }
      );
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      const result = await candidateDatabase.read.getAllCandidates();
      expect(result).to.have.lengthOf(2);
      expect(result).to.include(getAddress(owner.account.address));
      expect(result).to.include(getAddress(otherAccount.account.address));
    });
  });
});
