// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.8;

/**
 * @title Library for utility functions for Election and related databases
 * @author Masum Reza
 */
library ElectionUtils {
    uint256 private constant SECONDS_PER_YEAR = 365 days;

    /**
     * @notice Calculate age from date of birth
     * @param _dateOfBirthEpoch Date of birth as Unix timestamp
     * @return Age in years
     */
    function calculateAge(
        uint256 _dateOfBirthEpoch
    ) internal view returns (uint256) {
        return (block.timestamp - _dateOfBirthEpoch) / SECONDS_PER_YEAR;
    }

    /**
     * @notice Check if a person is eligible to vote based on minimum age
     * @param _dateOfBirthEpoch Date of birth as Unix timestamp
     * @param _minEligibleAge Minimum eligible age
     * @return isEligible Whether the person meets minimum age requirements
     */
    function isEligible(
        uint256 _dateOfBirthEpoch,
        uint256 _minEligibleAge
    ) internal view returns (bool) {
        return calculateAge(_dateOfBirthEpoch) >= _minEligibleAge;
    }
}
