/// @title VoterDatabase Contract
/// @author Masum Reza
/// @notice This contract manages voter registration and voting status
/// @dev Intended for use in an electronic voting system

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

/// @notice Thrown when a user under the age of 18 attempts to register
error VoterDatabase__NotEligible();

/// @notice Thrown when a non-registered user tries to perform a restricted action
error VoterDatabase__NotRegistered();

/// @notice Thrown when a user tries to register again
error VoterDatabase__AlreadyRegistered();

/// @notice Thrown when a non-owner tries to access restricted functionality
error VoterDatabase__NotOwner();

/// @notice Thrown when a voter attempts to update info after voting
error VoterDatabase__CannotUpdateAfterVoting();

// TODO: allow admin to update info
// TODO: investigate if we need something else/more
// TODO: complete NatSpec comments

contract VoterDatabase {
    /// @notice Stores details for a single voter
    struct Voter {
        string name;
        uint256 age;
        bool hasVoted;
        bool isRegistered;
    }

    address private immutable i_owner;
    mapping(address => Voter) private s_voters;
    address[] private s_voterAddresses;

    /// @notice Emitted when a new voter is registered
    /// @param voter The address of the newly registered voter
    event VoterRegistered(address indexed voter);

    /// @notice Emitted when a voter updates their information
    /// @param voter The address of the voter who updated info
    event VoterUpdated(address indexed voter);

    /// @notice Emitted when a voter is deleted from the system
    /// @param voter The address of the voter whose info was deleted
    event VoterDeleted(address indexed voter);

    /// @notice Emitted when a voter is marked as having voted
    /// @param voter The address of the voter who voted
    event VoterVoted(address indexed voter);

    /// @notice Functions with this modifier can only be called by registered voters
    modifier onlyRegistered() {
        if (!s_voters[msg.sender].isRegistered)
            revert VoterDatabase__NotRegistered();
        _;
    }

    /// @notice Restricts function access to the owner/election manager
    modifier onlyOwner() {
        if (msg.sender != i_owner) revert VoterDatabase__NotOwner();
        _;
    }

    /// @notice Contract constructor, sets the deployer as the owner
    constructor() {
        i_owner = msg.sender;
    }

    /// @notice Register a new voter
    /// @param _name Name of the voter
    /// @param _age Age of the voter (must be 18 or older)
    function addVoter(string memory _name, uint256 _age) public {
        if (_age < 18) revert VoterDatabase__NotEligible();
        if (s_voters[msg.sender].isRegistered)
            revert VoterDatabase__AlreadyRegistered();

        s_voters[msg.sender] = Voter({
            name: _name,
            age: _age,
            hasVoted: false,
            isRegistered: true
        });

        s_voterAddresses.push(msg.sender);
        emit VoterRegistered(msg.sender);
    }

    /// @notice Update voter information (only if registered and not yet voted)
    /// @param _name Updated name
    /// @param _age Updated age
    function updateVoter(
        string memory _name,
        uint256 _age
    ) public onlyRegistered {
        if (s_voters[msg.sender].hasVoted)
            revert VoterDatabase__CannotUpdateAfterVoting();

        s_voters[msg.sender].name = _name;
        s_voters[msg.sender].age = _age;

        emit VoterUpdated(msg.sender);
    }

    /// @notice Delete a voter's registration
    /// @dev Can only be executed by the owner
    /// @param _voterAddress Address of the voter to delete
    function deleteVoter(address _voterAddress) public onlyOwner {
        if (!s_voters[_voterAddress].isRegistered) {
            revert VoterDatabase__NotRegistered();
        }

        // remove voter from mapping
        delete s_voters[_voterAddress];

        // remove voter from array
        for (uint256 i = 0; i < s_voterAddresses.length; i++) {
            // first we find the index of the voter
            if (s_voterAddresses[i] == _voterAddress) {
                // since we can't remove the element directly, we move the last element to its position
                s_voterAddresses[i] = s_voterAddresses[
                    s_voterAddresses.length - 1
                ];
                // and then pop the last element, so list stays the same but without the deleted element
                s_voterAddresses.pop();
                break;
            }
        }

        emit VoterDeleted(_voterAddress);
    }

    // TODO: investigate if we should only allow the owner to mark as markVoted
    // TODO: implement stuff, call this from an external contract

    /// @notice Mark a voter as having voted
    /// @dev Should be called by the election contract or owner after vote is cast
    /// @param _voter Address of the voter to mark
    function markVoted(address _voter) public onlyOwner {
        s_voters[_voter].hasVoted = true;

        emit VoterVoted(_voter);
    }

    /// @notice Get details of a specific voter (only callable by owner)
    /// @param _voterAddress Address of the voter
    /// @return name The voter's name
    /// @return age The voter's age
    /// @return hasVoted Whether the voter has cast their vote
    function getVoterDetails(
        address _voterAddress
    )
        public
        view
        onlyOwner
        returns (string memory name, uint256 age, bool hasVoted)
    {
        if (!s_voters[_voterAddress].isRegistered) {
            revert VoterDatabase__NotRegistered();
        }
        Voter memory voter = s_voters[_voterAddress];
        return (voter.name, voter.age, voter.hasVoted);
    }

    /// @notice Get addresses of all registered voters
    /// @dev Only the owner/election manager can call this
    /// @return Array of addresses of all registered voters
    function getAllVoters() public view onlyOwner returns (address[] memory) {
        return s_voterAddresses;
    }

    /// @notice Get your own voter details
    /// @return name Your name
    /// @return age Your age
    /// @return hasVoted Whether you have voted
    function getMyDetails()
        public
        view
        onlyRegistered
        returns (string memory name, uint256 age, bool hasVoted)
    {
        Voter memory voter = s_voters[msg.sender];
        return (voter.name, voter.age, voter.hasVoted);
    }

    /// @notice Get your own registration status
    /// @return isRegistered Whether you are registered to vote
    function getMyRegistrationStatus() public view returns (bool isRegistered) {
        if (!s_voters[msg.sender].isRegistered) {
            return false;
        }
        return true;
    }

    /// @notice Get your own voting status
    /// @return hasVoted Whether you have voted
    function getMyVotingStatus()
        public
        view
        onlyRegistered
        returns (bool hasVoted)
    {
        return s_voters[msg.sender].hasVoted;
    }
}
