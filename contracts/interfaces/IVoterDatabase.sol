// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

interface IVoterDatabase {
    function markVoted(address _voter) external;

    function getVoterDetails(
        address _voterAddress
    ) external view returns (string memory name, uint256 age, bool hasVoted);

    function getMyRegistrationStatus() external view returns (bool);

    function getMyVotingStatus() external view returns (bool);
}
