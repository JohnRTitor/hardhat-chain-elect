// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.8;

/**
 * @title VoterDatabase Contract
 * @author Masum Reza
 * @notice This contract manages voter registration and voting status for an electronic voting system
 * @dev This contract implements:
 *      - Self-registration management for voters
 *      - Admin functions for voter management
 *      - Importing functionality from other voter databases
 *      - Privacy protection through access control
 */

import {IVoterDatabase} from "./interfaces/IVoterDatabase.sol";
import {AdminManagement} from "./shared/AdminManagement.sol";
import {ElectionUtils} from "./lib/ElectionUtils.sol";

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
    uint256 private constant MIN_ELIGIBLE_AGE = 18;

    /**
     * @notice Stores details for a single voter
     * @dev The registrationTimestamp serves as both a timestamp and a registration flag
     *    - If > 0, voter is registered
     */
    struct Voter {
        string name;
        string presentAddress;
        string email;
        Gender gender;
        uint256 timesVoted;
        uint256 dateOfBirthEpoch;
        uint256 registrationTimestamp;
    }

    /// @dev Main storage for voter information
    mapping(address => Voter) private s_voters;

    /// @dev Array of all registered voter addresses for enumeration
    address[] private s_voterAddresses;

    /**
     * @notice Ensures the user meets minimum age requirements
     * @param _dateOfBirthEpoch Date of birth as Unix timestamp
     */
    modifier onlyEligible(uint256 _dateOfBirthEpoch) {
        if (ElectionUtils.calculateAge(_dateOfBirthEpoch) < MIN_ELIGIBLE_AGE)
            revert VoterDatabase__NotEligible();
        _;
    }

    /**
     * @notice Ensures the address belongs to a registered voter
     * @param _voterAddress Address to check for registration
     */
    modifier onlyRegistered(address _voterAddress) {
        if (s_voters[_voterAddress].registrationTimestamp == 0)
            revert VoterDatabase__NotRegistered();
        _;
    }

    /**
     * @notice Ensures the address does not belong to an already registered voter
     * @param _voterAddress Address to check for registration
     */
    modifier onlyNotRegistered(address _voterAddress) {
        if (s_voters[_voterAddress].registrationTimestamp > 0)
            revert VoterDatabase__AlreadyRegistered();
        _;
    }

    /**
     * @notice Ensures the provided address is not the zero address
     * @param _voterAddress Address to validate
     */
    modifier onlyValidAddress(address _voterAddress) {
        if (_voterAddress == address(0)) revert VoterDatabase__InvalidAddress();
        _;
    }

    /**
     * @notice Internal function to add a new voter to the database
     * @dev Used by both self-registration and admin functions
     * @param _voterAddress Address of the voter to add
     * @param _name Name of the voter
     * @param _dateOfBirthEpoch Date of birth as Unix timestamp
     * @param _gender Gender of the voter
     * @param _presentAddress Present address of the voter
     * @param _email Email address of the voter
     * @param _timesVoted Initial voting status count (typically 0 for new registrations)
     */
    function _addVoter(
        address _voterAddress,
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        uint256 _timesVoted
    )
        internal
        onlyEligible(_dateOfBirthEpoch)
        onlyNotRegistered(_voterAddress)
    {
        s_voters[_voterAddress] = Voter({
            name: _name,
            dateOfBirthEpoch: _dateOfBirthEpoch,
            gender: _gender,
            presentAddress: _presentAddress,
            email: _email,
            timesVoted: _timesVoted,
            registrationTimestamp: block.timestamp
        });

        s_voterAddresses.push(_voterAddress);
    }

    /**
     * @notice Internal function to update voter details
     * @dev Used by both self-update and admin functions
     * @param _voterAddress Address of the voter to update
     * @param _name Updated name
     * @param _dateOfBirthEpoch Updated date of birth as Unix timestamp
     * @param _gender Updated gender
     * @param _presentAddress Updated present address
     * @param _email Updated email address
     * @param _timesVoted Updated times voted count (typically preserved/unchanged in regular updates)
     */
    function _updateVoter(
        address _voterAddress,
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        uint256 _timesVoted
    ) internal onlyEligible(_dateOfBirthEpoch) onlyRegistered(_voterAddress) {
        Voter storage voter = s_voters[_voterAddress];

        // Update details but preserve registrationTimestamp
        voter.name = _name;
        voter.dateOfBirthEpoch = _dateOfBirthEpoch;
        voter.gender = _gender;
        voter.presentAddress = _presentAddress;
        voter.email = _email;
        voter.timesVoted = _timesVoted;
    }

    /**
     * @notice Internal function to remove a voter from the database
     * @dev Removes from mapping and updates the address array for enumeration
     * @param _voterAddress Address of the voter to remove
     */
    function _deleteVoter(
        address _voterAddress
    ) internal onlyRegistered(_voterAddress) {
        // remove voter from mapping
        delete s_voters[_voterAddress];

        // swap voter with last element and pop
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
    }

    /**
     * @notice Register a new voter in the system
     * @dev Self-registration function for first-time voters
     * @param _name Name of the voter
     * @param _dateOfBirthEpoch Date of birth as Unix timestamp
     * @param _gender Gender of the voter (0 for Male, 1 for Female)
     * @param _presentAddress Present address of the voter
     * @param _email Email address of the voter
     */
    function addVoter(
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email
    ) external override {
        _addVoter(
            msg.sender,
            _name,
            _dateOfBirthEpoch,
            _gender,
            _presentAddress,
            _email,
            0
        );
        emit VoterRegistered(msg.sender);
    }

    /**
     * @notice Update voter information
     * @dev Self-update function for registered voters
     * @param _name Updated name
     * @param _dateOfBirthEpoch Updated date of birth as Unix timestamp
     * @param _gender Updated gender
     * @param _presentAddress Updated address
     * @param _email Updated email
     */
    function updateVoter(
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email
    ) external override {
        Voter storage voter = s_voters[msg.sender];
        if (voter.timesVoted > 0) {
            revert VoterDatabase__CannotUpdateAfterVoting();
        }

        _updateVoter(
            msg.sender,
            _name,
            _dateOfBirthEpoch,
            _gender,
            _presentAddress,
            _email,
            voter.timesVoted // Preserve existing voting status
        );

        emit VoterUpdated(msg.sender);
    }

    /**
     * @notice Allows a registered voter to delete their own registration
     * @dev Self-removal function for registered voters
     */
    function deleteVoter() external override onlyRegistered(msg.sender) {
        Voter storage voter = s_voters[msg.sender];
        if (voter.timesVoted > 0) {
            revert VoterDatabase__CannotUpdateAfterVoting();
        }

        _deleteVoter(msg.sender);
        emit VoterDeleted(msg.sender);
    }

    /**
     * @notice Mark a voter as having voted
     * @dev Should be called by the election contract
     */
    function markVoted() external override onlyRegistered(msg.sender) {
        s_voters[msg.sender].timesVoted += 1;
    }

    /**
     * @notice Admin function to add a voter directly
     * @dev Only owner/admins can call this function
     * @param _voterAddress Address of the voter to add
     * @param _name Name of the voter
     * @param _dateOfBirthEpoch Date of birth as Unix timestamp
     * @param _gender Gender of the voter
     * @param _presentAddress Present address of the voter
     * @param _email Email address of the voter
     * @param _timesVoted Initial voting status of the voter
     */
    function adminAddVoter(
        address _voterAddress,
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        uint256 _timesVoted
    ) external override onlyAdmin onlyValidAddress(_voterAddress) {
        _addVoter(
            _voterAddress,
            _name,
            _dateOfBirthEpoch,
            _gender,
            _presentAddress,
            _email,
            _timesVoted
        );
        emit AdminAddedVoter(_voterAddress, msg.sender);
    }

    /**
     * @notice Admin function to update voter details
     * @dev Only owner/admins can call this function, can update even if voter has voted
     * @param _voterAddress Address of the voter to update
     * @param _name Updated name
     * @param _dateOfBirthEpoch Updated date of birth as Unix timestamp
     * @param _gender Updated gender
     * @param _presentAddress Updated present address
     * @param _email Updated email address
     * @param _timesVoted Updated voting status
     */
    function adminUpdateVoter(
        address _voterAddress,
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        uint256 _timesVoted
    ) external override onlyAdmin onlyValidAddress(_voterAddress) {
        _updateVoter(
            _voterAddress,
            _name,
            _dateOfBirthEpoch,
            _gender,
            _presentAddress,
            _email,
            _timesVoted
        );
        emit AdminUpdatedVoter(_voterAddress, msg.sender);
    }

    /**
     * @notice Admin function to remove a voter
     * @dev Only owner/admins can call this function
     * @param _voterAddress Address of the voter to remove
     */
    function adminRemoveVoter(
        address _voterAddress
    ) external override onlyAdmin onlyValidAddress(_voterAddress) {
        _deleteVoter(_voterAddress);
        emit AdminRemovedVoter(_voterAddress, msg.sender);
    }

    /**
     * @notice Admin function to mark a voter as having voted
     * @dev Only owner/admins can call this function
     * @param _voterAddress Address of the voter
     */
    function adminMarkVoted(
        address _voterAddress
    ) external override onlyAdmin onlyRegistered(_voterAddress) {
        s_voters[_voterAddress].timesVoted += 1;
        emit AdminUpdatedVotingStatus(_voterAddress, msg.sender);
    }

    /**
     * @notice Import a specific voter from another VoterDatabase contract
     * @dev Only owner/admins can call this function
     * @param _sourceContract The address of the source VoterDatabase contract
     * @param _voterAddress The address of the voter to import
     */
    function adminImportVoter(
        address _sourceContract,
        address _voterAddress
    ) external override onlyAdmin onlyNotRegistered(_voterAddress) {
        IVoterDatabase source = IVoterDatabase(_sourceContract);

        try source.adminGetVoterDetails(_voterAddress) returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            IVoterDatabase.Gender gender,
            string memory presentAddress,
            string memory email,
            uint256 timesVoted,
            uint256 /* registrationTimestamp */
        ) {
            _addVoter(
                _voterAddress,
                name,
                dateOfBirthEpoch,
                gender,
                presentAddress,
                email,
                timesVoted
            );

            emit AdminAddedVoter(_voterAddress, msg.sender);
            emit VotersImported(_sourceContract, 1);
        } catch {
            revert VoterDatabase__ImportFailed();
        }
    }

    /**
     * @notice Batch import selected voters from another VoterDatabase contract
     * @dev Only owner/admins can call this function
     * @param _sourceContract The address of the source VoterDatabase contract
     * @param _voterAddresses Array of voter addresses to import
     */
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
                string memory email,
                uint256 timesVoted,
                uint256 /* registrationTimestamp */
            ) {
                _addVoter(
                    voterAddress,
                    name,
                    dateOfBirthEpoch,
                    gender,
                    presentAddress,
                    email,
                    timesVoted
                );

                emit AdminAddedVoter(voterAddress, msg.sender);

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

    /**
     * @notice Import all voters from another VoterDatabase contract
     * @dev Only owner/admins can call this function
     * @param _sourceContract The address of the source VoterDatabase contract
     */
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
                string memory email,
                uint256 timesVoted,
                uint256 /* registrationTimestamp */
            ) {
                _addVoter(
                    voterAddress,
                    name,
                    dateOfBirthEpoch,
                    gender,
                    presentAddress,
                    email,
                    timesVoted
                );

                emit AdminAddedVoter(voterAddress, msg.sender);

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

    /**
     * @notice Get details of a specific voter
     * @dev Only callable by owner/admins for privacy reasons
     * @param _voterAddress Address of the voter
     * @return name The voter's name
     * @return dateOfBirthEpoch The voter's date of birth as Unix timestamp
     * @return gender The voter's gender
     * @return presentAddress The voter's address
     * @return email The voter's email
     * @return timesVoted How many times the voter has cast their vote
     * @return registrationTimestamp When the voter registered
     */
    function adminGetVoterDetails(
        address _voterAddress
    )
        public
        view
        override
        onlyAdmin
        onlyRegistered(_voterAddress)
        returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            Gender gender,
            string memory presentAddress,
            string memory email,
            uint256 timesVoted,
            uint256 registrationTimestamp
        )
    {
        Voter memory voter = s_voters[_voterAddress];
        return (
            voter.name,
            voter.dateOfBirthEpoch,
            voter.gender,
            voter.presentAddress,
            voter.email,
            voter.timesVoted,
            voter.registrationTimestamp
        );
    }

    /**
     * @notice Get the total number of registered voters
     * @dev Only callable by owner/admins
     * @return count The count of registered voters
     */
    function adminGetVoterCount()
        public
        view
        override
        onlyAdmin
        returns (uint256 count)
    {
        return s_voterAddresses.length;
    }

    /**
     * @notice Get addresses of all registered voters
     * @dev Only callable by owner/admins
     * @return voterAddresses Array of addresses of all registered voters
     */
    function adminGetAllVoters()
        public
        view
        override
        onlyAdmin
        returns (address[] memory voterAddresses)
    {
        return s_voterAddresses;
    }

    /**
     * @notice Get your own voter details
     * @return name Your name
     * @return dateOfBirthEpoch Your date of birth as Unix timestamp
     * @return gender Your gender
     * @return presentAddress Your present address
     * @return email Your email address
     * @return timesVoted How many times you have voted
     * @return registrationTimestamp When you registered
     */
    function getMyDetails()
        public
        view
        override
        onlyRegistered(msg.sender)
        returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            Gender gender,
            string memory presentAddress,
            string memory email,
            uint256 timesVoted,
            uint256 registrationTimestamp
        )
    {
        Voter memory voter = s_voters[msg.sender];
        return (
            voter.name,
            voter.dateOfBirthEpoch,
            voter.gender,
            voter.presentAddress,
            voter.email,
            voter.timesVoted,
            voter.registrationTimestamp
        );
    }

    /**
     * @notice Get your own registration status
     * @return isRegistered Whether you are registered to vote
     */
    function getMyRegistrationStatus()
        public
        view
        override
        returns (bool isRegistered)
    {
        return s_voters[msg.sender].registrationTimestamp > 0;
    }

    /**
     * @notice Get an account's registration status
     * @dev Only callable by owner/admins
     * @param _voterAddress Address to check
     * @return isRegistered Whether they are registered to vote
     */
    function adminGetRegistrationStatus(
        address _voterAddress
    ) public view override onlyAdmin returns (bool isRegistered) {
        return s_voters[_voterAddress].registrationTimestamp > 0;
    }

    /**
     * @notice Get your own voting status
     * @return hasVoted Whether you have voted at least once
     */
    function getMyVotingStatus()
        public
        view
        override
        onlyRegistered(msg.sender)
        returns (bool hasVoted)
    {
        return s_voters[msg.sender].timesVoted > 0;
    }

    /**
     * @notice Get your current age based on stored date of birth
     * @return age Your current age in years
     */
    function getMyAge()
        public
        view
        onlyRegistered(msg.sender)
        returns (uint256 age)
    {
        return
            ElectionUtils.calculateAge(s_voters[msg.sender].dateOfBirthEpoch);
    }
}
