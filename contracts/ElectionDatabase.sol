// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.8;

/**
 * @title ElectionDatabase Contract
 * @author Masum Reza
 * @notice Handles creation, management, and voting of elections using external voter and candidate databases
 * @dev Functions specifically prepended with admin may only be called by the contract owner or admins
 * @dev Other functions are accessible to all users, except otherwise specified by modifiers
 */

import {IVoterDatabase} from "./interfaces/IVoterDatabase.sol";
import {ICandidateDatabase} from "./interfaces/ICandidateDatabase.sol";
import {AdminManagement} from "./shared/AdminManagement.sol";

/// @notice Thrown when a voter is not registered in the voter database
error ElectionDatabase__VoterNotRegistered();

/// @notice Thrown when a voter has already voted in the election
error ElectionDatabase__VoterAlreadyVoted();

/// @notice Thrown when a candidate is not registered in the candidate database
error ElectionDatabase__CandidateNotRegistered();

/// @notice Thrown when a candidate is already registered in the election
error ElectionDatabase__CandidateAlreadyEnrolled();

/// @notice Thrown when a restricted action is attempted during an active election
error ElectionDatabase__ElectionActive();

/// @notice Thrown when an election is not currently accepting votes
error ElectionDatabase__ElectionClosed();

/// @notice Thrown when the requested election does not exist
error ElectionDatabase__ElectionNotFound();

/// @notice Thrown when an election has no contestants/candidates enrolled
error ElectionDatabase__ElectionHasNoContestant();

/// @notice Thrown when an invalid address (0x0) is provided
error ElectionDatabase__InvalidAddress();

/**
 * @title ElectionDatabase Contract
 * @author Masum Reza
 * @notice This contract manages election creation, candidate enrollment, and voting processes
 * @dev This contract implements:
 *      - Admin functions for election management
 *      - Candidate self-enrollment for elections
 *      - Secure voting functionality
 *      - Integration with VoterDatabase and CandidateDatabase
 */
