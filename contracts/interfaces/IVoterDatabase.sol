// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.8;

/**
 * @title IVoterDatabase Interface
 * @author Based on VoterDatabase by Masum Reza
 * @notice Interface for the VoterDatabase contract
 * @dev Defines the external functions for interaction with the VoterDatabase contract
 */

interface IVoterDatabase {
    /// @notice Enum representing gender
    enum Gender {
        Male,
        Female
    }

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

    /// @notice Register a new voter
    /// @param _name Name of the voter
    /// @param _dateOfBirthEpoch Date of birth as Unix timestamp
    /// @param _gender Gender of the voter (0 for Male, 1 for Female)
    /// @param _presentAddress Present address of the voter
    function addVoter(
        string calldata _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string calldata _presentAddress
    ) external;

    /// @notice Update voter information (only if registered and not yet voted)
    /// @param _name Updated name
    /// @param _dateOfBirthEpoch Updated date of birth as Unix timestamp
    /// @param _gender Updated gender
    /// @param _presentAddress Updated address
    function updateVoter(
        string calldata _name,
        uint256 _dateOfBirthEpoch,
        Gender _gender,
        string calldata _presentAddress
    ) external;

    /// @notice Allows a registered voter to delete their own registration
    function deleteVoter() external;

    /// @notice Mark a voter as having voted
    function markVoted() external;

    /// @notice Admin function to add a voter directly
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
    ) external;

    /// @notice Admin function to update voter details
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
    ) external;

    /// @notice Admin function to remove a voter
    /// @param _voterAddress Address of the voter to remove
    function adminRemoveVoter(address _voterAddress) external;

    /// @notice Admin function to toggle a voter's voting status
    /// @param _voterAddress Address of the voter
    /// @param _hasVoted New voting status to set
    function adminSetVotingStatus(
        address _voterAddress,
        bool _hasVoted
    ) external;

    /// @notice Import a specific voter from another VoterDatabase contract
    /// @param _sourceContract The address of the source VoterDatabase contract
    /// @param _voterAddress The address of the voter to import
    function adminImportVoter(
        address _sourceContract,
        address _voterAddress
    ) external;

    /// @notice Batch import selected voters from another VoterDatabase contract
    /// @param _sourceContract The address of the source VoterDatabase contract
    /// @param _voterAddresses Array of voter addresses to import
    function adminBatchImportVoters(
        address _sourceContract,
        address[] calldata _voterAddresses
    ) external;

    /// @notice Import all voters from another VoterDatabase contract
    /// @param _sourceContract The address of the source VoterDatabase contract
    function adminImportAllVoters(address _sourceContract) external;

    /// @notice Get details of a specific voter
    /// @param _voterAddress Address of the voter
    /// @return name The voter's name
    /// @return dateOfBirthEpoch The voter's date of birth as Unix timestamp
    /// @return gender The voter's gender
    /// @return presentAddress The voter's address
    /// @return hasVoted Whether the voter has cast their vote
    /// @return timeWhenRegisteredEpoch When the voter registered as Unix timestamp
    function adminGetVoterDetails(
        address _voterAddress
    )
        external
        view
        returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            Gender gender,
            string memory presentAddress,
            bool hasVoted,
            uint256 timeWhenRegisteredEpoch
        );

    /// @notice Get the total number of registered voters
    /// @return The count of registered voters
    function adminGetVoterCount() external view returns (uint256);

    /// @notice Get addresses of all registered voters
    /// @return Array of addresses of all registered voters
    function adminGetAllVoters() external view returns (address[] memory);

    /// @notice Get your own voter details
    /// @return name Your name
    /// @return dateOfBirthEpoch Your date of birth as Unix timestamp
    /// @return gender Your gender
    /// @return presentAddress Your present address
    /// @return hasVoted Whether you have voted
    function getMyDetails()
        external
        view
        returns (
            string memory name,
            uint256 dateOfBirthEpoch,
            Gender gender,
            string memory presentAddress,
            bool hasVoted
        );

    /// @notice Get your own registration status
    /// @return isRegistered Whether you are registered to vote
    function getMyRegistrationStatus()
        external
        view
        returns (bool isRegistered);

    /// @notice Get your own voting status
    /// @return hasVoted Whether you have voted
    function getMyVotingStatus() external view returns (bool hasVoted);
}
