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

/// @notice Thrown when a non-admin tries to access admin functionality
error VoterDatabase__NotAdmin();

/// @notice Thrown when trying to add an address that's already an admin
error VoterDatabase__AlreadyAdmin();

/// @notice Thrown when trying to remove an address that's not an admin
error VoterDatabase__AdminNotFound();

contract VoterDatabase is IVoterDatabase {
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

    // Admin system
    mapping(address => bool) private s_admins;
    address[] private s_adminAddresses;

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

    /// @notice Restricts function access to admins (including the owner)
    modifier onlyAdmin() {
        if (msg.sender != i_owner && !s_admins[msg.sender])
            revert VoterDatabase__NotAdmin();
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
    ) external override {
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
    ) external override onlyRegistered {
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
    function deleteVoter() external override onlyRegistered {
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
    function markVoted() external override onlyRegistered {
        s_voters[msg.sender].hasVoted = true;
        emit VoterVoted(msg.sender);
    }

    /// @notice Admin function to add a voter directly
    /// @dev Only owner/admins can call this function
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
    ) external override onlyAdmin {
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
    /// @dev Only owner/admins can call this function
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
    ) external override onlyAdmin {
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
    /// @dev Only owner/admins can call this function
    /// @param _voterAddress Address of the voter to remove
    function adminRemoveVoter(
        address _voterAddress
    ) external override onlyAdmin {
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
    /// @dev Only owner/admins can call this function
    /// @param _voterAddress Address of the voter
    /// @param _hasVoted New voting status to set
    function adminSetVotingStatus(
        address _voterAddress,
        bool _hasVoted
    ) external override onlyAdmin {
        if (!s_voters[_voterAddress].isRegistered)
            revert VoterDatabase__NotRegistered();

        s_voters[_voterAddress].hasVoted = _hasVoted;
        emit AdminUpdatedVotingStatus(_voterAddress, msg.sender);
    }

    /// @notice Import a specific voter from another VoterDatabase contract
    /// @dev Only owner/admins can call this function
    /// @param _sourceContract The address of the source VoterDatabase contract
    /// @param _voterAddress The address of the voter to import
    function adminImportVoter(
        address _sourceContract,
        address _voterAddress
    ) external override onlyAdmin {
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
    /// @dev Only owner/admins can call this function
    /// @param _sourceContract The address of the source VoterDatabase contract
    /// @param _voterAddresses Array of voter addresses to import
    function adminBatchImportVoters(
        address _sourceContract,
        address[] calldata _voterAddresses
    ) external override onlyAdmin {
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
    /// @dev Only owner/admins can call this function
    /// @param _sourceContract The address of the source VoterDatabase contract
    function adminImportAllVoters(
        address _sourceContract
    ) external override onlyAdmin {
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

    /// @notice Get details of a specific voter (only callable by owner/admins for privacy reasons)
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
        override
        onlyAdmin
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
    function adminGetVoterCount()
        public
        view
        override
        onlyAdmin
        returns (uint256)
    {
        return s_voterAddresses.length;
    }

    /// @notice Get addresses of all registered voters
    /// @return Array of addresses of all registered voters
    function adminGetAllVoters()
        public
        view
        override
        onlyAdmin
        returns (address[] memory)
    {
        return s_voterAddresses;
    }

    /// @notice Add a new admin to the system
    /// @dev Only owner can call this function
    /// @param _adminAddress Address to be added as admin
    function addAdmin(address _adminAddress) external override onlyOwner {
        if (_adminAddress == address(0)) revert VoterDatabase__InvalidAddress();
        if (s_admins[_adminAddress]) revert VoterDatabase__AlreadyAdmin();

        s_admins[_adminAddress] = true;
        s_adminAddresses.push(_adminAddress);

        emit AdminAdded(_adminAddress, msg.sender);
    }

    /// @notice Remove an admin from the system
    /// @dev Only owner can call this function
    /// @param _adminAddress Address to be removed from admin role
    function removeAdmin(address _adminAddress) external override onlyOwner {
        if (!s_admins[_adminAddress]) revert VoterDatabase__AdminNotFound();

        // Remove admin from mapping
        delete s_admins[_adminAddress];

        // Remove from the admin array using swap and pop
        for (uint256 i = 0; i < s_adminAddresses.length; i++) {
            if (s_adminAddresses[i] == _adminAddress) {
                s_adminAddresses[i] = s_adminAddresses[
                    s_adminAddresses.length - 1
                ];
                s_adminAddresses.pop();
                break;
            }
        }

        emit AdminRemoved(_adminAddress, msg.sender);
    }

    /// @notice Check if an address is an admin
    /// @param _address Address to check
    /// @return True if the address is an admin, false otherwise
    function isAdmin(address _address) public view override returns (bool) {
        return _address == i_owner || s_admins[_address];
    }

    /// @notice Get the total number of admins (excluding owner)
    /// @return The count of admins
    function getAdminCount() public view override returns (uint256) {
        return s_adminAddresses.length;
    }

    /// @notice Get addresses of all admins (excluding owner)
    /// @return Array of admin addresses
    function getAllAdmins() public view override returns (address[] memory) {
        return s_adminAddresses;
    }

    /// @notice Get the contract owner address
    /// @return The address of the contract owner
    function getOwner() public view override returns (address) {
        return i_owner;
    }

    /// @notice Check if the caller is an admin
    /// @return True if the caller is an admin, false otherwise
    function amIAdmin() public view override returns (bool) {
        return isAdmin(msg.sender);
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
        override
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
    function getMyRegistrationStatus()
        public
        view
        override
        returns (bool isRegistered)
    {
        return s_voters[msg.sender].isRegistered;
    }

    /// @notice Get your own voting status
    /// @return hasVoted Whether you have voted
    function getMyVotingStatus()
        public
        view
        override
        onlyRegistered
        returns (bool hasVoted)
    {
        return s_voters[msg.sender].hasVoted;
    }
}