contract ElectionDatabase is AdminManagement {
    /**
     * @notice Stores details for a single election
     * @dev The registrationTimestamp serves as both a timestamp and a registration flag
     *    - If > 0, election is registered
     */
    struct Election {
        string name;
        string description;
        // address of candidates who are also registered in CandidateDatabase
        address[] candidates;
        // candidate -> votes to that candidate
        mapping(address => uint256) votesPerCandidate;
        // voter -> who they voted for
        mapping(address => address) voterToChosenCandidate;
        // voter -> timestamp when they voted in this specific election (0 if not voted)
        mapping(address => uint256) voterToVoteTimestamp;
        // used to track whether the election is active or not
        bool isActive;
        uint256 totalVotes;
        // If > 0, election is registered. Acts as creation timestamp
        uint256 registrationTimestamp;
    }

    /// @dev References to external databases
    IVoterDatabase private immutable s_voterDB;
    ICandidateDatabase private immutable s_candidateDB;

    /// @dev Election storage and tracking
    uint256 private s_electionCounter;
    mapping(uint256 => Election) private s_elections;
    uint256[] private s_electionIds;

    /// @notice Emitted when a new election is created
    event AdminCreatedElection(
        uint256 indexed electionId,
        string name,
        address indexed creator
    );

    /// @notice Emitted when an election's details are updated
    event AdminUpdatedElection(
        uint256 indexed electionId,
        string name,
        address indexed updater
    );

    /// @notice Emitted when an election is deleted
    event AdminDeletedElection(
        uint256 indexed electionId,
        string name,
        address indexed remover
    );

    /// @notice Emitted when a candidate is added to an election by an admin
    event AdminEnrolledCandidate(
        uint256 indexed electionId,
        address indexed candidate,
        address indexed adder
    );

    /// @notice Emitted when a candidate is removed from an election by an admin
    event AdminRemovedCandidate(
        uint256 indexed electionId,
        address indexed candidate,
        address indexed remover
    );

    /// @notice Emitted when a candidate enrolls themselves in an election
    event CandidateEnrolled(
        uint256 indexed electionId,
        address indexed candidate
    );

    /// @notice Emitted when a candidate withdraws themselves from an election
    event CandidateWithdrawn(
        uint256 indexed electionId,
        address indexed candidate
    );

    /// @notice Emitted when a voter votes for a candidate
    event VoterVoted(
        uint256 indexed electionId,
        address indexed voter,
        address indexed candidate
    );

    /// @notice Emitted when an election is opened for voting
    event ElectionOpened(uint256 indexed electionId, address indexed admin);

    /// @notice Emitted when an election is closed
    event ElectionClosed(uint256 indexed electionId, address indexed admin);

    /**
     * @notice Ensures the election exists
     * @param _electionId ID of the election to check
     */
    modifier onlyRegisteredElection(uint256 _electionId) {
        if (s_elections[_electionId].registrationTimestamp == 0)
            revert ElectionDatabase__ElectionNotFound();
        _;
    }

    /**
     * @notice Ensures the election is open for voting
     * @param _electionId ID of the election to check
     */
    modifier onlyOpenElection(uint256 _electionId) {
        if (!s_elections[_electionId].isActive)
            revert ElectionDatabase__ElectionClosed();
        _;
    }

    /**
     * @notice Ensures the election is closed/inactive
     * @param _electionId ID of the election to check
     */
    modifier onlyClosedElection(uint256 _electionId) {
        if (s_elections[_electionId].isActive)
            revert ElectionDatabase__ElectionActive();
        _;
    }

    /**
     * @notice Ensures the caller is a registered voter
     */
    modifier onlyRegisteredVoter() {
        if (!s_voterDB.adminGetRegistrationStatus(msg.sender)) {
            revert ElectionDatabase__VoterNotRegistered();
        }
        _;
    }

    /**
     * @notice Ensures the address belongs to a registered candidate
     * @param _candidate Address to check for registration in CandidateDatabase
     */
    modifier onlyRegisteredCandidate(address _candidate) {
        if (!s_candidateDB.getCandidateRegistrationStatus(_candidate)) {
            revert ElectionDatabase__CandidateNotRegistered();
        }
        _;
    }

    /**
     * @notice Ensures the address belongs to a candidate enrolled in the specified election
     * @param _electionId ID of the election
     * @param _candidate Address to check for enrollment
     */
    modifier onlyEnrolledCandidate(uint256 _electionId, address _candidate) {
        Election storage election = s_elections[_electionId];
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

    /**
     * @notice Contract constructor
     * @param _voterDBAddress Address of the VoterDatabase contract
     * @param _candidateDBAddress Address of the CandidateDatabase contract
     */
    constructor(address _voterDBAddress, address _candidateDBAddress) {
        if (_voterDBAddress == address(0) || _candidateDBAddress == address(0))
            revert ElectionDatabase__InvalidAddress();

        s_voterDB = IVoterDatabase(_voterDBAddress);
        s_candidateDB = ICandidateDatabase(_candidateDBAddress);
        s_electionCounter = 0;
    }

    /**
     * @notice Creates a new election with given name and description
     * @dev Only owner/admins can call this function
     * @param _name Name of the election
     * @param _description Description of the election
     */
    function adminCreateElection(
        string memory _name,
        string memory _description
    ) external onlyAdmin {
        uint256 electionId = s_electionCounter;

        Election storage newElection = s_elections[electionId];
        newElection.name = _name;
        newElection.description = _description;
        newElection.isActive = false;
        newElection.totalVotes = 0;
        newElection.registrationTimestamp = block.timestamp; // Set timestamp to register the election

        s_electionIds.push(electionId);
        s_electionCounter++;

        emit AdminCreatedElection(electionId, _name, msg.sender);
    }

    /**
     * @notice Updates an existing election's details
     * @dev Only owner/admins can call this function
     * @param _electionId ID of the election to update
     * @param _name New name for the election
     * @param _description New description for the election
     */
    function adminUpdateElection(
        uint256 _electionId,
        string memory _name,
        string memory _description
    ) external onlyAdmin onlyRegisteredElection(_electionId) {
        Election storage election = s_elections[_electionId];

        election.name = _name;
        election.description = _description;

        emit AdminUpdatedElection(_electionId, _name, msg.sender);
    }

    /**
     * @notice Deletes an existing election
     * @dev Only owner/admins can call this function
     * @param _electionId ID of the election to delete
     */
    function adminDeleteElection(
        uint256 _electionId
    ) external onlyAdmin onlyRegisteredElection(_electionId) {
        // Store the name before marking as not registered
        string memory electionName = s_elections[_electionId].name;

        // Delete from the mapping
        delete s_elections[_electionId];

        // Remove from electionIds array using swap and pop
        for (uint256 i = 0; i < s_electionIds.length; i++) {
            if (s_electionIds[i] == _electionId) {
                s_electionIds[i] = s_electionIds[s_electionIds.length - 1];
                s_electionIds.pop();
                break;
            }
        }

        emit AdminDeletedElection(_electionId, electionName, msg.sender);
    }

    /**
     * @notice Opens an election for voting
     * @dev Only owner/admins can call this function
     * @dev Election must have at least one candidate to be opened
     * @param _electionId ID of the election to open
     */
    function adminOpenElection(
        uint256 _electionId
    ) external onlyAdmin onlyRegisteredElection(_electionId) {
        Election storage election = s_elections[_electionId];

        // Prevent opening elections with no candidates
        if (election.candidates.length == 0) {
            revert ElectionDatabase__ElectionHasNoContestant();
        }

        election.isActive = true;
        emit ElectionOpened(_electionId, msg.sender);
    }

    /**
     * @notice Closes an election from voting
     * @dev Only owner/admins can call this function
     * @param _electionId ID of the election to close
     */
    function adminCloseElection(
        uint256 _electionId
    ) external onlyAdmin onlyRegisteredElection(_electionId) {
        Election storage election = s_elections[_electionId];
        election.isActive = false;
        emit ElectionClosed(_electionId, msg.sender);
    }

    /**
     * @notice Allows a candidate to enroll themselves in an election
     * @dev Candidate must be registered in CandidateDatabase
     * @dev Election must be in closed state
     * @param _electionId ID of the election to enroll in
     */
    function enrollCandidate(
        uint256 _electionId
    )
        external
        onlyRegisteredElection(_electionId)
        onlyClosedElection(_electionId)
        onlyRegisteredCandidate(msg.sender)
    {
        Election storage election = s_elections[_electionId];

        // Check if candidate is already registered in this election
        for (uint256 i = 0; i < election.candidates.length; i++) {
            if (election.candidates[i] == msg.sender) {
                revert ElectionDatabase__CandidateAlreadyEnrolled();
            }
        }

        election.candidates.push(msg.sender);

        emit CandidateEnrolled(_electionId, msg.sender);
    }

    /**
     * @notice Allows a candidate to withdraw themselves from an election
     * @dev Election must be in closed state
     * @param _electionId ID of the election to withdraw from
     */
    function withdrawCandidate(
        uint256 _electionId
    )
        external
        onlyRegisteredElection(_electionId)
        onlyClosedElection(_electionId)
    {
        Election storage election = s_elections[_electionId];

        // Find and remove the candidate
        bool found = false;
        for (uint256 i = 0; i < election.candidates.length; i++) {
            if (election.candidates[i] == msg.sender) {
                // Swap with last element and pop
                election.candidates[i] = election.candidates[
                    election.candidates.length - 1
                ];
                election.candidates.pop();
                found = true;
                break;
            }
        }

        if (!found) {
            revert ElectionDatabase__CandidateNotRegistered();
        }

        emit CandidateWithdrawn(_electionId, msg.sender);
    }

    /**
     * @notice Allows a registered voter to vote for a candidate in an active election
     * @param _electionId ID of the election
     * @param _candidate Address of the candidate to vote for
     */
    function vote(
        uint256 _electionId,
        address _candidate
    )
        external
        onlyRegisteredElection(_electionId)
        onlyOpenElection(_electionId)
        onlyEnrolledCandidate(_electionId, _candidate)
        onlyRegisteredVoter
    {
        Election storage election = s_elections[_electionId];

        // Check if voter already voted in this specific election
        if (election.voterToVoteTimestamp[msg.sender] > 0)
            revert ElectionDatabase__VoterAlreadyVoted();

        // Record the vote
        election.votesPerCandidate[_candidate]++;
        election.voterToChosenCandidate[msg.sender] = _candidate;
        election.voterToVoteTimestamp[msg.sender] = block.timestamp;
        election.totalVotes++;

        // Mark the voter as having voted in the voter database
        s_voterDB.adminMarkVoted(msg.sender);

        emit VoterVoted(_electionId, msg.sender, _candidate);
    }

    /**
     * @notice Adds a candidate to a registered election by an admin
     * @dev Only owner/admins can call this function
     * @param _electionId ID of the election
     * @param _candidate Address of the candidate to add
     */
    function adminEnrollCandidate(
        uint256 _electionId,
        address _candidate
    )
        external
        onlyAdmin
        onlyRegisteredElection(_electionId)
        onlyRegisteredCandidate(_candidate)
    {
        Election storage election = s_elections[_electionId];

        // Check if candidate is already registered in this election
        for (uint256 i = 0; i < election.candidates.length; i++) {
            if (election.candidates[i] == _candidate) {
                revert ElectionDatabase__CandidateAlreadyEnrolled();
            }
        }

        election.candidates.push(_candidate);

        emit AdminEnrolledCandidate(_electionId, _candidate, msg.sender);
    }

    /**
     * @notice Removes a candidate from an election by an admin
     * @dev Only owner/admins can call this function
     * @param _electionId ID of the election
     * @param _candidate Address of the candidate to remove
     */
    function adminWithdrawCandidate(
        uint256 _electionId,
        address _candidate
    ) external onlyAdmin onlyRegisteredElection(_electionId) {
        Election storage election = s_elections[_electionId];

        // Find and remove the candidate
        bool found = false;
        for (uint256 i = 0; i < election.candidates.length; i++) {
            if (election.candidates[i] == _candidate) {
                // Swap with last element and pop
                election.candidates[i] = election.candidates[
                    election.candidates.length - 1
                ];
                election.candidates.pop();
                found = true;
                break;
            }
        }

        if (!found) {
            revert ElectionDatabase__CandidateNotRegistered();
        }

        emit AdminRemovedCandidate(_electionId, _candidate, msg.sender);
    }

    /**
     * @notice Returns the vote count of a candidate in a specific election
     * @param _electionId ID of the election
     * @param _candidate Address of the candidate
     * @return Number of votes received by the candidate
     */
    function getVotesOfCandidate(
        uint256 _electionId,
        address _candidate
    ) external view onlyRegisteredElection(_electionId) returns (uint256) {
        return s_elections[_electionId].votesPerCandidate[_candidate];
    }

    /**
     * @notice Returns whether the election is currently active
     * @param _electionId ID of the election
     * @return Status of the election (true if active)
     */
    function getElectionStatus(
        uint256 _electionId
    ) external view onlyRegisteredElection(_electionId) returns (bool) {
        return s_elections[_electionId].isActive;
    }

    /**
     * @notice Returns comprehensive details of an election
     * @param _electionId ID of the election
     * @return name Name of the election
     * @return description Description of the election
     * @return isActive Whether the election is currently active
     * @return candidates Array of candidate addresses enrolled in the election
     * @return totalVotes Total number of votes cast in the election
     * @return registrationTimestamp When the election was created
     */
    function getElectionDetails(
        uint256 _electionId
    )
        external
        view
        onlyRegisteredElection(_electionId)
        returns (
            string memory name,
            string memory description,
            bool isActive,
            address[] memory candidates,
            uint256 totalVotes,
            uint256 registrationTimestamp
        )
    {
        Election storage election = s_elections[_electionId];
        return (
            election.name,
            election.description,
            election.isActive,
            election.candidates,
            election.totalVotes,
            election.registrationTimestamp
        );
    }

    /**
     * @notice Returns the total number of elections created
     * @return Count of all elections
     */
    function getElectionCount() external view returns (uint256) {
        return s_electionIds.length;
    }

    /**
     * @notice Returns all election IDs
     * @return Array of all election IDs
     */
    function getAllElectionIds() external view returns (uint256[] memory) {
        return s_electionIds;
    }

    /**
     * @notice Returns the list of registered candidates for a given election
     * @param _electionId ID of the election
     * @return Array of candidate addresses enrolled in the election
     */
    function getRegisteredCandidates(
        uint256 _electionId
    )
        external
        view
        onlyRegisteredElection(_electionId)
        returns (address[] memory)
    {
        return s_elections[_electionId].candidates;
    }

    /**
     * @notice Returns the total number of votes cast in an election
     * @param _electionId ID of the election
     * @return Total vote count
     */
    function getTotalVoteCount(
        uint256 _electionId
    ) external view onlyRegisteredElection(_electionId) returns (uint256) {
        return s_elections[_electionId].totalVotes;
    }

    /**
     * @notice Returns the winning candidate (highest votes) for a given election
     * @param _electionId ID of the election
     * @return Address of the winning candidate
     */
    function getWinner(
        uint256 _electionId
    ) external view onlyRegisteredElection(_electionId) returns (address) {
        Election storage election = s_elections[_electionId];
        uint256 maxVotes = 0;
        address winnerAddress = address(0);

        for (uint256 i = 0; i < election.candidates.length; i++) {
            address candidate = election.candidates[i];
            uint256 votes = election.votesPerCandidate[candidate];
            if (votes > maxVotes) {
                maxVotes = votes;
                winnerAddress = candidate;
            }
        }

        return winnerAddress;
    }

    /**
     * @notice Check if a voter has already voted in a specific election
     * @param _electionId ID of the election
     * @param _voter Address of the voter to check
     * @return True if the voter has voted in this election
     */
    function hasVoted(
        uint256 _electionId,
        address _voter
    ) external view onlyRegisteredElection(_electionId) returns (bool) {
        return s_elections[_electionId].voterToVoteTimestamp[_voter] > 0;
    }

    /**
     * @notice Get the timestamp when a voter voted in a specific election
     * @param _electionId ID of the election
     * @param _voter Address of the voter
     * @return Timestamp when the voter voted (0 if not voted)
     */
    function getVoteTimestamp(
        uint256 _electionId,
        address _voter
    ) external view onlyRegisteredElection(_electionId) returns (uint256) {
        return s_elections[_electionId].voterToVoteTimestamp[_voter];
    }

    /**
     * @notice Check who a voter voted for in a specific election
     * @dev Only viewable by registered voters (themselves)
     * @param _electionId ID of the election
     * @param _voter Address of the voter
     * @return Address of the candidate voted for (address(0) if not voted)
     */
    function getVoterChoice(
        uint256 _electionId,
        address _voter
    )
        external
        view
        onlyRegisteredElection(_electionId)
        onlyRegisteredVoter
        returns (address)
    {
        if (s_elections[_electionId].voterToVoteTimestamp[_voter] == 0) {
            return address(0); // Voter hasn't voted
        }
        return s_elections[_electionId].voterToChosenCandidate[_voter];
    }

    /**
     * @notice Returns the voting and candidate databases being used
     * @return voterDB Address of the VoterDatabase contract
     * @return candidateDB Address of the CandidateDatabase contract
     */
    function getDatabases()
        external
        view
        returns (address voterDB, address candidateDB)
    {
        return (address(s_voterDB), address(s_candidateDB));
    }
}
