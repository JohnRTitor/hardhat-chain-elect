// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

/*

createElection - should create an election with a name and description
addCandidate - should create a candidate for an election
vote - should allow a voter to vote for a candidate in an election
openElection - should open an election for voting
closeElection - should close an election for voting

*/

import {IVoterDatabase} from "contracts/interfaces/IVoterDatabase.sol";
import {ICandidateDatabase} from "contracts/interfaces/ICandidateDatabase.sol";

error ElectionDatabase__NotOwner();
error ElectionDatabase__NotRegisteredVoter();
error ElectionDatabase__AlreadyVoted();
error ElectionDatabase__ElectionNotFound();
error ElectionDatabase__CandidateNotRegistered();
error ElectionDatabase__VotingClosed();

contract ElectionDatabase {
    struct Election {
        string name;
        string description;
        address[] candidates;
        mapping(address => uint256) votesPerCandidate;
        mapping(address => address) voterToChosenCandidate;
        mapping(address => bool) voterHasVoted;
        bool isRegistered;
        bool isActive;
    }

    address private immutable i_owner;

    IVoterDatabase private immutable s_voterDB;
    ICandidateDatabase private immutable s_candidateDB;

    uint256 private s_electionCounter;
    mapping(uint256 => Election) private s_elections;

    event ElectionCreated(uint256 indexed electionId, string name);
    event CandidateAdded(uint256 indexed electionId, address indexed candidate);
    event VoterVoted(
        uint256 indexed electionId,
        address indexed voter,
        address indexed candidate
    );
    event ElectionOpened(uint256 indexed electionId);
    event ElectionClosed(uint256 indexed electionId);

    modifier onlyOwner() {
        if (msg.sender != i_owner) revert ElectionDatabase__NotOwner();
        _;
    }
    modifier onlyRegisteredElection(Election storage _election) {
        if (!_election.isRegistered)
            revert ElectionDatabase__ElectionNotFound();
        _;
    }
    modifier onlyValidVoter() {
        if (!s_voterDB.getMyRegistrationStatus()) {
            revert ElectionDatabase__NotRegisteredVoter();
        }
        _;
    }
    modifier onlyRegisteredCandidate(uint256 _electionId, address _candidate) {
        if (!s_candidateDB.getCandidateRegistrationStatus(_candidate)) {
            revert ElectionDatabase__CandidateNotRegistered();
        }
        Election storage election = s_elections[_electionId];
        // candidate has to be valid and exist in the array
        bool validCandidate = false;
        for (uint256 i = 0; i < election.candidates.length; i++) {
            if (election.candidates[i] == _candidate) {
                validCandidate = true;
                break;
            }
        }
        if (!validCandidate) revert ElectionDatabase__CandidateNotRegistered();
        _;
    }
    modifier onlyActiveElection(Election storage _election) {
        if (!_election.isActive) revert ElectionDatabase__VotingClosed();
        _;
    }

    constructor(address _voterDBAddress, address _candidateDBAddress) {
        i_owner = msg.sender;
        s_voterDB = IVoterDatabase(_voterDBAddress);
        s_candidateDB = ICandidateDatabase(_candidateDBAddress);
        s_electionCounter = 0;
    }

    function createElection(
        string memory _name,
        string memory _description
    ) external onlyOwner {
        uint256 electionId = s_electionCounter;

        Election storage newElection = s_elections[electionId];
        newElection.name = _name;
        newElection.description = _description;
        newElection.isActive = false;
        newElection.isRegistered = true;
        // mappings are auto initialised

        s_electionCounter++;
        emit ElectionCreated(electionId, _name);
    }

    // TODO: decide if this needs to be a onlyOwner function
    function addCandidate(
        uint256 _electionId,
        address _candidate
    ) external onlyOwner onlyRegisteredElection(s_elections[_electionId]) {
        if (!s_candidateDB.getCandidateRegistrationStatus(_candidate)) {
            revert ElectionDatabase__CandidateNotRegistered();
        }

        Election storage election = s_elections[_electionId];
        election.candidates.push(_candidate);

        emit CandidateAdded(_electionId, _candidate);
    }

    function toggleElectionStatus(
        uint256 _electionId
    ) external onlyOwner onlyRegisteredElection(s_elections[_electionId]) {
        Election storage election = s_elections[_electionId];
        if (!election.isActive) {
            election.isActive = true;
            emit ElectionOpened(_electionId);
        } else {
            election.isActive = false;
            emit ElectionClosed(_electionId);
        }
    }

    function vote(
        uint256 _electionId,
        address _candidate
    )
        external
        onlyActiveElection(s_elections[_electionId])
        onlyRegisteredCandidate(_electionId, _candidate)
        onlyValidVoter
    {
        if (!s_voterDB.getMyRegistrationStatus())
            revert ElectionDatabase__NotRegisteredVoter();

        Election storage election = s_elections[_electionId];
        // if the voter has already voted
        if (election.voterHasVoted[msg.sender])
            revert ElectionDatabase__AlreadyVoted();

        election.votesPerCandidate[_candidate]++;
        election.voterToChosenCandidate[msg.sender] = _candidate;
        election.voterHasVoted[msg.sender] = true;
    }
}
