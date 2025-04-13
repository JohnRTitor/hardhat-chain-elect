// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

interface ICandidateDatabase {
    function getAllCandidates() external view returns (address[] memory);

    function getMyCandidateDetails()
        external
        view
        returns (string memory name, uint256 age, string memory email);

    function getMyRegistrationStatus()
        external
        view
        returns (bool isRegistered);

    function getCandidateRegistrationStatus(
        address _candidateAddress
    ) external view returns (bool isRegistered);
}
