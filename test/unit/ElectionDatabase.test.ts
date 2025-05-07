import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { assert, expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { hardhat } from "viem/chains";
import { GenderEnum } from "../../types";
import { getDobEpochFromAge } from "../../lib/utils";

describe("ElectionDatabase Unit Tests", function () {
  before(function () {
    // we want to run this only on hardhat development chains
    if (hre.network.config.chainId != hardhat.id) {
      this.skip();
    }
  });

  async function deployElectionDatabaseFixture() {
    const [
      owner,
      voter1,
      voter2,
      candidate1,
      candidate2,
      candidate3,
      randomNotRegisteredAccount,
    ] = await hre.viem.getWalletClients();

    // Deploy VoterDatabase
    const voterDatabase = await hre.viem.deployContract("VoterDatabase", []);

    // Give admin rights to ElectionDatabase contract
    await voterDatabase.write.addAdmin([owner.account.address]);

    // Deploy CandidateDatabase
    const candidateDatabase = await hre.viem.deployContract(
      "CandidateDatabase",
      []
    );

    // Deploy ElectionDatabase with the addresses of the other contracts
    const electionDatabase = await hre.viem.deployContract("ElectionDatabase", [
      voterDatabase.address,
      candidateDatabase.address,
    ]);

    // Give ElectionDatabase admin rights to VoterDatabase
    await voterDatabase.write.addAdmin([electionDatabase.address]);

    const publicClient = await hre.viem.getPublicClient();

    // Register voters
    const hash1 = await voterDatabase.write.adminAddVoter([
      voter1.account.address,
      "John Voter",
      getDobEpochFromAge(30),
      GenderEnum.MALE,
      "123 Main St",
      false,
    ]);
    await publicClient.waitForTransactionReceipt({ hash: hash1 });

    const hash2 = await voterDatabase.write.adminAddVoter([
      voter2.account.address,
      "Jane Voter",
      getDobEpochFromAge(25),
      GenderEnum.FEMALE,
      "456 Oak St",
      false,
    ]);
    await publicClient.waitForTransactionReceipt({ hash: hash2 });

    // Register candidates
    const hash3 = await candidateDatabase.write.adminAddCandidate([
      candidate1.account.address,
      "Alice Candidate",
      getDobEpochFromAge(35),
      GenderEnum.FEMALE,
      "789 Elm St",
      "alice@example.com",
      "PhD in Political Science",
      "Build a better future",
    ]);
    await publicClient.waitForTransactionReceipt({ hash: hash3 });

    const hash4 = await candidateDatabase.write.adminAddCandidate([
      candidate2.account.address,
      "Bob Candidate",
      getDobEpochFromAge(42),
      GenderEnum.MALE,
      "101 Pine St",
      "bob@example.com",
      "MBA, Former Mayor",
      "Economic prosperity for all",
    ]);
    await publicClient.waitForTransactionReceipt({ hash: hash4 });

    const hash5 = await candidateDatabase.write.adminAddCandidate([
      candidate3.account.address,
      "Carol Candidate",
      getDobEpochFromAge(38),
      GenderEnum.FEMALE,
      "202 Cedar St",
      "carol@example.com",
      "LLB, Human Rights Activist",
      "Justice and equality",
    ]);
    await publicClient.waitForTransactionReceipt({ hash: hash5 });

    return {
      voterDatabase,
      candidateDatabase,
      electionDatabase,
      owner,
      voter1,
      voter2,
      candidate1,
      candidate2,
      candidate3,
      randomNotRegisteredAccount,
      publicClient,
    };
  }

  describe("Deployment and setup", function () {
    it("should correctly store database addresses", async function () {
      const { electionDatabase, voterDatabase, candidateDatabase } =
        await loadFixture(deployElectionDatabaseFixture);

      const databases = await electionDatabase.read.getDatabases();
      // Fix: Use getAddress to normalize addresses for comparison
      assert.equal(getAddress(databases[0]), getAddress(voterDatabase.address));
      assert.equal(
        getAddress(databases[1]),
        getAddress(candidateDatabase.address)
      );
    });

    it("should have zero elections initially", async function () {
      const { electionDatabase } = await loadFixture(
        deployElectionDatabaseFixture
      );

      const count = await electionDatabase.read.getElectionCount();
      assert.equal(count, 0n);

      const ids = await electionDatabase.read.getAllElectionIds();
      assert.equal(ids.length, 0);
    });
  });

  describe("Election Management", function () {
    describe("createElection", function () {
      it("should revert if called by non-admin", async function () {
        const { electionDatabase, voter1 } = await loadFixture(
          deployElectionDatabaseFixture
        );

        await expect(
          electionDatabase.write.createElection(
            ["Presidential Election 2023", "National presidential election"],
            { account: voter1.account }
          )
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should emit ElectionCreated on success", async function () {
        const { electionDatabase, owner, publicClient } = await loadFixture(
          deployElectionDatabaseFixture
        );

        const hash = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        const events = await electionDatabase.getEvents.ElectionCreated();
        expect(events).to.have.lengthOf(1);
        assert.equal(events[0].args.electionId, 0n);
        assert.equal(events[0].args.name, "Presidential Election 2023");
        assert.equal(events[0].args.creator, getAddress(owner.account.address));
      });

      it("should correctly increment election counter", async function () {
        const { electionDatabase, publicClient } = await loadFixture(
          deployElectionDatabaseFixture
        );

        // Create first election
        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Create second election
        const hash2 = await electionDatabase.write.createElection([
          "Senate Election 2023",
          "National senate election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const count = await electionDatabase.read.getElectionCount();
        assert.equal(count, 2n);

        const ids = await electionDatabase.read.getAllElectionIds();
        assert.equal(ids.length, 2);
        assert.deepEqual(
          ids.map((id) => Number(id)),
          [0, 1]
        );
      });
    });

    describe("updateElection", function () {
      it("should revert if called by non-admin", async function () {
        const { electionDatabase, voter1, publicClient } = await loadFixture(
          deployElectionDatabaseFixture
        );

        const hash = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        await expect(
          electionDatabase.write.updateElection(
            [0n, "Updated Election", "Updated Description"],
            { account: voter1.account }
          )
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should revert if election not found", async function () {
        const { electionDatabase } = await loadFixture(
          deployElectionDatabaseFixture
        );

        await expect(
          electionDatabase.write.updateElection([
            99n,
            "Invalid Election",
            "Should not work",
          ])
        ).to.be.rejectedWith("ElectionDatabase__ElectionNotFound");
      });

      it("should emit ElectionUpdated on success", async function () {
        const { electionDatabase, owner, publicClient } = await loadFixture(
          deployElectionDatabaseFixture
        );

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await electionDatabase.write.updateElection([
          0n,
          "Updated Presidential Election",
          "Updated description with more details",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events = await electionDatabase.getEvents.ElectionUpdated();
        expect(events).to.have.lengthOf(1);
        assert.equal(events[0].args.electionId, 0n);
        assert.equal(events[0].args.name, "Updated Presidential Election");
        assert.equal(events[0].args.updater, getAddress(owner.account.address));
      });

      it("should correctly update election details", async function () {
        const { electionDatabase, publicClient } = await loadFixture(
          deployElectionDatabaseFixture
        );

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await electionDatabase.write.updateElection([
          0n,
          "Updated Presidential Election",
          "Updated description with more details",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const details = await electionDatabase.read.getElectionDetails([0n]);
        assert.equal(details[0], "Updated Presidential Election");
        assert.equal(details[1], "Updated description with more details");
      });
    });

    describe("adminDeleteElection", function () {
      it("should revert if called by non-admin", async function () {
        const { electionDatabase, voter1, publicClient } = await loadFixture(
          deployElectionDatabaseFixture
        );

        const hash = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        await expect(
          electionDatabase.write.adminDeleteElection([0n], {
            account: voter1.account,
          })
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should revert if election not found", async function () {
        const { electionDatabase } = await loadFixture(
          deployElectionDatabaseFixture
        );

        await expect(
          electionDatabase.write.adminDeleteElection([99n])
        ).to.be.rejectedWith("ElectionDatabase__ElectionNotFound");
      });

      it("should emit ElectionDeleted on success", async function () {
        const { electionDatabase, owner, publicClient } = await loadFixture(
          deployElectionDatabaseFixture
        );

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await electionDatabase.write.adminDeleteElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events = await electionDatabase.getEvents.ElectionDeleted();
        expect(events).to.have.lengthOf(1);
        assert.equal(events[0].args.electionId, 0n);
        assert.equal(events[0].args.name, "Presidential Election 2023");
        assert.equal(
          getAddress(events[0].args.remover as string),
          getAddress(owner.account.address)
        );
      });

      it("should correctly remove election from the list", async function () {
        const { electionDatabase, publicClient } = await loadFixture(
          deployElectionDatabaseFixture
        );

        // Create two elections
        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await electionDatabase.write.createElection([
          "Senate Election 2023",
          "National senate election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Delete the first election
        const hash3 = await electionDatabase.write.adminDeleteElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        // Check count and IDs
        const count = await electionDatabase.read.getElectionCount();
        assert.equal(count, 1n);

        const ids = await electionDatabase.read.getAllElectionIds();
        assert.equal(ids.length, 1);
        assert.equal(ids[0], 1n);

        // Try to get details of deleted election
        await expect(
          electionDatabase.read.getElectionDetails([0n])
        ).to.be.rejectedWith("ElectionDatabase__ElectionNotFound");
      });
    });
  });

  describe("Candidate Management", function () {
    describe("enrollCandidate", function () {
      it("should revert if election not found", async function () {
        const { electionDatabase, candidate1 } = await loadFixture(
          deployElectionDatabaseFixture
        );

        await expect(
          electionDatabase.write.enrollCandidate([99n], {
            account: candidate1.account,
          })
        ).to.be.rejectedWith("ElectionDatabase__ElectionNotFound");
      });

      it("should revert if election is active", async function () {
        const { electionDatabase, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate and open the election
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const hash3 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        // Try to enroll while election is active
        await expect(
          electionDatabase.write.enrollCandidate([0n], {
            account: candidate1.account,
          })
        ).to.be.rejectedWith("ElectionDatabase__ElectionActive");
      });

      it("should revert if candidate not registered in CandidateDatabase", async function () {
        const { electionDatabase, voter1, publicClient } = await loadFixture(
          deployElectionDatabaseFixture
        );

        const hash = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        // Voter1 is not registered as a candidate
        await expect(
          electionDatabase.write.enrollCandidate([0n], {
            account: voter1.account,
          })
        ).to.be.rejectedWith("ElectionDatabase__CandidateNotRegistered");
      });

      it("should revert if already enrolled", async function () {
        const { electionDatabase, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Enroll candidate once
        const hash2 = await electionDatabase.write.enrollCandidate([0n], {
          account: candidate1.account,
        });
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Try to enroll again
        await expect(
          electionDatabase.write.enrollCandidate([0n], {
            account: candidate1.account,
          })
        ).to.be.rejectedWith("ElectionDatabase__CandidateAlreadyEnrolled");
      });

      it("should emit CandidateEnrolled on success", async function () {
        const { electionDatabase, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await electionDatabase.write.enrollCandidate([0n], {
          account: candidate1.account,
        });
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events = await electionDatabase.getEvents.CandidateEnrolled();
        expect(events).to.have.lengthOf(1);
        assert.equal(events[0].args.electionId, 0n);
        assert.equal(
          getAddress(events[0].args.candidate as string),
          getAddress(candidate1.account.address)
        );
      });
    });

    describe("withdrawCandidate", function () {
      it("should revert if election not found", async function () {
        const { electionDatabase, candidate1 } = await loadFixture(
          deployElectionDatabaseFixture
        );

        await expect(
          electionDatabase.write.withdrawCandidate([99n], {
            account: candidate1.account,
          })
        ).to.be.rejectedWith("ElectionDatabase__ElectionNotFound");
      });

      it("should revert if election is active", async function () {
        const { electionDatabase, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Enroll and open the election
        const hash2 = await electionDatabase.write.enrollCandidate([0n], {
          account: candidate1.account,
        });
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const hash3 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        // Try to withdraw while election is active
        await expect(
          electionDatabase.write.withdrawCandidate([0n], {
            account: candidate1.account,
          })
        ).to.be.rejectedWith("ElectionDatabase__ElectionActive");
      });

      it("should revert if candidate not enrolled", async function () {
        const { electionDatabase, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        // Candidate not enrolled yet
        await expect(
          electionDatabase.write.withdrawCandidate([0n], {
            account: candidate1.account,
          })
        ).to.be.rejectedWith("ElectionDatabase__CandidateNotRegistered");
      });

      it("should emit CandidateWithdrawn on success", async function () {
        const { electionDatabase, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Enroll candidate
        const hash2 = await electionDatabase.write.enrollCandidate([0n], {
          account: candidate1.account,
        });
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Withdraw candidate
        const hash3 = await electionDatabase.write.withdrawCandidate([0n], {
          account: candidate1.account,
        });
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        const events = await electionDatabase.getEvents.CandidateWithdrawn();
        expect(events).to.have.lengthOf(1);
        assert.equal(events[0].args.electionId, 0n);
        assert.equal(
          getAddress(events[0].args.candidate as string),
          getAddress(candidate1.account.address)
        );
      });
    });

    describe("adminEnrollCandidate", function () {
      it("should revert if called by non-admin", async function () {
        const { electionDatabase, voter1, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        await expect(
          electionDatabase.write.adminEnrollCandidate(
            [0n, candidate1.account.address],
            { account: voter1.account }
          )
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should emit AdminEnrolledCandidate on success", async function () {
        const { electionDatabase, candidate1, owner, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const events =
          await electionDatabase.getEvents.AdminEnrolledCandidate();
        expect(events).to.have.lengthOf(1);
        assert.equal(events[0].args.electionId, 0n);
        assert.equal(
          getAddress(events[0].args.candidate as string),
          getAddress(candidate1.account.address)
        );
        assert.equal(
          getAddress(events[0].args.adder as string),
          getAddress(owner.account.address)
        );
      });
    });

    describe("adminWithdrawCandidate", function () {
      it("should revert if called by non-admin", async function () {
        const { electionDatabase, voter1, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        await expect(
          electionDatabase.write.adminWithdrawCandidate(
            [0n, candidate1.account.address],
            { account: voter1.account }
          )
        ).to.be.rejectedWith("AdminManagement__NotAdmin");
      });

      it("should emit AdminRemovedCandidate on success", async function () {
        const { electionDatabase, candidate1, owner, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Remove candidate
        const hash3 = await electionDatabase.write.adminWithdrawCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        const events = await electionDatabase.getEvents.AdminRemovedCandidate();
        expect(events).to.have.lengthOf(1);
        assert.equal(events[0].args.electionId, 0n);
        assert.equal(
          getAddress(events[0].args.candidate as string),
          getAddress(candidate1.account.address)
        );
        assert.equal(
          getAddress(events[0].args.remover as string),
          getAddress(owner.account.address)
        );
      });
    });
  });

  describe("Election Status Management", function () {
    describe("openElection", function () {
      it("should revert if election has no candidates", async function () {
        const { electionDatabase, publicClient } = await loadFixture(
          deployElectionDatabaseFixture
        );

        const hash = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash });

        await expect(
          electionDatabase.write.openElection([0n])
        ).to.be.rejectedWith("ElectionDatabase__ElectionHasNoContestant");
      });

      it("should emit ElectionOpened on success", async function () {
        const { electionDatabase, candidate1, owner, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Open election
        const hash3 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        const events = await electionDatabase.getEvents.ElectionOpened();
        expect(events).to.have.lengthOf(1);
        assert.equal(events[0].args.electionId, 0n);
        assert.equal(
          getAddress(events[0].args.admin as string),
          getAddress(owner.account.address)
        );

        // Verify election status
        const isActive = await electionDatabase.read.getElectionStatus([0n]);
        assert.equal(isActive, true);
      });
    });

    describe("closeElection", function () {
      it("should emit ElectionClosed on success", async function () {
        const { electionDatabase, candidate1, owner, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate and open election
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const hash3 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        // Close election
        const hash4 = await electionDatabase.write.closeElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash4 });

        const events = await electionDatabase.getEvents.ElectionClosed();
        expect(events).to.have.lengthOf(1);
        assert.equal(events[0].args.electionId, 0n);
        assert.equal(
          getAddress(events[0].args.admin as string),
          getAddress(owner.account.address)
        );

        // Verify election status
        const isActive = await electionDatabase.read.getElectionStatus([0n]);
        assert.equal(isActive, false);
      });
    });
  });

  describe("Voting", function () {
    describe("vote", function () {
      it("should revert if voter not registered", async function () {
        const {
          electionDatabase,
          candidate1,
          randomNotRegisteredAccount,
          publicClient,
        } = await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate and open election
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const hash3 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        await expect(
          electionDatabase.write.vote([0n, candidate1.account.address], {
            account: randomNotRegisteredAccount.account,
          })
        ).to.be.rejectedWith("ElectionDatabase__VoterNotRegistered");
      });

      it("should revert if election not active", async function () {
        const { electionDatabase, voter1, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate but don't open election
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        await expect(
          electionDatabase.write.vote([0n, candidate1.account.address], {
            account: voter1.account,
          })
        ).to.be.rejectedWith("ElectionDatabase__ElectionClosed");
      });

      it("should revert if candidate not enrolled in election", async function () {
        const {
          electionDatabase,
          voter1,
          candidate1,
          candidate3,
          publicClient,
        } = await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Only enroll candidate1
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        // Open the election
        const hash3 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        // Try voting for candidate3 who is registered in CandidateDatabase but not enrolled in this election
        await expect(
          electionDatabase.write.vote([0n, candidate3.account.address], {
            account: voter1.account,
          })
        ).to.be.rejectedWith("ElectionDatabase__CandidateNotRegistered");
      });

      it("should revert if voter already voted", async function () {
        const { electionDatabase, voter1, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate and open election
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const hash3 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        // First vote (should succeed)
        const hash4 = await electionDatabase.write.vote(
          [0n, candidate1.account.address],
          { account: voter1.account }
        );
        await publicClient.waitForTransactionReceipt({ hash: hash4 });

        // Try to vote again
        await expect(
          electionDatabase.write.vote([0n, candidate1.account.address], {
            account: voter1.account,
          })
        ).to.be.rejectedWith("ElectionDatabase__VoterAlreadyVoted");
      });

      it("should emit VoterVoted on success", async function () {
        const { electionDatabase, voter1, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate and open election
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const hash3 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        const hash4 = await electionDatabase.write.vote(
          [0n, candidate1.account.address],
          { account: voter1.account }
        );
        await publicClient.waitForTransactionReceipt({ hash: hash4 });

        const events = await electionDatabase.getEvents.VoterVoted();
        expect(events).to.have.lengthOf(1);
        assert.equal(events[0].args.electionId, 0n);
        assert.equal(
          getAddress(events[0].args.voter as string),
          getAddress(voter1.account.address)
        );
        assert.equal(
          getAddress(events[0].args.candidate as string),
          getAddress(candidate1.account.address)
        );
      });

      it("should increment candidate vote count", async function () {
        const { electionDatabase, voter1, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate and open election
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const hash3 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        const votesBefore = await electionDatabase.read.getVotesOfCandidate([
          0n,
          candidate1.account.address,
        ]);
        assert.equal(votesBefore, 0n);

        const hash4 = await electionDatabase.write.vote(
          [0n, candidate1.account.address],
          { account: voter1.account }
        );
        await publicClient.waitForTransactionReceipt({ hash: hash4 });

        const votesAfter = await electionDatabase.read.getVotesOfCandidate([
          0n,
          candidate1.account.address,
        ]);
        assert.equal(votesAfter, 1n);
      });
    });
  });

  describe("Election Queries", function () {
    describe("getElectionDetails", function () {
      it("should return correct details", async function () {
        const { electionDatabase, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const details = await electionDatabase.read.getElectionDetails([0n]);
        assert.equal(details[0], "Presidential Election 2023");
        assert.equal(details[1], "National presidential election");
        assert.equal(details[2], false); // isActive
        assert.equal(details[3].length, 1); // candidates array
        assert.equal(
          getAddress(details[3][0]),
          getAddress(candidate1.account.address)
        );
        assert.equal(details[4], 0n); // totalVotes
        assert.isAtLeast(Number(details[5]), 1); // createdTimestamp
      });
    });

    describe("getRegisteredCandidates", function () {
      it("should return correct list of candidates", async function () {
        const { electionDatabase, candidate1, candidate2, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add two candidates
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const hash3 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate2.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        const candidates = await electionDatabase.read.getRegisteredCandidates([
          0n,
        ]);
        assert.equal(candidates.length, 2);
        assert.include(
          candidates.map((addr) => getAddress(addr)),
          getAddress(candidate1.account.address)
        );
        assert.include(
          candidates.map((addr) => getAddress(addr)),
          getAddress(candidate2.account.address)
        );
      });
    });

    describe("getTotalVoteCount", function () {
      it("should return correct vote count", async function () {
        const { electionDatabase, voter1, voter2, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate and open election
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const hash3 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        // Initial vote count
        let count = await electionDatabase.read.getTotalVoteCount([0n]);
        assert.equal(count, 0n);

        // Cast two votes
        const hash4 = await electionDatabase.write.vote(
          [0n, candidate1.account.address],
          { account: voter1.account }
        );
        await publicClient.waitForTransactionReceipt({ hash: hash4 });

        const hash5 = await electionDatabase.write.vote(
          [0n, candidate1.account.address],
          { account: voter2.account }
        );
        await publicClient.waitForTransactionReceipt({ hash: hash5 });

        // Updated vote count
        count = await electionDatabase.read.getTotalVoteCount([0n]);
        assert.equal(count, 2n);
      });
    });

    describe("getWinner", function () {
      it("should return the winning candidate", async function () {
        const {
          electionDatabase,
          voter1,
          voter2,
          candidate1,
          candidate2,
          publicClient,
        } = await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add two candidates and open election
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const hash3 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate2.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        const hash4 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash4 });

        // Cast votes (1 for candidate1, 1 for candidate2)
        const hash5 = await electionDatabase.write.vote(
          [0n, candidate1.account.address],
          { account: voter1.account }
        );
        await publicClient.waitForTransactionReceipt({ hash: hash5 });

        const hash6 = await electionDatabase.write.vote(
          [0n, candidate2.account.address],
          { account: voter2.account }
        );
        await publicClient.waitForTransactionReceipt({ hash: hash6 });

        // Get winner - should be candidate1 as it's the first one with max votes when tied
        const winner = await electionDatabase.read.getWinner([0n]);
        assert.equal(
          getAddress(winner),
          getAddress(candidate1.account.address)
        );
      });
    });

    describe("hasVoted", function () {
      it("should return correct voting status", async function () {
        const { electionDatabase, voter1, voter2, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate and open election
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const hash3 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        // Check initial status
        let voted = await electionDatabase.read.hasVoted([
          0n,
          voter1.account.address,
        ]);
        assert.equal(voted, false);

        // Cast vote with voter1
        const hash4 = await electionDatabase.write.vote(
          [0n, candidate1.account.address],
          { account: voter1.account }
        );
        await publicClient.waitForTransactionReceipt({ hash: hash4 });

        // Check updated status
        voted = await electionDatabase.read.hasVoted([
          0n,
          voter1.account.address,
        ]);
        assert.equal(voted, true);

        // Voter2 still hasn't voted
        voted = await electionDatabase.read.hasVoted([
          0n,
          voter2.account.address,
        ]);
        assert.equal(voted, false);
      });
    });

    describe("getVoteTimestamp", function () {
      it("should return timestamp of vote", async function () {
        const { electionDatabase, voter1, candidate1, publicClient } =
          await loadFixture(deployElectionDatabaseFixture);

        const hash1 = await electionDatabase.write.createElection([
          "Presidential Election 2023",
          "National presidential election",
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });

        // Add candidate and open election
        const hash2 = await electionDatabase.write.adminEnrollCandidate([
          0n,
          candidate1.account.address,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: hash2 });

        const hash3 = await electionDatabase.write.openElection([0n]);
        await publicClient.waitForTransactionReceipt({ hash: hash3 });

        // Check initial timestamp
        let timestamp = await electionDatabase.read.getVoteTimestamp([
          0n,
          voter1.account.address,
        ]);
        assert.equal(timestamp, 0n);

        // Cast vote
        const hash4 = await electionDatabase.write.vote(
          [0n, candidate1.account.address],
          { account: voter1.account }
        );
        await publicClient.waitForTransactionReceipt({ hash: hash4 });

        // Check updated timestamp
        timestamp = await electionDatabase.read.getVoteTimestamp([
          0n,
          voter1.account.address,
        ]);
        assert.isAtLeast(Number(timestamp), 1);
      });
    });
  });
});
