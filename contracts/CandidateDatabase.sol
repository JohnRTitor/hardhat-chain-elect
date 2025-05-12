// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.8;

import {ICandidateDatabase} from "./interfaces/ICandidateDatabase.sol";
import {AdminManagement} from "./shared/AdminManagement.sol";
import {ElectionUtils} from "./lib/ElectionUtils.sol";

/**
 * @title CandidateDatabase Contract
 * @author Masum Reza
 * @notice This contract manages candidate registration and profiles for an electronic voting system
 * @dev This contract implements:
 *      - Self-registration management for candidates
 *      - Admin functions for candidate management
 *      - Importing functionality from other candidate databases
 */

/// @notice Thrown when a candidate under the age of 18 attempts to register
error CandidateDatabase__NotEligible();

/// @notice Thrown when a non-registered candidate tries to perform a restricted action
error CandidateDatabase__NotRegistered();

/// @notice Thrown when a candidate tries to register again
error CandidateDatabase__AlreadyRegistered();

/// @notice Thrown when import operations fail
error CandidateDatabase__ImportFailed();

/// @notice Thrown when an invalid address is provided
error CandidateDatabase__InvalidAddress();

contract CandidateDatabase is ICandidateDatabase, AdminManagement {
    uint256 private constant MIN_ELIGIBLE_AGE = 18;

    /**
     * @notice Stores details for a single candidate
     * @dev The registrationTimestamp serves as both a timestamp and a registration flag
     *    - If > 0, candidate is registered
     */
    struct Candidate {
        string name;
        string presentAddress;
        string email;
        string qualifications;
        string manifesto;
        Gender gender;
        uint256 dateOfBirthEpoch1900; // Date of birth in Epoch1900 format
        uint256 registrationTimestamp1900; // Registration time in Epoch1900 format
    }

    /// @dev Main storage for candidate information
    mapping(address => Candidate) private s_candidates;

    /// @dev Array of all registered candidate addresses for enumeration
    address[] private s_candidateAddresses;

    /**
     * @notice Ensures the candidate meets minimum age requirements
     * @param _dateOfBirthEpoch1900 Date of birth as Epoch1900 timestamp
     */
    modifier onlyEligible(uint256 _dateOfBirthEpoch1900) {
        if (ElectionUtils.calculateAge(_dateOfBirthEpoch1900) < MIN_ELIGIBLE_AGE)
            revert CandidateDatabase__NotEligible();
        _;
    }

    /**
     * @notice Ensures the address belongs to a registered candidate
     * @param _candidateAddress Address to check for registration
     */
    modifier onlyRegistered(address _candidateAddress) {
        if (s_candidates[_candidateAddress].registrationTimestamp1900 == 0)
            revert CandidateDatabase__NotRegistered();
        _;
    }

    /**
     * @notice Ensures the address does not belong to an already registered candidate
     * @param _candidateAddress Address to check for registration
     */
    modifier onlyNotRegistered(address _candidateAddress) {
        if (s_candidates[_candidateAddress].registrationTimestamp1900 > 0)
            revert CandidateDatabase__AlreadyRegistered();
        _;
    }

    /**
     * @notice Ensures the provided address is not the zero address
     * @param _candidateAddress Address to validate
     */
    modifier onlyValidAddress(address _candidateAddress) {
        if (_candidateAddress == address(0))
            revert CandidateDatabase__InvalidAddress();
        _;
    }

    /**
     * @notice Internal function to add a new candidate to the database
     * @dev Used by both self-registration and admin functions
     * @param _candidateAddress Address of the candidate to add
     * @param _name Name of the candidate
     * @param _dateOfBirthEpoch1900 Date of birth as Epoch1900 timestamp
     * @param _gender Gender of the candidate
     * @param _presentAddress Present address of the candidate
     * @param _email Email address of the candidate
     * @param _qualifications Educational qualifications of the candidate
     * @param _manifesto Election manifesto of the candidate
     */
    function _addCandidate(
        address _candidateAddress,
        string memory _name,
        uint256 _dateOfBirthEpoch1900,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    )
        internal
        onlyEligible(_dateOfBirthEpoch1900)
        onlyNotRegistered(_candidateAddress)
    {
        s_candidates[_candidateAddress] = Candidate({
            name: _name,
            dateOfBirthEpoch1900: _dateOfBirthEpoch1900,
            gender: _gender,
            presentAddress: _presentAddress,
            email: _email,
            qualifications: _qualifications,
            manifesto: _manifesto,
            registrationTimestamp1900: ElectionUtils.getNowEpoch1900()
        });

        s_candidateAddresses.push(_candidateAddress);
    }

    /**
     * @notice Internal function to update candidate details
     * @dev Used by both self-update and admin functions
     * @param _candidateAddress Address of the candidate to update
     * @param _name Updated name
     * @param _dateOfBirthEpoch1900 Updated date of birth as Epoch1900 timestamp
     * @param _gender Updated gender
     * @param _presentAddress Updated present address
     * @param _email Updated email address
     * @param _qualifications Updated qualifications
     * @param _manifesto Updated manifesto
     */
    function _updateCandidate(
        address _candidateAddress,
        string memory _name,
        uint256 _dateOfBirthEpoch1900,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    )
        internal
        onlyEligible(_dateOfBirthEpoch1900)
        onlyRegistered(_candidateAddress)
    {
        Candidate storage candidate = s_candidates[_candidateAddress];

        // Update details but preserve registrationTimestamp1900
        candidate.name = _name;
        candidate.dateOfBirthEpoch1900 = _dateOfBirthEpoch1900;
        candidate.gender = _gender;
        candidate.presentAddress = _presentAddress;
        candidate.email = _email;
        candidate.qualifications = _qualifications;
        candidate.manifesto = _manifesto;
    }

    /**
     * @notice Internal function to remove a candidate from the database
     * @dev Removes from mapping and updates the address array for enumeration
     * @param _candidateAddress Address of the candidate to remove
     */
    function _deleteCandidate(
        address _candidateAddress
    ) internal onlyRegistered(_candidateAddress) {
        // remove candidate from mapping
        delete s_candidates[_candidateAddress];

        // swap candidate with last element and pop
        uint256 length = s_candidateAddresses.length;
        for (uint256 i = 0; i < length; ) {
            if (s_candidateAddresses[i] == _candidateAddress) {
                s_candidateAddresses[i] = s_candidateAddresses[length - 1];
                s_candidateAddresses.pop();
                break;
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Register a new candidate in the system
     * @dev Self-registration function for candidates
     * @param _name Name of the candidate
     * @param _dateOfBirthEpoch Date of birth as Unix timestamp
     * @param _gender Gender of the candidate (0 for Male, 1 for Female)
     * @param _presentAddress Present address of the candidate
     * @param _email Email address of the candidate
     * @param _qualifications Educational qualifications of the candidate
     * @param _manifesto Election manifesto of the candidate
     */
    function addCandidate(
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    ) external override {
        _addCandidate(
            msg.sender,
            _name,
            _dateOfBirthEpoch,
            _gender,
            _presentAddress,
            _email,
            _qualifications,
            _manifesto
        );
        emit CandidateRegistered(msg.sender);
    }

    /**
     * @notice Update candidate information
     * @dev Self-update function for registered candidates
     * @param _name Updated name
     * @param _dateOfBirthEpoch Updated date of birth as Unix timestamp
     * @param _gender Updated gender
     * @param _presentAddress Updated address
     * @param _email Updated email
     * @param _qualifications Updated qualifications
     * @param _manifesto Updated manifesto
     */
    function updateCandidate(
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    ) external override {
        _updateCandidate(
            msg.sender,
            _name,
            _dateOfBirthEpoch,
            _gender,
            _presentAddress,
            _email,
            _qualifications,
            _manifesto
        );
        emit CandidateUpdated(msg.sender);
    }

    /**
     * @notice Allows a registered candidate to delete their own registration
     * @dev Self-removal function for registered candidates
     */
    function deleteCandidate() external override {
        _deleteCandidate(msg.sender);
        emit CandidateDeleted(msg.sender);
    }

    /**
     * @notice Admin function to add a candidate directly
     * @dev Only owner/admins can call this function
     * @param _candidateAddress Address of the candidate to add
     * @param _name Name of the candidate
     * @param _dateOfBirthEpoch Date of birth as Unix timestamp
     * @param _gender Gender of the candidate
     * @param _presentAddress Present address of the candidate
     * @param _email Email address of the candidate
     * @param _qualifications Educational qualifications of the candidate
     * @param _manifesto Election manifesto of the candidate
     */
    function adminAddCandidate(
        address _candidateAddress,
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    ) external override onlyAdmin onlyValidAddress(_candidateAddress) {
        _addCandidate(
            _candidateAddress,
            _name,
            _dateOfBirthEpoch,
            _gender,
            _presentAddress,
            _email,
            _qualifications,
            _manifesto
        );
        emit AdminAddedCandidate(_candidateAddress, msg.sender);
    }

    /**
     * @notice Admin function to update candidate details
     * @dev Only owner/admins can call this function
     * @param _candidateAddress Address of the candidate to update
     * @param _name Updated name
     * @param _dateOfBirthEpoch Updated date of birth as Unix timestamp
     * @param _gender Updated gender
     * @param _presentAddress Updated present address
     * @param _email Updated email address
     * @param _qualifications Updated qualifications
     * @param _manifesto Updated manifesto
     */
    function adminUpdateCandidate(
        address _candidateAddress,
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    ) external override onlyAdmin onlyValidAddress(_candidateAddress) {
        _updateCandidate(
            _candidateAddress,
            _name,
            _dateOfBirthEpoch,
            _gender,
            _presentAddress,
            _email,
            _qualifications,
            _manifesto
        );
        emit AdminUpdatedCandidate(_candidateAddress, msg.sender);
    }

    /**
     * @notice Admin function to remove a candidate
     * @dev Only owner/admins can call this function
     * @param _candidateAddress Address of the candidate to remove
     */
    function adminRemoveCandidate(
        address _candidateAddress
    ) external override onlyAdmin onlyValidAddress(_candidateAddress) {
        _deleteCandidate(_candidateAddress);
        emit AdminRemovedCandidate(_candidateAddress, msg.sender);
    }

    /**
     * @notice Import a specific candidate from another CandidateDatabase contract
     * @dev Only owner/admins can call this function
     * @param _sourceContract The address of the source CandidateDatabase contract
     * @param _candidateAddress The address of the candidate to import
     */
    function adminImportCandidate(
        address _sourceContract,
        address _candidateAddress
    ) external override onlyAdmin onlyNotRegistered(_candidateAddress) {
        ICandidateDatabase source = ICandidateDatabase(_sourceContract);

        try source.getCandidateDetails(_candidateAddress) returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            ICandidateDatabase.Gender gender,
            string memory presentAddress,
            string memory email,
            string memory qualifications,
            string memory manifesto,
            uint256 /* registrationTimestamp */
        ) {
            _addCandidate(
                _candidateAddress,
                name,
                dateOfBirthEpoch,
                gender,
                presentAddress,
                email,
                qualifications,
                manifesto
            );

            emit AdminAddedCandidate(_candidateAddress, msg.sender);
            emit CandidatesImported(_sourceContract, 1);
        } catch {
            revert CandidateDatabase__ImportFailed();
        }
    }

    /**
     * @notice Batch import selected candidates from another CandidateDatabase contract
     * @dev Only owner/admins can call this function
     * @param _sourceContract The address of the source CandidateDatabase contract
     * @param _candidateAddresses Array of candidate addresses to import
     */
    function adminBatchImportCandidates(
        address _sourceContract,
        address[] calldata _candidateAddresses
    ) external override onlyAdmin {
        ICandidateDatabase source = ICandidateDatabase(_sourceContract);
        uint256 importedCount = 0;

        uint256 length = _candidateAddresses.length;
        for (uint256 i = 0; i < length; ) {
            address candidateAddress = _candidateAddresses[i];

            // Skip if candidate is already registered
            if (s_candidates[candidateAddress].registrationTimestamp > 0) {
                unchecked {
                    ++i;
                }
                continue;
            }

            try source.getCandidateDetails(candidateAddress) returns (
                string memory name,
                uint256 dateOfBirthEpoch,
                ICandidateDatabase.Gender gender,
                string memory presentAddress,
                string memory email,
                string memory qualifications,
                string memory manifesto,
                uint256 /* registrationTimestamp */
            ) {
                _addCandidate(
                    candidateAddress,
                    name,
                    dateOfBirthEpoch,
                    gender,
                    presentAddress,
                    email,
                    qualifications,
                    manifesto
                );

                emit AdminAddedCandidate(candidateAddress, msg.sender);

                unchecked {
                    ++i;
                    ++importedCount;
                }
            } catch {
                // Continue to next candidate if this one fails
                unchecked {
                    ++i;
                }
                continue;
            }
        }

        emit CandidatesImported(_sourceContract, importedCount);
    }

    /**
     * @notice Import all candidates from another CandidateDatabase contract
     * @dev Only owner/admins can call this function
     * @param _sourceContract The address of the source CandidateDatabase contract
     */
    function adminImportAllCandidates(
        address _sourceContract
    ) external override onlyAdmin {
        ICandidateDatabase source = ICandidateDatabase(_sourceContract);
        address[] memory candidates;

        // Use try/catch to handle potential errors from external calls
        try source.getAllCandidates() returns (address[] memory _candidates) {
            candidates = _candidates;
        } catch {
            revert CandidateDatabase__ImportFailed();
        }

        uint256 importedCount = 0;

        uint256 length = candidates.length;
        for (uint256 i = 0; i < length; ) {
            address candidateAddress = candidates[i];

            // Skip if candidate is already registered in this contract
            if (s_candidates[candidateAddress].registrationTimestamp > 0) {
                unchecked {
                    ++i;
                }
                continue;
            }

            try source.getCandidateDetails(candidateAddress) returns (
                string memory name,
                uint256 dateOfBirthEpoch,
                ICandidateDatabase.Gender gender,
                string memory presentAddress,
                string memory email,
                string memory qualifications,
                string memory manifesto,
                uint256 /* registrationTimestamp */
            ) {
                _addCandidate(
                    candidateAddress,
                    name,
                    dateOfBirthEpoch,
                    gender,
                    presentAddress,
                    email,
                    qualifications,
                    manifesto
                );

                emit AdminAddedCandidate(candidateAddress, msg.sender);
                unchecked {
                    ++i;
                    ++importedCount;
                }
            } catch {
                // Continue to next candidate if this one fails
                unchecked {
                    ++i;
                }
                continue;
            }
        }

        emit CandidatesImported(_sourceContract, importedCount);
    }

    /**
     * @notice Get details of a specific candidate (publicly accessible)
     * @param _candidateAddress Address of the candidate
     * @return name The candidate's name
     * @return dateOfBirthEpoch1900 The candidate's date of birth as Epoch1900 timestamp
     * @return gender The candidate's gender
     * @return presentAddress The candidate's address
     * @return email The candidate's email
     * @return qualifications The candidate's qualifications
     * @return manifesto The candidate's manifesto
     * @return registrationTimestamp1900 When the candidate registered (Epoch1900)
     */
    function getCandidateDetails(
        address _candidateAddress
    )
        external
        view
        override
        onlyRegistered(_candidateAddress)
        returns (
            string memory name,
            uint256 dateOfBirthEpoch1900,
            Gender gender,
            string memory presentAddress,
            string memory email,
            string memory qualifications,
            string memory manifesto,
            uint256 registrationTimestamp1900
        )
    {
        Candidate memory candidate = s_candidates[_candidateAddress];
        return (
            candidate.name,
            candidate.dateOfBirthEpoch1900,
            candidate.gender,
            candidate.presentAddress,
            candidate.email,
            candidate.qualifications,
            candidate.manifesto,
            candidate.registrationTimestamp1900
        );
    }

    /**
     * @notice Get your own candidate details
     * @return name Your name
     * @return dateOfBirthEpoch Your date of birth as Unix timestamp
     * @return gender Your gender
     * @return presentAddress Your present address
     * @return email Your email
     * @return qualifications Your qualifications
     * @return manifesto Your manifesto
     * @return registrationTimestamp When you registered
     */
    function getMyDetails()
        external
        view
        override
        onlyRegistered(msg.sender)
        returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            Gender gender,
            string memory presentAddress,
            string memory email,
            string memory qualifications,
            string memory manifesto,
            uint256 registrationTimestamp
        )
    {
        Candidate memory candidate = s_candidates[msg.sender];
        return (
            candidate.name,
            candidate.dateOfBirthEpoch,
            candidate.gender,
            candidate.presentAddress,
            candidate.email,
            candidate.qualifications,
            candidate.manifesto,
            candidate.registrationTimestamp
        );
    }

    /**
     * @notice Get the list of all registered candidate addresses (publicly accessible)
     * @return List of all candidate addresses
     */
    function getAllCandidates()
        external
        view
        override
        returns (address[] memory)
    {
        return s_candidateAddresses;
    }

    /**
     * @notice Get the total number of registered candidates
     * @return count The count of registered candidates
     */
    function getCandidateCount()
        external
        view
        override
        returns (uint256 count)
    {
        return s_candidateAddresses.length;
    }

    /**
     * @notice Get your own registration status
     * @return isRegistered Whether you are registered as a candidate
     */
    function getMyRegistrationStatus()
        external
        view
        override
        returns (bool isRegistered)
    {
        return s_candidates[msg.sender].registrationTimestamp > 0;
    }

    /**
     * @notice Get a candidate's registration status
     * @param _candidateAddress Address of the candidate
     * @return isRegistered Whether the candidate is registered
     */
    function getCandidateRegistrationStatus(
        address _candidateAddress
    ) external view override returns (bool isRegistered) {
        return s_candidates[_candidateAddress].registrationTimestamp > 0;
    }

    /**
     * @notice Get your current age based on stored date of birth
     * @return age Your current age in years
     */
    function getMyAge()
        external
        view
        onlyRegistered(msg.sender)
        returns (uint256 age)
    {
        return
            ElectionUtils.calculateAge(
                s_candidates[msg.sender].dateOfBirthEpoch
            );
    }
}
