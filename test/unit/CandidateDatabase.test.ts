import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { hardhat } from "viem/chains";
import { GenderEnum } from "../../types";
import { getDobEpochFromAge } from "../../lib/utils";

describe("CandidateDatabase Unit Tests", function () {
  before(function () {
    // we want to run this only on hardhat development chains
    if (hre.network.config.chainId != hardhat.id) {
      this.skip();
    }
  });

  async function deployCandidateDatabaseFixture() {
    const [owner, otherAccount, thirdAccount] =
      await hre.viem.getWalletClients();
    const candidateDatabase = await hre.viem.deployContract(
      "CandidateDatabase",
      []
    );
    const publicClient = await hre.viem.getPublicClient();
    return {
      candidateDatabase,
      owner,
      otherAccount,
      thirdAccount,
      publicClient,
    };
  }

  describe("Candidate Functions", function () {
    describe("addCandidate", function () {
      it("should revert if under 18", async function () {
        const { candidateDatabase } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        await expect(
          candidateDatabase.write.addCandidate([
            "Alice",
            getDobEpochFromAge(17),
            GenderEnum.MALE,
            "123 Election St",
            "alice@example.com",
            "BSc",
            "My Manifesto",
          ])
        ).to.be.rejectedWith("CandidateDatabase__NotEligible");
      });

      it("should revert if already registered", async function () {
        const { candidateDatabase, publicClient } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        const hash = await candidateDatabase.write.addCandidate([
          "Alice",
          getDobEpochFromAge(20),
          GenderEnum.FEMALE,
          "123 Election St",
          "alice@example.com",
          "BSc",
          "My Manifesto",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });
        await expect(
          candidateDatabase.write.addCandidate([
            "Alice",
            getDobEpochFromAge(20),
            GenderEnum.FEMALE,
            "123 Election St",
            "alice@example.com",
            "BSc",
            "My Manifesto",
          ])
        ).to.be.rejectedWith("CandidateDatabase__AlreadyRegistered");
      });

      it("should emit CandidateRegistered on success", async function () {
        const { candidateDatabase, owner, publicClient } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        const hash = await candidateDatabase.write.addCandidate([
          "Alice",
          getDobEpochFromAge(20),
          GenderEnum.FEMALE,
          "123 Election St",
          "alice@example.com",
          "BSc",
          "My Manifesto",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        const events = await candidateDatabase.getEvents.CandidateRegistered();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.candidate,
          getAddress(owner.account.address)
        );
      });

      it("should correctly store candidate details", async function () {
        const { candidateDatabase, publicClient } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        const hash = await candidateDatabase.write.addCandidate([
          "Alice",
          getDobEpochFromAge(25),
          GenderEnum.FEMALE,
          "456 Tech Ave",
          "alice@example.com",
          "PhD in Computer Science",
          "Making technology accessible for all",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        const details = await candidateDatabase.read.getMyDetails();
        assert.equal(details[0], "Alice");
        assert.equal(details[1], getDobEpochFromAge(25));
        assert.equal(Number(details[2]), GenderEnum.FEMALE);
        assert.equal(details[3], "456 Tech Ave");
        assert.equal(details[4], "alice@example.com");
        assert.equal(details[5], "PhD in Computer Science");
        assert.equal(details[6], "Making technology accessible for all");
        assert.isAtLeast(Number(details[7]), 1); // registrationTimestamp should be valid
      });
    });

    describe("updateCandidate", function () {
      it("should revert if not registered", async function () {
        const { candidateDatabase } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        await expect(
          candidateDatabase.write.updateCandidate([
            "Bob",
            getDobEpochFromAge(30),
            GenderEnum.MALE,
            "789 Update Lane",
            "bob@example.com",
            "MSc",
            "New Ideas",
          ])
        ).to.be.rejectedWith("CandidateDatabase__NotRegistered");
      });

      it("should emit CandidateUpdated on success", async function () {
        const { candidateDatabase, owner, publicClient } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        const hash1 = await candidateDatabase.write.addCandidate([
          "Charlie",
          getDobEpochFromAge(22),
          GenderEnum.MALE,
          "101 First St",
          "charlie@example.com",
          "BA",
          "Original Manifesto",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await candidateDatabase.write.updateCandidate([
          "Charlie Updated",
          getDobEpochFromAge(23),
          GenderEnum.MALE,
          "202 Second St",
          "charlie.updated@example.com",
          "BA, MBA",
          "Updated Manifesto",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events = await candidateDatabase.getEvents.CandidateUpdated();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.candidate,
          getAddress(owner.account.address)
        );
      });

      it("should correctly update candidate details", async function () {
        const { candidateDatabase, publicClient } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        const hash1 = await candidateDatabase.write.addCandidate([
          "David",
          getDobEpochFromAge(40),
          GenderEnum.MALE,
          "303 Old St",
          "david@example.com",
          "PhD",
          "Original Platform",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await candidateDatabase.write.updateCandidate([
          "David Smith",
          getDobEpochFromAge(41),
          GenderEnum.MALE,
          "404 New St",
          "david.smith@example.com",
          "PhD, Post-Doc",
          "Updated Platform",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const details = await candidateDatabase.read.getMyDetails();
        assert.equal(details[0], "David Smith");
        assert.equal(details[1], getDobEpochFromAge(41));
        assert.equal(Number(details[2]), GenderEnum.MALE);
        assert.equal(details[3], "404 New St");
        assert.equal(details[4], "david.smith@example.com");
        assert.equal(details[5], "PhD, Post-Doc");
        assert.equal(details[6], "Updated Platform");
        assert.isAtLeast(Number(details[7]), 1); // registrationTimestamp should still be valid
      });
    });

    describe("deleteCandidate", function () {
      it("should revert if not registered", async function () {
        const { candidateDatabase } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        await expect(
          candidateDatabase.write.deleteCandidate()
        ).to.be.rejectedWith("CandidateDatabase__NotRegistered");
      });

      it("should emit CandidateDeleted on success", async function () {
        const { candidateDatabase, otherAccount, publicClient } =
          await loadFixture(deployCandidateDatabaseFixture);
        const hash1 = await candidateDatabase.write.addCandidate(
          [
            "Frank",
            getDobEpochFromAge(25),
            GenderEnum.MALE,
            "606 Frank St",
            "frank@example.com",
            "MSc",
            "Some Manifesto",
          ],
          { account: otherAccount.account }
        );
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await candidateDatabase.write.deleteCandidate({
          account: otherAccount.account,
        });
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events = await candidateDatabase.getEvents.CandidateDeleted();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.candidate,
          getAddress(otherAccount.account.address)
        );
      });

      it("should remove candidate from registration", async function () {
        const { candidateDatabase, otherAccount, publicClient } =
          await loadFixture(deployCandidateDatabaseFixture);
        const hash1 = await candidateDatabase.write.addCandidate(
          [
            "Grace",
            getDobEpochFromAge(35),
            GenderEnum.FEMALE,
            "707 Grace Blvd",
            "grace@example.com",
            "BA",
            "My Platform",
          ],
          { account: otherAccount.account }
        );
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const isRegisteredBefore =
          await candidateDatabase.read.getCandidateRegistrationStatus([
            otherAccount.account.address,
          ]);
        assert.equal(isRegisteredBefore, true);

        const hash2 = await candidateDatabase.write.deleteCandidate({
          account: otherAccount.account,
        });
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const isRegisteredAfter =
          await candidateDatabase.read.getCandidateRegistrationStatus([
            otherAccount.account.address,
          ]);
        assert.equal(isRegisteredAfter, false);
      });
    });
  });

  describe("Admin Functions", function () {
    describe("adminAddCandidate", function () {
      it("should revert if called by non-admin", async function () {
        const { candidateDatabase, otherAccount } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        await expect(
          candidateDatabase.write.adminAddCandidate(
            [
              otherAccount.account.address,
              "Henry",
              getDobEpochFromAge(25),
              GenderEnum.MALE,
              "808 Admin St",
              "henry@example.com",
              "BSc",
              "New Ideas",
            ],
            { account: otherAccount.account }
          )
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should revert with zero address", async function () {
        const { candidateDatabase } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        await expect(
          candidateDatabase.write.adminAddCandidate([
            "0x0000000000000000000000000000000000000000",
            "Invalid",
            getDobEpochFromAge(25),
            GenderEnum.MALE,
            "000 Zero Ave",
            "invalid@example.com",
            "BSc",
            "Test",
          ])
        ).to.be.rejectedWith("CandidateDatabase__InvalidAddress");
      });

      it("should emit AdminAddedCandidate on success", async function () {
        const { candidateDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployCandidateDatabaseFixture);
        const hash = await candidateDatabase.write.adminAddCandidate([
          otherAccount.account.address,
          "Ian",
          getDobEpochFromAge(25),
          GenderEnum.MALE,
          "909 Ian Place",
          "ian@example.com",
          "MSc",
          "Fresh Ideas",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        const events = await candidateDatabase.getEvents.AdminAddedCandidate();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.candidate,
          getAddress(otherAccount.account.address)
        );
        assert.equal(events[0].args.admin, getAddress(owner.account.address));
      });
    });

    describe("adminUpdateCandidate", function () {
      it("should revert if called by non-admin", async function () {
        const { candidateDatabase, otherAccount } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        await expect(
          candidateDatabase.write.adminUpdateCandidate(
            [
              otherAccount.account.address,
              "Jane Updated",
              getDobEpochFromAge(26),
              GenderEnum.FEMALE,
              "123 Updated St",
              "jane.updated@example.com",
              "PhD",
              "New Platform",
            ],
            { account: otherAccount.account }
          )
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should revert if candidate not registered", async function () {
        const { candidateDatabase, otherAccount } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        await expect(
          candidateDatabase.write.adminUpdateCandidate([
            otherAccount.account.address,
            "Jane Updated",
            getDobEpochFromAge(26),
            GenderEnum.FEMALE,
            "123 Updated St",
            "jane.updated@example.com",
            "PhD",
            "New Platform",
          ])
        ).to.be.rejectedWith("CandidateDatabase__NotRegistered");
      });

      it("should emit AdminUpdatedCandidate on success", async function () {
        const { candidateDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployCandidateDatabaseFixture);
        // First add a candidate
        const hash1 = await candidateDatabase.write.adminAddCandidate([
          otherAccount.account.address,
          "Kevin",
          getDobEpochFromAge(25),
          GenderEnum.MALE,
          "222 Kevin Dr",
          "kevin@example.com",
          "BSc",
          "Original Ideas",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Then update the candidate
        const hash2 = await candidateDatabase.write.adminUpdateCandidate([
          otherAccount.account.address,
          "Kevin Smith",
          getDobEpochFromAge(26),
          GenderEnum.MALE,
          "333 Kevin Smith Way",
          "kevin.smith@example.com",
          "BSc, MBA",
          "Updated Ideas",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events =
          await candidateDatabase.getEvents.AdminUpdatedCandidate();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.candidate,
          getAddress(otherAccount.account.address)
        );
        assert.equal(events[0].args.admin, getAddress(owner.account.address));
      });

      it("should correctly update candidate details", async function () {
        const { candidateDatabase, otherAccount, publicClient } =
          await loadFixture(deployCandidateDatabaseFixture);
        // Add a candidate
        const hash1 = await candidateDatabase.write.adminAddCandidate([
          otherAccount.account.address,
          "Laura",
          getDobEpochFromAge(30),
          GenderEnum.FEMALE,
          "444 Laura Lane",
          "laura@example.com",
          "MSc Economics",
          "Economic Reform",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Update the candidate
        const hash2 = await candidateDatabase.write.adminUpdateCandidate([
          otherAccount.account.address,
          "Laura Johnson",
          getDobEpochFromAge(31),
          GenderEnum.FEMALE,
          "555 Johnson Ave",
          "laura.johnson@example.com",
          "MSc Economics, PhD Finance",
          "Economic and Financial Reform",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Verify details were updated
        const candidateDetails =
          await candidateDatabase.read.getCandidateDetails([
            otherAccount.account.address,
          ]);
        assert.equal(candidateDetails[0], "Laura Johnson");
        assert.equal(candidateDetails[1], getDobEpochFromAge(31));
        assert.equal(Number(candidateDetails[2]), GenderEnum.FEMALE);
        assert.equal(candidateDetails[3], "555 Johnson Ave");
        assert.equal(candidateDetails[4], "laura.johnson@example.com");
        assert.equal(candidateDetails[5], "MSc Economics, PhD Finance");
        assert.equal(candidateDetails[6], "Economic and Financial Reform");
      });
    });

    describe("adminRemoveCandidate", function () {
      it("should revert if called by non-admin", async function () {
        const { candidateDatabase, otherAccount } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        await expect(
          candidateDatabase.write.adminRemoveCandidate(
            [otherAccount.account.address],
            { account: otherAccount.account }
          )
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should revert if candidate not registered", async function () {
        const { candidateDatabase, otherAccount } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        await expect(
          candidateDatabase.write.adminRemoveCandidate([
            otherAccount.account.address,
          ])
        ).to.be.rejectedWith("CandidateDatabase__NotRegistered");
      });

      it("should emit AdminRemovedCandidate on success", async function () {
        const { candidateDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployCandidateDatabaseFixture);
        // First add a candidate
        const hash1 = await candidateDatabase.write.adminAddCandidate([
          otherAccount.account.address,
          "Michael",
          getDobEpochFromAge(28),
          GenderEnum.MALE,
          "999 Michael Rd",
          "michael@example.com",
          "MD",
          "Healthcare Reform",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Then remove the candidate
        const hash2 = await candidateDatabase.write.adminRemoveCandidate([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events =
          await candidateDatabase.getEvents.AdminRemovedCandidate();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.candidate,
          getAddress(otherAccount.account.address)
        );
        assert.equal(events[0].args.admin, getAddress(owner.account.address));
      });
    });

    describe("Import Functions", function () {
      it("should revert adminImportCandidate if called by non-admin", async function () {
        const { candidateDatabase, otherAccount, thirdAccount } =
          await loadFixture(deployCandidateDatabaseFixture);

        await expect(
          candidateDatabase.write.adminImportCandidate(
            [
              thirdAccount.account.address, // Using as mock source contract
              otherAccount.account.address,
            ],
            { account: otherAccount.account }
          )
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should revert adminBatchImportCandidates if called by non-admin", async function () {
        const { candidateDatabase, otherAccount, thirdAccount } =
          await loadFixture(deployCandidateDatabaseFixture);

        await expect(
          candidateDatabase.write.adminBatchImportCandidates(
            [
              thirdAccount.account.address, // Using as mock source contract
              [otherAccount.account.address],
            ],
            { account: otherAccount.account }
          )
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should revert adminImportAllCandidates if called by non-admin", async function () {
        const { candidateDatabase, otherAccount, thirdAccount } =
          await loadFixture(deployCandidateDatabaseFixture);

        await expect(
          candidateDatabase.write.adminImportAllCandidates(
            [thirdAccount.account.address], // Using as mock source contract
            { account: otherAccount.account }
          )
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });
    });
  });

  describe("Admin Management", function () {
    describe("addAdmin", function () {
      it("should revert if called by non-owner", async function () {
        const { candidateDatabase, otherAccount } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        await expect(
          candidateDatabase.write.addAdmin([otherAccount.account.address], {
            account: otherAccount.account,
          })
        ).to.be.rejectedWith("AdminManagement__NotOwner");
      });

      it("should revert with zero address", async function () {
        const { candidateDatabase } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        await expect(
          candidateDatabase.write.addAdmin([
            "0x0000000000000000000000000000000000000000",
          ])
        ).to.be.rejectedWith("AdminManagement__InvalidAddress");
      });

      it("should revert if address is already an admin", async function () {
        const { candidateDatabase, otherAccount, publicClient } =
          await loadFixture(deployCandidateDatabaseFixture);
        const hash = await candidateDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        await expect(
          candidateDatabase.write.addAdmin([otherAccount.account.address])
        ).to.be.rejectedWith("AdminManagement__AlreadyAdmin");
      });

      it("should emit AdminAdded on success", async function () {
        const { candidateDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployCandidateDatabaseFixture);
        const hash = await candidateDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        const events = await candidateDatabase.getEvents.AdminAdded();
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
        const { candidateDatabase, otherAccount, publicClient } =
          await loadFixture(deployCandidateDatabaseFixture);
        // Make otherAccount an admin first
        const hash = await candidateDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        await expect(
          candidateDatabase.write.removeAdmin([otherAccount.account.address], {
            account: otherAccount.account,
          })
        ).to.be.rejectedWith("AdminManagement__NotOwner");
      });

      it("should revert if address is not an admin", async function () {
        const { candidateDatabase, otherAccount } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        await expect(
          candidateDatabase.write.removeAdmin([otherAccount.account.address])
        ).to.be.rejectedWith("AdminManagement__AdminNotFound");
      });

      it("should emit AdminRemoved on success", async function () {
        const { candidateDatabase, otherAccount, owner, publicClient } =
          await loadFixture(deployCandidateDatabaseFixture);
        // Add admin first
        const hash1 = await candidateDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Then remove
        const hash2 = await candidateDatabase.write.removeAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events = await candidateDatabase.getEvents.AdminRemoved();
        expect(events).to.have.lengthOf(1);
        assert.equal(
          events[0].args.admin,
          getAddress(otherAccount.account.address)
        );
        assert.equal(events[0].args.owner, getAddress(owner.account.address));
      });
    });
  });

  describe("Query Functions", function () {
    describe("Candidate Query Functions", function () {
      describe("getCandidateDetails", function () {
        it("should revert if candidate not registered", async function () {
          const { candidateDatabase, otherAccount } = await loadFixture(
            deployCandidateDatabaseFixture
          );
          await expect(
            candidateDatabase.read.getCandidateDetails([
              otherAccount.account.address,
            ])
          ).to.be.rejectedWith("CandidateDatabase__NotRegistered");
        });

        it("should return correct candidate details", async function () {
          const { candidateDatabase, otherAccount, publicClient } =
            await loadFixture(deployCandidateDatabaseFixture);
          const hash = await candidateDatabase.write.adminAddCandidate([
            otherAccount.account.address,
            "Michael",
            getDobEpochFromAge(38),
            GenderEnum.MALE,
            "666 Science Way",
            "michael@example.com",
            "PhD Physics",
            "Scientific Advancement",
          ]);
          await publicClient.waitForTransactionReceipt({ hash });

          const details = await candidateDatabase.read.getCandidateDetails([
            otherAccount.account.address,
          ]);
          assert.equal(details[0], "Michael");
          assert.equal(details[1], getDobEpochFromAge(38));
          assert.equal(Number(details[2]), GenderEnum.MALE);
          assert.equal(details[3], "666 Science Way");
          assert.equal(details[4], "michael@example.com");
          assert.equal(details[5], "PhD Physics");
          assert.equal(details[6], "Scientific Advancement");
          assert.isAtLeast(Number(details[7]), 1); // timeWhenRegisteredEpoch should be valid
        });
      });

      describe("getAllCandidates", function () {
        it("should return empty array when no candidates registered", async function () {
          const { candidateDatabase } = await loadFixture(
            deployCandidateDatabaseFixture
          );

          const candidates = await candidateDatabase.read.getAllCandidates();
          assert.equal(candidates.length, 0);
        });

        it("should return all registered candidates", async function () {
          const {
            candidateDatabase,
            otherAccount,
            thirdAccount,
            publicClient,
          } = await loadFixture(deployCandidateDatabaseFixture);

          // Add two candidates
          const hash1 = await candidateDatabase.write.adminAddCandidate([
            otherAccount.account.address,
            "Nora",
            getDobEpochFromAge(30),
            GenderEnum.FEMALE,
            "777 Justice Rd",
            "nora@example.com",
            "Law Degree",
            "Justice Reform",
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash1 });

          const hash2 = await candidateDatabase.write.adminAddCandidate([
            thirdAccount.account.address,
            "Oscar",
            getDobEpochFromAge(35),
            GenderEnum.MALE,
            "888 Business Pkwy",
            "oscar@example.com",
            "MBA",
            "Business Growth",
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash2 });

          // Get all candidates
          const candidates = await candidateDatabase.read.getAllCandidates();
          assert.equal(candidates.length, 2);
          assert.include(
            candidates.map((addr) => getAddress(addr)),
            getAddress(otherAccount.account.address)
          );
          assert.include(
            candidates.map((addr) => getAddress(addr)),
            getAddress(thirdAccount.account.address)
          );
        });

        it("should update correctly after removing a candidate", async function () {
          const {
            candidateDatabase,
            otherAccount,
            thirdAccount,
            publicClient,
          } = await loadFixture(deployCandidateDatabaseFixture);

          // Add two candidates
          const hash1 = await candidateDatabase.write.adminAddCandidate([
            otherAccount.account.address,
            "Patricia",
            getDobEpochFromAge(30),
            GenderEnum.FEMALE,
            "999 Platform One Circle",
            "patricia@example.com",
            "BSc",
            "Platform One",
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash1 });

          const hash2 = await candidateDatabase.write.adminAddCandidate([
            thirdAccount.account.address,
            "Quentin",
            getDobEpochFromAge(35),
            GenderEnum.MALE,
            "1010 Platform Two Blvd",
            "quentin@example.com",
            "MBA",
            "Platform Two",
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash2 });

          // Remove one candidate
          const hash3 = await candidateDatabase.write.adminRemoveCandidate([
            otherAccount.account.address,
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash3 });

          // Get all candidates - should have one remaining
          const candidates = await candidateDatabase.read.getAllCandidates();
          assert.equal(candidates.length, 1);
          assert.equal(
            getAddress(candidates[0]),
            getAddress(thirdAccount.account.address)
          );
        });
      });

      describe("getMyDetails", function () {
        it("should revert if not registered", async function () {
          const { candidateDatabase } = await loadFixture(
            deployCandidateDatabaseFixture
          );
          await expect(
            candidateDatabase.read.getMyDetails()
          ).to.be.rejectedWith("CandidateDatabase__NotRegistered");
        });

        it("should return complete candidate profile", async function () {
          const { candidateDatabase, publicClient } = await loadFixture(
            deployCandidateDatabaseFixture
          );
          const hash = await candidateDatabase.write.addCandidate([
            "Steven",
            getDobEpochFromAge(42),
            GenderEnum.MALE,
            "1111 Constitution Ave",
            "steven@example.com",
            "JD",
            "Constitutional Reform",
          ]);
          await publicClient.waitForTransactionReceipt({ hash });

          const profile = await candidateDatabase.read.getMyDetails();
          assert.equal(profile[0], "Steven");
          assert.equal(profile[1], getDobEpochFromAge(42));
          assert.equal(Number(profile[2]), GenderEnum.MALE);
          assert.equal(profile[3], "1111 Constitution Ave");
          assert.equal(profile[4], "steven@example.com");
          assert.equal(profile[5], "JD");
          assert.equal(profile[6], "Constitutional Reform");
          assert.isAtLeast(Number(profile[7]), 1); // Timestamp should be valid
        });
      });

      describe("getMyRegistrationStatus", function () {
        it("should return false if not registered", async function () {
          const { candidateDatabase } = await loadFixture(
            deployCandidateDatabaseFixture
          );
          const status = await candidateDatabase.read.getMyRegistrationStatus();
          assert.equal(status, false);
        });

        it("should return true if registered", async function () {
          const { candidateDatabase, publicClient } = await loadFixture(
            deployCandidateDatabaseFixture
          );
          const hash = await candidateDatabase.write.addCandidate([
            "Tina",
            getDobEpochFromAge(27),
            GenderEnum.FEMALE,
            "1212 Environment St",
            "tina@example.com",
            "BSc",
            "Environment First",
          ]);
          await publicClient.waitForTransactionReceipt({ hash });

          const status = await candidateDatabase.read.getMyRegistrationStatus();
          assert.equal(status, true);
        });
      });

      describe("getCandidateRegistrationStatus", function () {
        it("should return false if not registered", async function () {
          const { candidateDatabase, otherAccount } = await loadFixture(
            deployCandidateDatabaseFixture
          );
          const status =
            await candidateDatabase.read.getCandidateRegistrationStatus([
              otherAccount.account.address,
            ]);
          assert.equal(status, false);
        });

        it("should return true if registered", async function () {
          const { candidateDatabase, otherAccount, publicClient } =
            await loadFixture(deployCandidateDatabaseFixture);
          const hash = await candidateDatabase.write.adminAddCandidate([
            otherAccount.account.address,
            "Uma",
            getDobEpochFromAge(33),
            GenderEnum.FEMALE,
            "1313 Education Dr",
            "uma@example.com",
            "PhD",
            "Education First",
          ]);
          await publicClient.waitForTransactionReceipt({ hash });

          const status =
            await candidateDatabase.read.getCandidateRegistrationStatus([
              otherAccount.account.address,
            ]);
          assert.equal(status, true);
        });
      });

      describe("getCandidateCount", function () {
        it("should return 0 when no candidates", async function () {
          const { candidateDatabase } = await loadFixture(
            deployCandidateDatabaseFixture
          );
          const count = await candidateDatabase.read.getCandidateCount();
          assert.equal(count, 0n);
        });

        it("should return correct number of candidates", async function () {
          const {
            candidateDatabase,
            otherAccount,
            thirdAccount,
            publicClient,
          } = await loadFixture(deployCandidateDatabaseFixture);

          // Add two candidates
          const hash1 = await candidateDatabase.write.adminAddCandidate([
            otherAccount.account.address,
            "Victor",
            getDobEpochFromAge(36),
            GenderEnum.MALE,
            "1414 Economy Blvd",
            "victor@example.com",
            "MBA",
            "Economic Growth",
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash1 });

          const hash2 = await candidateDatabase.write.adminAddCandidate([
            thirdAccount.account.address,
            "Wendy",
            getDobEpochFromAge(41),
            GenderEnum.FEMALE,
            "1515 Research Park",
            "wendy@example.com",
            "PhD",
            "Research Focus",
          ]);
          await publicClient.waitForTransactionReceipt({ hash: hash2 });

          const count = await candidateDatabase.read.getCandidateCount();
          assert.equal(count, 2n);
        });
      });
    });

    describe("Admin Query Functions", function () {
      it("should correctly identify admin status", async function () {
        const {
          candidateDatabase,
          owner,
          otherAccount,
          thirdAccount,
          publicClient,
        } = await loadFixture(deployCandidateDatabaseFixture);

        // Owner should always be admin
        const isAdminOwner = await candidateDatabase.read.isAdmin([
          owner.account.address,
        ]);
        assert.equal(isAdminOwner, true);

        // Other accounts should not be admin initially
        let isAdminOther = await candidateDatabase.read.isAdmin([
          otherAccount.account.address,
        ]);
        assert.equal(isAdminOther, false);

        // Add otherAccount as admin
        const hash = await candidateDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        // Now otherAccount should be admin
        isAdminOther = await candidateDatabase.read.isAdmin([
          otherAccount.account.address,
        ]);
        assert.equal(isAdminOther, true);

        // Third account should still not be admin
        const isAdminThird = await candidateDatabase.read.isAdmin([
          thirdAccount.account.address,
        ]);
        assert.equal(isAdminThird, false);
      });

      it("should return correct admin count and list", async function () {
        const { candidateDatabase, otherAccount, thirdAccount, publicClient } =
          await loadFixture(deployCandidateDatabaseFixture);

        // Initially should have no admins (owner is not counted in admin array)
        let adminCount = await candidateDatabase.read.getAdminCount();
        assert.equal(adminCount, 0n);
        let admins = await candidateDatabase.read.getAllAdmins();
        assert.equal(admins.length, 0);

        // Add two admins
        const hash1 = await candidateDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await candidateDatabase.write.addAdmin([
          thirdAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Should now have two admins
        adminCount = await candidateDatabase.read.getAdminCount();
        assert.equal(adminCount, 2n);
        admins = await candidateDatabase.read.getAllAdmins();
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
        const { candidateDatabase, otherAccount, publicClient } =
          await loadFixture(deployCandidateDatabaseFixture);

        // Owner should be admin
        let amIAdmin = await candidateDatabase.read.amIAdmin();
        assert.equal(amIAdmin, true);

        // Add otherAccount as admin
        const hash = await candidateDatabase.write.addAdmin([
          otherAccount.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        // otherAccount should see itself as admin
        amIAdmin = await candidateDatabase.read.amIAdmin({
          account: otherAccount.account,
        });
        assert.equal(amIAdmin, true);
      });

      it("should return the correct owner", async function () {
        const { candidateDatabase, owner } = await loadFixture(
          deployCandidateDatabaseFixture
        );
        const contractOwner = await candidateDatabase.read.getOwner();
        assert.equal(
          getAddress(contractOwner),
          getAddress(owner.account.address)
        );
      });
    });
  });
});
