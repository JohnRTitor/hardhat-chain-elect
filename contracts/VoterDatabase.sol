/// @title VoterDatabase Contract
/// @author Masum Reza
/// @notice This contract manages voter registration and voting status
/// @ Intended for use within an electronic voting machine/system
/// @dev functions specifically prepended with admin may only be called by the contract owner
/// @dev other functions are accessible to all users, except otherwise specified, see the provided modifier

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {IVoterDatabase} from "./interfaces/IVoterDatabase.sol";

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

/// @notice Thrown when import operations fail
error VoterDatabase__ImportFailed();

/// @notice Thrown when an invalid address is provided
error VoterDatabase__InvalidAddress();

contract VoterDatabase {
    /// @notice Enum representing gender
    enum Gender {
        Male,
        Female
    }

    /// @notice Stores details for a single voter
    struct Voter {
        string name;
        uint256 age;
        Gender gender;
        string presentAddress;
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

    /// @notice Emitted when voter data is imported
    /// @param sourceContract Address of the contract data was imported from
    /// @param votersImported Number of voters successfully imported
    event VotersImported(
        address indexed sourceContract,
        uint256 votersImported
    );

    /// @notice Emitted when admin adds a voter
    /// @param voter The address of the voter added by admin
    /// @param admin The admin who added the voter
    event AdminAddedVoter(address indexed voter, address indexed admin);

    /// @notice Emitted when admin updates a voter
    /// @param voter The address of the voter updated by admin
    /// @param admin The admin who updated the voter
    event AdminUpdatedVoter(address indexed voter, address indexed admin);

    /// @notice Emitted when admin removes a voter
    /// @param voter The address of the voter removed by admin
    /// @param admin The admin who removed the voter
    event AdminRemovedVoter(address indexed voter, address indexed admin);

    /// @notice Emitted when admin resets a voter's voting status
    /// @param voter The address of the voter whose status was reset
    /// @param admin The admin who reset the voter's status
    event AdminUpdatedVotingStatus(
        address indexed voter,
        address indexed admin
    );

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
    /// @param _gender Gender of the voter (0 for Male, 1 for Female)
    /// @param _presentAddress Present address of the voter
    function addVoter(
        string memory _name,
        uint256 _age,
        Gender _gender,
        string memory _presentAddress
    ) external {
        if (_age < 18) revert VoterDatabase__NotEligible();
        if (s_voters[msg.sender].isRegistered)
            revert VoterDatabase__AlreadyRegistered();

        s_voters[msg.sender] = Voter({
            name: _name,
            age: _age,
            gender: _gender,
            presentAddress: _presentAddress,
            hasVoted: false,
            isRegistered: true
        });

        s_voterAddresses.push(msg.sender);
        emit VoterRegistered(msg.sender);
    }

    /// @notice Update voter information (only if registered and not yet voted)
    /// @param _name Updated name
    /// @param _age Updated age
    /// @param _gender Updated gender
    /// @param _presentAddress Updated address
    function updateVoter(
        string memory _name,
        uint256 _age,
        Gender _gender,
        string memory _presentAddress
    ) external onlyRegistered {
        if (s_voters[msg.sender].hasVoted)
            revert VoterDatabase__CannotUpdateAfterVoting();

        Voter storage voter = s_voters[msg.sender];
        voter.name = _name;
        voter.age = _age;
        voter.gender = _gender;
        voter.presentAddress = _presentAddress;

        emit VoterUpdated(msg.sender);
    }

    /// @notice Allows a registered voter to delete their own registration
    function deleteVoter() external onlyRegistered {
        address voterAddress = msg.sender;

        // remove voter from mapping
        delete s_voters[voterAddress];

        // swap voter with last element and pop
        for (uint256 i = 0; i < s_voterAddresses.length; i++) {
            if (s_voterAddresses[i] == voterAddress) {
                s_voterAddresses[i] = s_voterAddresses[
                    s_voterAddresses.length - 1
                ];
                s_voterAddresses.pop();
                break;
            }
        }

        emit VoterDeleted(voterAddress);
    }

    /// @notice Mark a voter as having voted
    /// @dev Should be called by the election contract/unit tests
    function markVoted() external onlyRegistered {
        s_voters[msg.sender].hasVoted = true;
        emit VoterVoted(msg.sender);
    }

    /// @notice Admin function to add a voter directly
    /// @dev Only owner can call this function
    /// @param _voterAddress Address of the voter to add
    /// @param _name Name of the voter
    /// @param _age Age of the voter
    /// @param _gender Gender of the voter
    /// @param _presentAddress Present address of the voter
    /// @param _hasVoted Initial voting status of the voter
    function adminAddVoter(
        address _voterAddress,
        string memory _name,
        uint256 _age,
        Gender _gender,
        string memory _presentAddress,
        bool _hasVoted
    ) external onlyOwner {
        if (_voterAddress == address(0)) revert VoterDatabase__InvalidAddress();

        // Check if already registered
        if (s_voters[_voterAddress].isRegistered)
            revert VoterDatabase__AlreadyRegistered();

        s_voters[_voterAddress] = Voter({
            name: _name,
            age: _age,
            gender: _gender,
            presentAddress: _presentAddress,
            hasVoted: _hasVoted,
            isRegistered: true
        });

        s_voterAddresses.push(_voterAddress);

        emit AdminAddedVoter(_voterAddress, msg.sender);
    }

    /// @notice Admin function to update voter details (can update even if voter has voted)
    /// @dev Only owner can call this function
    /// @param _voterAddress Address of the voter to update
    /// @param _name Updated name
    /// @param _age Updated age
    /// @param _gender Updated gender
    /// @param _presentAddress Updated present address
    /// @param _hasVoted Updated voting status
    function adminUpdateVoter(
        address _voterAddress,
        string memory _name,
        uint256 _age,
        Gender _gender,
        string memory _presentAddress,
        bool _hasVoted
    ) external onlyOwner {
        if (!s_voters[_voterAddress].isRegistered)
            revert VoterDatabase__NotRegistered();

        Voter storage voter = s_voters[_voterAddress];

        // Update details but preserve voting status
        voter.name = _name;
        voter.age = _age;
        voter.gender = _gender;
        voter.presentAddress = _presentAddress;
        voter.hasVoted = _hasVoted;

        emit AdminUpdatedVoter(_voterAddress, msg.sender);
    }

    /// @notice Admin function to remove a voter
    /// @dev Only owner can call this function
    /// @param _voterAddress Address of the voter to remove
    function adminRemoveVoter(address _voterAddress) external onlyOwner {
        if (!s_voters[_voterAddress].isRegistered)
            revert VoterDatabase__NotRegistered();

        // Remove voter from mapping
        delete s_voters[_voterAddress];

        // Remove from the address array using swap and pop
        for (uint256 i = 0; i < s_voterAddresses.length; i++) {
            if (s_voterAddresses[i] == _voterAddress) {
                s_voterAddresses[i] = s_voterAddresses[
                    s_voterAddresses.length - 1
                ];
                s_voterAddresses.pop();
                break;
            }
        }

        emit AdminRemovedVoter(_voterAddress, msg.sender);
    }

    /// @notice Admin function to toggle a voter's voting status
    /// @dev Only owner can call this function
    /// @param _voterAddress Address of the voter
    /// @param _hasVoted New voting status to set
    function adminSetVotingStatus(
        address _voterAddress,
        bool _hasVoted
    ) external onlyOwner {
        if (!s_voters[_voterAddress].isRegistered)
            revert VoterDatabase__NotRegistered();

        s_voters[_voterAddress].hasVoted = _hasVoted;
        emit AdminUpdatedVotingStatus(_voterAddress, msg.sender);
    }

    /// @notice Import a specific voter from another VoterDatabase contract
    /// @dev Only owner can call this function
    /// @param _sourceContract The address of the source VoterDatabase contract
    /// @param _voterAddress The address of the voter to import
    function adminImportVoter(
        address _sourceContract,
        address _voterAddress
    ) external onlyOwner {
        // Skip if voter is already registered in this contract
        if (s_voters[_voterAddress].isRegistered) {
            revert VoterDatabase__AlreadyRegistered();
        }

        IVoterDatabase source = IVoterDatabase(_sourceContract);

        try source.adminGetVoterDetails(_voterAddress) returns (
            string memory name,
            uint256 age,
            IVoterDatabase.Gender gender,
            string memory presentAddress,
            bool hasVoted
        ) {
            // Add voter to this contract
            s_voters[_voterAddress] = Voter({
                name: name,
                age: age,
                gender: Gender(uint(gender)),
                presentAddress: presentAddress,
                hasVoted: hasVoted,
                isRegistered: true
            });

            s_voterAddresses.push(_voterAddress);
            emit VoterRegistered(_voterAddress);

            uint256 importedCount = 1;
            emit VotersImported(_sourceContract, importedCount);
        } catch {
            revert VoterDatabase__ImportFailed();
        }
    }

    /// @notice Batch import selected voters from another VoterDatabase contract
    /// @dev Only owner can call this function
    /// @param _sourceContract The address of the source VoterDatabase contract
    /// @param _voterAddresses Array of voter addresses to import
    function adminBatchImportVoters(
        address _sourceContract,
        address[] calldata _voterAddresses
    ) external onlyOwner {
        IVoterDatabase source = IVoterDatabase(_sourceContract);
        uint256 importedCount = 0;

        for (uint256 i = 0; i < _voterAddresses.length; i++) {
            address voterAddress = _voterAddresses[i];

            // Skip if voter is already registered
            if (s_voters[voterAddress].isRegistered) {
                continue;
            }

            try source.adminGetVoterDetails(voterAddress) returns (
                string memory name,
                uint256 age,
                IVoterDatabase.Gender gender,
                string memory presentAddress,
                bool hasVoted
            ) {
                // Add voter to this contract
                s_voters[voterAddress] = Voter({
                    name: name,
                    age: age,
                    gender: Gender(uint(gender)),
                    presentAddress: presentAddress,
                    hasVoted: hasVoted,
                    isRegistered: true
                });

                s_voterAddresses.push(voterAddress);
                emit VoterRegistered(voterAddress);
                importedCount++;
            } catch {
                // Continue to next voter if this one fails
                continue;
            }
        }

        emit VotersImported(_sourceContract, importedCount);
    }

    /// @notice Import all voters from another VoterDatabase contract
    /// @dev Only owner can call this function
    /// @param _sourceContract The address of the source VoterDatabase contract
    function adminImportAllVoters(address _sourceContract) external onlyOwner {
        IVoterDatabase source = IVoterDatabase(_sourceContract);
        address[] memory voters;

        // Use try/catch to handle potential errors from external calls
        try source.adminGetAllVoters() returns (address[] memory _voters) {
            voters = _voters;
        } catch {
            revert VoterDatabase__ImportFailed();
        }

        uint256 importedCount = 0;

        for (uint256 i = 0; i < voters.length; i++) {
            address voterAddress = voters[i];

            // Skip if voter is already registered in this contract
            if (s_voters[voterAddress].isRegistered) {
                continue;
            }

            try source.adminGetVoterDetails(voterAddress) returns (
                string memory name,
                uint256 age,
                IVoterDatabase.Gender gender,
                string memory presentAddress,
                bool hasVoted
            ) {
                // Add voter to this contract
                s_voters[voterAddress] = Voter({
                    name: name,
                    age: age,
                    gender: Gender(uint(gender)),
                    presentAddress: presentAddress,
                    hasVoted: hasVoted,
                    isRegistered: true
                });

                s_voterAddresses.push(voterAddress);
                emit VoterRegistered(voterAddress);
                importedCount++;
            } catch {
                // Continue to next voter if this one fails
                continue;
            }
        }

        emit VotersImported(_sourceContract, importedCount);
    }

    /// @notice Get details of a specific voter (only callable by owner for privacy reasons)
    /// @param _voterAddress Address of the voter
    /// @return name The voter's name
    /// @return age The voter's age
    /// @return gender The voter's gender
    /// @return presentAddress The voter's address
    /// @return hasVoted Whether the voter has cast their vote
    function adminGetVoterDetails(
        address _voterAddress
    )
        public
        view
        onlyOwner
        returns (
            string memory name,
            uint256 age,
            Gender gender,
            string memory presentAddress,
            bool hasVoted
        )
    {
        if (!s_voters[_voterAddress].isRegistered) {
            revert VoterDatabase__NotRegistered();
        }
        Voter memory voter = s_voters[_voterAddress];
        return (
            voter.name,
            voter.age,
            voter.gender,
            voter.presentAddress,
            voter.hasVoted
        );
    }

    /// @notice Get the total number of registered voters
    /// @return The count of registered voters
    function adminGetVoterCount() public view onlyOwner returns (uint256) {
        return s_voterAddresses.length;
    }

    /// @notice Get addresses of all registered voters
    /// @return Array of addresses of all registered voters
    function adminGetAllVoters()
        public
        view
        onlyOwner
        returns (address[] memory)
    {
        return s_voterAddresses;
    }

    /// @notice Get your own voter details
    /// @return name Your name
    /// @return age Your age
    /// @return gender Your gender
    /// @return presentAddress Your present address
    /// @return hasVoted Whether you have voted
    function getMyDetails()
        public
        view
        onlyRegistered
        returns (
            string memory name,
            uint256 age,
            Gender gender,
            string memory presentAddress,
            bool hasVoted
        )
    {
        Voter memory voter = s_voters[msg.sender];
        return (
            voter.name,
            voter.age,
            voter.gender,
            voter.presentAddress,
            voter.hasVoted
        );
    }

    /// @notice Get your own registration status
    /// @return isRegistered Whether you are registered to vote
    function getMyRegistrationStatus() public view returns (bool isRegistered) {
        return s_voters[msg.sender].isRegistered;
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
