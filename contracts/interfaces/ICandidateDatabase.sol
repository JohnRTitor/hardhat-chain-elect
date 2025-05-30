// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.8;

/**
 * @title ICandidateDatabase Interface
 * @author Based on CandidateDatabase by Masum Reza
 * @notice Interface for the CandidateDatabase contract
 * @dev Defines the external functions for interaction with the CandidateDatabase contract
 */

interface ICandidateDatabase {
    /// @notice Enum representing gender
    enum Gender {
        Male,
        Female
    }

    /// @notice Emitted when a new candidate is registered
    /// @param candidate The address of the newly registered candidate
    event CandidateRegistered(address indexed candidate);

    /// @notice Emitted when a candidate updates their profile
    /// @param candidate The address of the updated candidate
    event CandidateUpdated(address indexed candidate);

    /// @notice Emitted when a candidate is deleted/unregistered
    /// @param candidate The address of the deleted candidate
    event CandidateDeleted(address indexed candidate);

    /// @notice Emitted when candidate data is imported
    /// @param sourceContract Address of the contract data was imported from
    /// @param candidatesImported Number of candidates successfully imported
    event CandidatesImported(
        address indexed sourceContract,
        uint256 candidatesImported
    );

    /// @notice Emitted when admin adds a candidate
    /// @param candidate The address of the candidate added by admin
    /// @param admin The admin who added the candidate
    event AdminAddedCandidate(address indexed candidate, address indexed admin);

    /// @notice Emitted when admin updates a candidate
    /// @param candidate The address of the candidate updated by admin
    /// @param admin The admin who updated the candidate
    event AdminUpdatedCandidate(
        address indexed candidate,
        address indexed admin
    );

    /// @notice Emitted when admin removes a candidate
    /// @param candidate The address of the candidate removed by admin
    /// @param admin The admin who removed the candidate
    event AdminRemovedCandidate(
        address indexed candidate,
        address indexed admin
    );

    /// @notice Register yourself as a candidate
    /// @param _name Candidate's full name
    /// @param _dateOfBirthEpoch Candidate's date of birth as Unix timestamp
    /// @param _gender Candidate's gender (0 for Male, 1 for Female)
    /// @param _presentAddress Candidate's present address
    /// @param _email Candidate's email address
    /// @param _qualifications Candidate's educational qualifications
    /// @param _manifesto Candidate's election manifesto or platform
    function addCandidate(
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    ) external;

    /// @notice Update your candidate profile
    /// @param _name Updated name
    /// @param _dateOfBirthEpoch Updated date of birth as Unix timestamp
    /// @param _gender Updated gender
    /// @param _presentAddress Updated present address
    /// @param _email Updated email address
    /// @param _qualifications Updated qualifications
    /// @param _manifesto Updated manifesto
    function updateCandidate(
        string memory _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string memory _presentAddress,
        string memory _email,
        string memory _qualifications,
        string memory _manifesto
    ) external;

    /// @notice Allows a registered candidate to delete their own registration
    function deleteCandidate() external;

    /// @notice Admin function to add a candidate directly
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
    ) external;

    /// @notice Admin function to update candidate details
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
    ) external;

    /// @notice Admin function to remove a candidate
    /// @param _candidateAddress Address of the candidate to remove
    function adminRemoveCandidate(address _candidateAddress) external;

    /// @notice Import a specific candidate from another CandidateDatabase contract
    /// @param _sourceContract The address of the source CandidateDatabase contract
    /// @param _candidateAddress The address of the candidate to import
    function adminImportCandidate(
        address _sourceContract,
        address _candidateAddress
    ) external;

    /// @notice Batch import selected candidates from another CandidateDatabase contract
    /// @param _sourceContract The address of the source CandidateDatabase contract
    /// @param _candidateAddresses Array of candidate addresses to import
    function adminBatchImportCandidates(
        address _sourceContract,
        address[] calldata _candidateAddresses
    ) external;

    /// @notice Import all candidates from another CandidateDatabase contract
    /// @param _sourceContract The address of the source CandidateDatabase contract
    function adminImportAllCandidates(address _sourceContract) external;

    /// @notice Get full details of a specific candidate
    /// @param _candidateAddress Address of the candidate
    /// @return name The name of the candidate
    /// @return dateOfBirthEpoch The date of birth of the candidate as Unix timestamp
    /// @return gender The gender of the candidate
    /// @return presentAddress The present address of the candidate
    /// @return email The email address of the candidate
    /// @return qualifications The qualifications of the candidate
    /// @return manifesto The election manifesto of the candidate
    /// @return registrationTimestamp When the candidate registered
    function getCandidateDetails(
        address _candidateAddress
    )
        external
        view
        returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            Gender gender,
            string memory presentAddress,
            string memory email,
            string memory qualifications,
            string memory manifesto,
            uint256 registrationTimestamp
        );

    /// @notice Get the list of all registered candidate addresses
    /// @return Array of candidate wallet addresses
    function getAllCandidates() external view returns (address[] memory);

    /// @notice Get your full candidate details
    /// @return name Your name
    /// @return dateOfBirthEpoch Your date of birth as Unix timestamp
    /// @return gender Your gender
    /// @return presentAddress Your present address
    /// @return email Your email
    /// @return qualifications Your qualifications
    /// @return manifesto Your election manifesto
    /// @return registrationTimestamp When you registered
    function getMyDetails()
        external
        view
        returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            Gender gender,
            string memory presentAddress,
            string memory email,
            string memory qualifications,
            string memory manifesto,
            uint256 registrationTimestamp
        );

    /// @notice Get your own registration status
    /// @return isRegistered Whether you are registered as a candidate
    function getMyRegistrationStatus()
        external
        view
        returns (bool isRegistered);

    /// @notice Get a candidate's registration status
    /// @param _candidateAddress Address of the candidate
    /// @return isRegistered Whether the candidate is registered
    function getCandidateRegistrationStatus(
        address _candidateAddress
    ) external view returns (bool isRegistered);

    /// @notice Get number of registered candidates
    /// @return count The number of registered candidates
    function getCandidateCount() external view returns (uint256 count);
}
