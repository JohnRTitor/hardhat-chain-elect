// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.8;

import {ICandidateDatabase} from "./interfaces/ICandidateDatabase.sol";
import {AdminManagement} from "./shared/AdminManagement.sol";

/**
 * @title CandidateDatabase Contract
 * @author Masum Reza
 * @notice This contract allows candidates to self-register and update their profiles.
 * @dev functions specifically prepended with admin may only be called by the contract owner or admins
 * @dev other functions are accessible to all users, except otherwise specified, see the provided modifier
 */

/// @notice Thrown when a candidate under the age of 18 tries to register
error CandidateDatabase__NotEligible();

/// @notice Thrown when a candidate attempts to register again after already being registered
error CandidateDatabase__AlreadyRegistered();

/// @notice Thrown when an unregistered candidate attempts a restricted action
error CandidateDatabase__NotRegistered();

/// @notice Thrown when import operations fail
error CandidateDatabase__ImportFailed();

/// @notice Thrown when an invalid address is provided
error CandidateDatabase__InvalidAddress();

contract CandidateDatabase is ICandidateDatabase, AdminManagement {
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant MIN_ELIGIBLE_AGE = 18;

    /// @notice Stores details for a single candidate
    struct Candidate {
        string name;
        uint256 dateOfBirthEpoch;
        Gender gender;
        string presentAddress;
        string email;
        string qualifications;
        string manifesto;
        uint256 timeWhenRegisteredEpoch;
        bool isRegistered;
    }

    mapping(address => Candidate) private s_candidates;
    address[] private s_candidateAddresses;

    /// @notice Functions with this modifier can only be called by registered candidates
    modifier onlyRegistered() {
        if (!s_candidates[msg.sender].isRegistered)
            revert CandidateDatabase__NotRegistered();
        _;
    }

    /// @notice Register a new candidate
    /// @param _name Name of the candidate
    /// @param _dateOfBirthEpoch Date of birth as Unix timestamp
    /// @param _gender Gender of the candidate (0 for Male, 1 for Female)
    /// @param _presentAddress Present address of the candidate
    /// @param _email Email address of the candidate
    /// @param _qualifications Educational qualifications of the candidate
    /// @param _manifesto Election manifesto of the candidate
    function addCandidate(
        string calldata _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string calldata _presentAddress,
        string calldata _email,
        string calldata _qualifications,
        string calldata _manifesto
    ) external override {
        // Calculate age - use constant for seconds in a year
        uint256 age = (block.timestamp - _dateOfBirthEpoch) / SECONDS_PER_YEAR;
        if (age < MIN_ELIGIBLE_AGE) revert CandidateDatabase__NotEligible();

        if (s_candidates[msg.sender].isRegistered)
            revert CandidateDatabase__AlreadyRegistered();

        s_candidates[msg.sender] = Candidate({
            name: _name,
            dateOfBirthEpoch: _dateOfBirthEpoch,
            gender: _gender,
            presentAddress: _presentAddress,
            email: _email,
            qualifications: _qualifications,
            manifesto: _manifesto,
            timeWhenRegisteredEpoch: block.timestamp,
            isRegistered: true
        });

        s_candidateAddresses.push(msg.sender);
        emit CandidateRegistered(msg.sender);
    }

    /// @notice Update candidate information
    /// @param _name Updated name
    /// @param _dateOfBirthEpoch Updated date of birth as Unix timestamp
    /// @param _gender Updated gender
    /// @param _presentAddress Updated address
    /// @param _email Updated email
    /// @param _qualifications Updated qualifications
    /// @param _manifesto Updated manifesto
    function updateCandidate(
        string calldata _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string calldata _presentAddress,
        string calldata _email,
        string calldata _qualifications,
        string calldata _manifesto
    ) external override onlyRegistered {
        // Verify age eligibility with the new DOB
        uint256 age = (block.timestamp - _dateOfBirthEpoch) / SECONDS_PER_YEAR;
        if (age < MIN_ELIGIBLE_AGE) revert CandidateDatabase__NotEligible();

        Candidate storage candidate = s_candidates[msg.sender];
        candidate.name = _name;
        candidate.dateOfBirthEpoch = _dateOfBirthEpoch;
        candidate.gender = _gender;
        candidate.presentAddress = _presentAddress;
        candidate.email = _email;
        candidate.qualifications = _qualifications;
        candidate.manifesto = _manifesto;

        emit CandidateUpdated(msg.sender);
    }

    /// @notice Allows a registered candidate to delete their own registration
    function deleteCandidate() external override onlyRegistered {
        address candidateAddress = msg.sender;

        // remove candidate from mapping
        delete s_candidates[candidateAddress];

        // swap candidate with last element and pop
        uint256 length = s_candidateAddresses.length;
        for (uint256 i = 0; i < length; ) {
            if (s_candidateAddresses[i] == candidateAddress) {
                s_candidateAddresses[i] = s_candidateAddresses[length - 1];
                s_candidateAddresses.pop();
                break;
            }
            unchecked {
                ++i;
            }
        }

        emit CandidateDeleted(candidateAddress);
    }

    /// @notice Admin function to add a candidate directly
    /// @dev Only owner/admins can call this function
    /// @param _candidateAddress Address of the candidate to add
    /// @param _name Name of the candidate
    /// @param _dateOfBirthEpoch Date of birth as Unix timestamp
    /// @param _gender Gender of the candidate
    /// @param _presentAddress Present address of the candidate
    /// @param _email Email of the candidate
    /// @param _qualifications Qualifications of the candidate
    /// @param _manifesto Manifesto of the candidate
    function adminAddCandidate(
        address _candidateAddress,
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    ) external override onlyAdmin {
        if (_candidateAddress == address(0))
            revert CandidateDatabase__InvalidAddress();

        // Calculate age using constant
        uint256 age = (block.timestamp - _dateOfBirthEpoch) / SECONDS_PER_YEAR;
        if (age < MIN_ELIGIBLE_AGE) revert CandidateDatabase__NotEligible();

        if (s_candidates[_candidateAddress].isRegistered)
            revert CandidateDatabase__AlreadyRegistered();

        s_candidates[_candidateAddress] = Candidate({
            name: _name,
            dateOfBirthEpoch: _dateOfBirthEpoch,
            gender: _gender,
            presentAddress: _presentAddress,
            email: _email,
            qualifications: _qualifications,
            manifesto: _manifesto,
            timeWhenRegisteredEpoch: block.timestamp,
            isRegistered: true
        });

        s_candidateAddresses.push(_candidateAddress);
        emit AdminAddedCandidate(_candidateAddress, msg.sender);
    }

    /// @notice Admin function to update candidate details
    /// @dev Only owner/admins can call this function
    /// @param _candidateAddress Address of the candidate to update
    /// @param _name Updated name
    /// @param _dateOfBirthEpoch Updated date of birth as Unix timestamp
    /// @param _gender Updated gender
    /// @param _presentAddress Updated present address
    /// @param _email Updated email
    /// @param _qualifications Updated qualifications
    /// @param _manifesto Updated manifesto
    function adminUpdateCandidate(
        address _candidateAddress,
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    ) external override onlyAdmin {
        if (!s_candidates[_candidateAddress].isRegistered)
            revert CandidateDatabase__NotRegistered();

        // Check age eligibility
        uint256 age = (block.timestamp - _dateOfBirthEpoch) / SECONDS_PER_YEAR;
        if (age < MIN_ELIGIBLE_AGE) revert CandidateDatabase__NotEligible();

        Candidate storage candidate = s_candidates[_candidateAddress];

        // Update details but preserve timeWhenRegisteredEpoch
        candidate.name = _name;
        candidate.dateOfBirthEpoch = _dateOfBirthEpoch;
        candidate.gender = _gender;
        candidate.presentAddress = _presentAddress;
        candidate.email = _email;
        candidate.qualifications = _qualifications;
        candidate.manifesto = _manifesto;

        emit AdminUpdatedCandidate(_candidateAddress, msg.sender);
    }

    /// @notice Admin function to remove a candidate
    /// @dev Only owner/admins can call this function
    /// @param _candidateAddress Address of the candidate to remove
    function adminRemoveCandidate(
        address _candidateAddress
    ) external override onlyAdmin {
        if (!s_candidates[_candidateAddress].isRegistered) {
            revert CandidateDatabase__NotRegistered();
        }

        // Remove candidate from mapping
        delete s_candidates[_candidateAddress];

        // Remove from the address array using swap and pop
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

        emit AdminRemovedCandidate(_candidateAddress, msg.sender);
    }

    /// @notice Import a specific candidate from another CandidateDatabase contract
    /// @dev Only owner/admins can call this function
    /// @param _sourceContract The address of the source CandidateDatabase contract
    /// @param _candidateAddress The address of the candidate to import
    function adminImportCandidate(
        address _sourceContract,
        address _candidateAddress
    ) external override onlyAdmin {
        // Skip if candidate is already registered in this contract
        if (s_candidates[_candidateAddress].isRegistered) {
            revert CandidateDatabase__AlreadyRegistered();
        }

        ICandidateDatabase source = ICandidateDatabase(_sourceContract);

        try source.getCandidateDetails(_candidateAddress) returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            Gender gender,
            string memory presentAddress,
            string memory email,
            string memory qualifications,
            string memory manifesto,
            uint256 timeWhenRegisteredEpoch
        ) {
            // Check age eligibility
            uint256 age = (block.timestamp - dateOfBirthEpoch) /
                SECONDS_PER_YEAR;
            if (age < MIN_ELIGIBLE_AGE) revert CandidateDatabase__NotEligible();

            // Add candidate to this contract
            s_candidates[_candidateAddress] = Candidate({
                name: name,
                dateOfBirthEpoch: dateOfBirthEpoch,
                gender: gender,
                presentAddress: presentAddress,
                email: email,
                qualifications: qualifications,
                manifesto: manifesto,
                timeWhenRegisteredEpoch: timeWhenRegisteredEpoch,
                isRegistered: true
            });

            s_candidateAddresses.push(_candidateAddress);
            emit CandidateRegistered(_candidateAddress);

            emit CandidatesImported(_sourceContract, 1);
        } catch {
            revert CandidateDatabase__ImportFailed();
        }
    }

    /// @notice Batch import selected candidates from another CandidateDatabase contract
    /// @dev Only owner/admins can call this function
    /// @param _sourceContract The address of the source CandidateDatabase contract
    /// @param _candidateAddresses Array of candidate addresses to import
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
            if (s_candidates[candidateAddress].isRegistered) {
                unchecked {
                    ++i;
                }
                continue;
            }

            try source.getCandidateDetails(candidateAddress) returns (
                string memory name,
                uint256 dateOfBirthEpoch,
                Gender gender,
                string memory presentAddress,
                string memory email,
                string memory qualifications,
                string memory manifesto,
                uint256 timeWhenRegisteredEpoch
            ) {
                // Check age eligibility
                uint256 age = (block.timestamp - dateOfBirthEpoch) /
                    SECONDS_PER_YEAR;
                if (age < MIN_ELIGIBLE_AGE) {
                    unchecked {
                        ++i;
                    }
                    continue; // Skip ineligible candidates
                }

                // Add candidate to this contract
                s_candidates[candidateAddress] = Candidate({
                    name: name,
                    dateOfBirthEpoch: dateOfBirthEpoch,
                    gender: gender,
                    presentAddress: presentAddress,
                    email: email,
                    qualifications: qualifications,
                    manifesto: manifesto,
                    timeWhenRegisteredEpoch: timeWhenRegisteredEpoch,
                    isRegistered: true
                });

                s_candidateAddresses.push(candidateAddress);
                emit CandidateRegistered(candidateAddress);
                unchecked {
                    ++importedCount;
                    ++i;
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

    /// @notice Import all candidates from another CandidateDatabase contract
    /// @dev Only owner/admins can call this function
    /// @param _sourceContract The address of the source CandidateDatabase contract
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
            if (s_candidates[candidateAddress].isRegistered) {
                unchecked {
                    ++i;
                }
                continue;
            }

            try source.getCandidateDetails(candidateAddress) returns (
                string memory name,
                uint256 dateOfBirthEpoch,
                Gender gender,
                string memory presentAddress,
                string memory email,
                string memory qualifications,
                string memory manifesto,
                uint256 timeWhenRegisteredEpoch
            ) {
                // Check age eligibility
                uint256 age = (block.timestamp - dateOfBirthEpoch) /
                    SECONDS_PER_YEAR;
                if (age < MIN_ELIGIBLE_AGE) {
                    unchecked {
                        ++i;
                    }
                    continue; // Skip ineligible candidates
                }

                // Add candidate to this contract
                s_candidates[candidateAddress] = Candidate({
                    name: name,
                    dateOfBirthEpoch: dateOfBirthEpoch,
                    gender: gender,
                    presentAddress: presentAddress,
                    email: email,
                    qualifications: qualifications,
                    manifesto: manifesto,
                    timeWhenRegisteredEpoch: timeWhenRegisteredEpoch,
                    isRegistered: true
                });

                s_candidateAddresses.push(candidateAddress);
                emit CandidateRegistered(candidateAddress);
                unchecked {
                    ++importedCount;
                    ++i;
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

    /// @notice Calculate age from date of birth
    /// @param _dateOfBirthEpoch Date of birth as Unix timestamp
    /// @return Age in years
    function calculateAge(
        uint256 _dateOfBirthEpoch
    ) public view returns (uint256) {
        return (block.timestamp - _dateOfBirthEpoch) / SECONDS_PER_YEAR;
    }

    /// @notice Get details of a specific candidate (publicly accessible)
    /// @param _candidateAddress Address of the candidate
    /// @return name The candidate's name
    /// @return dateOfBirthEpoch The candidate's date of birth as Unix timestamp
    /// @return gender The candidate's gender
    /// @return presentAddress The candidate's address
    /// @return email The candidate's email
    /// @return qualifications The candidate's qualifications
    /// @return manifesto The candidate's manifesto
    /// @return timeWhenRegisteredEpoch When the candidate registered
    function getCandidateDetails(
        address _candidateAddress
    )
        public
        view
        override
        returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            Gender gender,
            string memory presentAddress,
            string memory email,
            string memory qualifications,
            string memory manifesto,
            uint256 timeWhenRegisteredEpoch
        )
    {
        if (!s_candidates[_candidateAddress].isRegistered) {
            revert CandidateDatabase__NotRegistered();
        }
        Candidate memory candidate = s_candidates[_candidateAddress];
        return (
            candidate.name,
            candidate.dateOfBirthEpoch,
            candidate.gender,
            candidate.presentAddress,
            candidate.email,
            candidate.qualifications,
            candidate.manifesto,
            candidate.timeWhenRegisteredEpoch
        );
    }

    /// @notice Get the list of all registered candidate addresses (publicly accessible)
    /// @return Array of candidate wallet addresses
    function getAllCandidates()
        public
        view
        override
        returns (address[] memory)
    {
        return s_candidateAddresses;
    }

    /// @notice Get your own candidate details
    /// @return name Your name
    /// @return dateOfBirthEpoch Your date of birth as Unix timestamp
    /// @return gender Your gender
    /// @return presentAddress Your present address
    /// @return email Your email
    /// @return qualifications Your qualifications
    /// @return manifesto Your manifesto
    /// @return timeWhenRegisteredEpoch When you registered
    function getMyCandidateDetails()
        public
        view
        override
        onlyRegistered
        returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            Gender gender,
            string memory presentAddress,
            string memory email,
            string memory qualifications,
            string memory manifesto,
            uint256 timeWhenRegisteredEpoch
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
            candidate.timeWhenRegisteredEpoch
        );
    }

    /// @notice Get your own registration status
    /// @return isRegistered Whether you are registered as a candidate
    function getMyRegistrationStatus()
        public
        view
        override
        returns (bool isRegistered)
    {
        return s_candidates[msg.sender].isRegistered;
    }

    /// @notice Get a candidate's registration status
    /// @param _candidateAddress Address of the candidate
    /// @return isRegistered Whether the candidate is registered
    function getCandidateRegistrationStatus(
        address _candidateAddress
    ) public view override returns (bool isRegistered) {
        return s_candidates[_candidateAddress].isRegistered;
    }

    /// @notice Get number of registered candidates
    /// @return count The number of registered candidates
    function getCandidateCount() public view override returns (uint256 count) {
        return s_candidateAddresses.length;
    }

    /// @notice Get your current age based on stored date of birth
    /// @return Your current age in years
    function getMyAge() public view onlyRegistered returns (uint256) {
        return calculateAge(s_candidates[msg.sender].dateOfBirthEpoch);
    }
}
