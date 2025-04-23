// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

/// @title IVoterDatabase
/// @notice Interface for interacting with the VoterDatabase contract
interface IVoterDatabase {
    enum Gender {
        Male,
        Female
    }

    /// @notice Get all registered voters
    /// @return voters Array of registered voter addresses
    function getAllVoters() external view returns (address[] memory voters);

    /// @notice Get details of a specific voter
    /// @param _voterAddress Address of the voter
    /// @return name Voter's full name
    /// @return age Voter's age
    /// @return gender Gender enum (0 = Male, 1 = Female)
    /// @return presentAddress Current address of residence
    /// @return hasVoted Voting status
    function getVoterDetails(
        address _voterAddress
    )
        external
        view
        returns (
            string memory name,
            uint256 age,
            Gender gender,
            string memory presentAddress,
            bool hasVoted
        );

    /// @notice Check if the caller is registered
    /// @return isRegistered True if registered
    function getMyRegistrationStatus()
        external
        view
        returns (bool isRegistered);

    /// @notice Get the voting status of the caller
    /// @return hasVoted True if the caller has already voted
    function getMyVotingStatus() external view returns (bool hasVoted);

    /// @notice Mark a specific voter as having voted
    /// @param _voter Address of the voter
    function markVoted(address _voter) external;
}
