// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.8;

/**
 * @title VoterDatabase Contract
 * @author Masum Reza
 * @notice This contract manages voter registration and voting status
 * @notice Intended for use within an electronic voting machine/system
 * @dev functions specifically prepended with admin may only be called by the contract owner
 * @dev other functions are accessible to all users, except otherwise specified, see the provided modifier
 */

import {IVoterDatabase} from "./interfaces/IVoterDatabase.sol";
import {AdminManagement} from "./shared/AdminManagement.sol";

/// @notice Thrown when a user under the age of 18 attempts to register
error VoterDatabase__NotEligible();

/// @notice Thrown when a non-registered user tries to perform a restricted action
error VoterDatabase__NotRegistered();

/// @notice Thrown when a user tries to register again
error VoterDatabase__AlreadyRegistered();

/// @notice Thrown when a voter attempts to update info after voting
error VoterDatabase__CannotUpdateAfterVoting();

/// @notice Thrown when import operations fail
error VoterDatabase__ImportFailed();

/// @notice Thrown when an invalid address is provided
error VoterDatabase__InvalidAddress();

contract VoterDatabase is IVoterDatabase, AdminManagement {
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant MIN_ELIGIBLE_AGE = 18;

    /// @notice Stores details for a single voter
    struct Voter {
        string name;
        uint256 dateOfBirthEpoch;
        Gender gender;
        string presentAddress;
        bool hasVoted;
        uint256 registrationTimestamp; // If > 0, voter is registered
    }

    mapping(address => Voter) private s_voters;
    address[] private s_voterAddresses;

    /// @notice Functions with this modifier can only be called by registered voters
    modifier onlyRegistered() {
        if (s_voters[msg.sender].registrationTimestamp == 0)
            revert VoterDatabase__NotRegistered();
        _;
    }

    /// @notice Register a new voter
    /// @param _name Name of the voter
    /// @param _dateOfBirthEpoch Date of birth as Unix timestamp
    /// @param _gender Gender of the voter (0 for Male, 1 for Female)
    /// @param _presentAddress Present address of the voter
    function addVoter(
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress
    ) external override {
        // Calculate age using constant for seconds in a year
        uint256 age = (block.timestamp - _dateOfBirthEpoch) / SECONDS_PER_YEAR;
        if (age < MIN_ELIGIBLE_AGE) revert VoterDatabase__NotEligible();

        if (s_voters[msg.sender].registrationTimestamp > 0)
            revert VoterDatabase__AlreadyRegistered();

        s_voters[msg.sender] = Voter({
            name: _name,
            dateOfBirthEpoch: _dateOfBirthEpoch,
            gender: _gender,
            presentAddress: _presentAddress,
            hasVoted: false,
            registrationTimestamp: block.timestamp
        });

        s_voterAddresses.push(msg.sender);
        emit VoterRegistered(msg.sender);
    }

    /// @notice Update voter information (only if registered and not yet voted)
    /// @param _name Updated name
    /// @param _dateOfBirthEpoch Updated date of birth as Unix timestamp
    /// @param _gender Updated gender
    /// @param _presentAddress Updated address
    function updateVoter(
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress
    ) external override onlyRegistered {
        if (s_voters[msg.sender].hasVoted)
            revert VoterDatabase__CannotUpdateAfterVoting();

        // Verify age eligibility with the new DOB
        uint256 age = (block.timestamp - _dateOfBirthEpoch) / SECONDS_PER_YEAR;
        if (age < MIN_ELIGIBLE_AGE) revert VoterDatabase__NotEligible();

        Voter storage voter = s_voters[msg.sender];
        voter.name = _name;
        voter.dateOfBirthEpoch = _dateOfBirthEpoch;
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
        uint256 length = s_voterAddresses.length;
        for (uint256 i = 0; i < length; ) {
            if (s_voterAddresses[i] == voterAddress) {
                s_voterAddresses[i] = s_voterAddresses[length - 1];
                s_voterAddresses.pop();
                break;
            }
            unchecked {
                ++i;
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
    /// @param _dateOfBirthEpoch Date of birth as Unix timestamp
    /// @param _gender Gender of the voter
    /// @param _presentAddress Present address of the voter
    /// @param _hasVoted Initial voting status of the voter
    function adminAddVoter(
        address _voterAddress,
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        bool _hasVoted
    ) external override onlyAdmin {
        if (_voterAddress == address(0)) revert VoterDatabase__InvalidAddress();

        // Check if already registered
        if (s_voters[_voterAddress].registrationTimestamp > 0)
            revert VoterDatabase__AlreadyRegistered();

        // Check age eligibility
        uint256 age = (block.timestamp - _dateOfBirthEpoch) / SECONDS_PER_YEAR;
        if (age < MIN_ELIGIBLE_AGE) revert VoterDatabase__NotEligible();

        s_voters[_voterAddress] = Voter({
            name: _name,
            dateOfBirthEpoch: _dateOfBirthEpoch,
            registrationTimestamp: block.timestamp,
            gender: _gender,
            presentAddress: _presentAddress,
            hasVoted: _hasVoted
        });

        s_voterAddresses.push(_voterAddress);

        emit AdminAddedVoter(_voterAddress, msg.sender);
    }

    /// @notice Admin function to update voter details (can update even if voter has voted)
    /// @dev Only owner/admins can call this function
    /// @param _voterAddress Address of the voter to update
    /// @param _name Updated name
    /// @param _dateOfBirthEpoch Updated date of birth as Unix timestamp
    /// @param _gender Updated gender
    /// @param _presentAddress Updated present address
    /// @param _hasVoted Updated voting status
    function adminUpdateVoter(
        address _voterAddress,
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        bool _hasVoted
    ) external override onlyAdmin {
        if (s_voters[_voterAddress].registrationTimestamp == 0)
            revert VoterDatabase__NotRegistered();

        // Check age eligibility
        uint256 age = (block.timestamp - _dateOfBirthEpoch) / SECONDS_PER_YEAR;
        if (age < MIN_ELIGIBLE_AGE) revert VoterDatabase__NotEligible();

        Voter storage voter = s_voters[_voterAddress];

        // Update details but preserve registrationTimestamp
        voter.name = _name;
        voter.dateOfBirthEpoch = _dateOfBirthEpoch;
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
        if (s_voters[_voterAddress].registrationTimestamp == 0)
            revert VoterDatabase__NotRegistered();

        // Remove voter from mapping
        delete s_voters[_voterAddress];

        // Remove from the address array using swap and pop
        uint256 length = s_voterAddresses.length;
        for (uint256 i = 0; i < length; ) {
            if (s_voterAddresses[i] == _voterAddress) {
                s_voterAddresses[i] = s_voterAddresses[length - 1];
                s_voterAddresses.pop();
                break;
            }
            unchecked {
                ++i;
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
        if (s_voters[_voterAddress].registrationTimestamp == 0)
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
        if (s_voters[_voterAddress].registrationTimestamp > 0) {
            revert VoterDatabase__AlreadyRegistered();
        }

        IVoterDatabase source = IVoterDatabase(_sourceContract);

        try source.adminGetVoterDetails(_voterAddress) returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            IVoterDatabase.Gender gender,
            string memory presentAddress,
            bool hasVoted,
            uint256 /* registrationTimestamp */
        ) {
            // Check age eligibility
            uint256 age = (block.timestamp - dateOfBirthEpoch) /
                SECONDS_PER_YEAR;
            if (age < MIN_ELIGIBLE_AGE) revert VoterDatabase__NotEligible();

            // Add voter to this contract
            s_voters[_voterAddress] = Voter({
                name: name,
                dateOfBirthEpoch: dateOfBirthEpoch,
                registrationTimestamp: block.timestamp,
                gender: Gender(uint(gender)),
                presentAddress: presentAddress,
                hasVoted: hasVoted
            });

            s_voterAddresses.push(_voterAddress);
            emit VoterRegistered(_voterAddress);

            emit VotersImported(_sourceContract, 1);
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

        uint256 length = _voterAddresses.length;
        for (uint256 i = 0; i < length; ) {
            address voterAddress = _voterAddresses[i];

            // Skip if voter is already registered
            if (s_voters[voterAddress].registrationTimestamp > 0) {
                unchecked {
                    ++i;
                }
                continue;
            }

            try source.adminGetVoterDetails(voterAddress) returns (
                string memory name,
                uint256 dateOfBirthEpoch,
                IVoterDatabase.Gender gender,
                string memory presentAddress,
                bool hasVoted,
                uint256 /* registrationTimestamp */
            ) {
                // Check age eligibility
                uint256 age = (block.timestamp - dateOfBirthEpoch) /
                    SECONDS_PER_YEAR;
                if (age < MIN_ELIGIBLE_AGE) {
                    unchecked {
                        ++i;
                    }
                    continue; // Skip ineligible voters
                }

                // Add voter to this contract
                s_voters[voterAddress] = Voter({
                    name: name,
                    dateOfBirthEpoch: dateOfBirthEpoch,
                    registrationTimestamp: block.timestamp,
                    gender: Gender(uint(gender)),
                    presentAddress: presentAddress,
                    hasVoted: hasVoted
                });

                s_voterAddresses.push(voterAddress);
                emit VoterRegistered(voterAddress);
                unchecked {
                    ++importedCount;
                    ++i;
                }
            } catch {
                // Continue to next voter if this one fails
                unchecked {
                    ++i;
                }
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

        uint256 length = voters.length;
        for (uint256 i = 0; i < length; ) {
            address voterAddress = voters[i];

            // Skip if voter is already registered in this contract
            if (s_voters[voterAddress].registrationTimestamp > 0) {
                unchecked {
                    ++i;
                }
                continue;
            }

            try source.adminGetVoterDetails(voterAddress) returns (
                string memory name,
                uint256 dateOfBirthEpoch,
                IVoterDatabase.Gender gender,
                string memory presentAddress,
                bool hasVoted,
                uint256 /* registrationTimestamp */
            ) {
                // Check age eligibility
                uint256 age = (block.timestamp - dateOfBirthEpoch) /
                    SECONDS_PER_YEAR;
                if (age < MIN_ELIGIBLE_AGE) {
                    unchecked {
                        ++i;
                    }
                    continue; // Skip ineligible voters
                }

                // Add voter to this contract
                s_voters[voterAddress] = Voter({
                    name: name,
                    dateOfBirthEpoch: dateOfBirthEpoch,
                    registrationTimestamp: block.timestamp,
                    gender: Gender(uint(gender)),
                    presentAddress: presentAddress,
                    hasVoted: hasVoted
                });

                s_voterAddresses.push(voterAddress);
                emit VoterRegistered(voterAddress);
                unchecked {
                    ++importedCount;
                    ++i;
                }
            } catch {
                // Continue to next voter if this one fails
                unchecked {
                    ++i;
                }
                continue;
            }
        }

        emit VotersImported(_sourceContract, importedCount);
    }

    /// @notice Get details of a specific voter (only callable by owner/admins for privacy reasons)
    /// @param _voterAddress Address of the voter
    /// @return name The voter's name
    /// @return dateOfBirthEpoch The voter's date of birth as Unix timestamp
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
            uint256 dateOfBirthEpoch,
            Gender gender,
            string memory presentAddress,
            bool hasVoted,
            uint256 registrationTimestamp
        )
    {
        if (s_voters[_voterAddress].registrationTimestamp == 0) {
            revert VoterDatabase__NotRegistered();
        }
        Voter memory voter = s_voters[_voterAddress];
        return (
            voter.name,
            voter.dateOfBirthEpoch,
            voter.gender,
            voter.presentAddress,
            voter.hasVoted,
            voter.registrationTimestamp
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

    /// @notice Calculate age from date of birth
    /// @param _dateOfBirthEpoch Date of birth as Unix timestamp
    /// @return Age in years
    function calculateAge(
        uint256 _dateOfBirthEpoch
    ) public view returns (uint256) {
        return (block.timestamp - _dateOfBirthEpoch) / SECONDS_PER_YEAR;
    }

    /// @notice Get your own voter details
    /// @return name Your name
    /// @return dateOfBirthEpoch Your date of birth as Unix timestamp
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
            uint256 dateOfBirthEpoch,
            Gender gender,
            string memory presentAddress,
            bool hasVoted
        )
    {
        Voter memory voter = s_voters[msg.sender];
        return (
            voter.name,
            voter.dateOfBirthEpoch,
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
        return s_voters[msg.sender].registrationTimestamp > 0;
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

    /// @notice Get your current age based on stored date of birth
    /// @return Your current age in years
    function getMyAge() public view onlyRegistered returns (uint256) {
        return calculateAge(s_voters[msg.sender].dateOfBirthEpoch);
    }
}
