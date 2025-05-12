// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.8;

import {Epoch1900} from "./Epoch1900.sol";
import {Epoch1900Type, Epoch1900TypeLib} from "./Epoch1900.sol";

/**
 * @title Library for utility functions for Election and related databases
 * @author Masum Reza (updated with Epoch1900)
 */
library ElectionUtils {
    /**
     * @notice Calculate age from date of birth using Epoch1900 format
     * @param _dateOfBirthEpoch1900 Date of birth as Epoch1900 timestamp
     * @return Age in years
     */
    function calculateAge(
        uint256 _dateOfBirthEpoch1900
    ) internal view returns (uint256) {
        return Epoch1900.calculateAge(_dateOfBirthEpoch1900);
    }

    /**
     * @notice Check if a person is eligible to vote based on minimum age
     * @param _dateOfBirthEpoch1900 Date of birth as Epoch1900 timestamp
     * @param _minEligibleAge Minimum eligible age
     * @return isEligible Whether the person meets minimum age requirements
     */
    function isEligible(
        uint256 _dateOfBirthEpoch1900,
        uint256 _minEligibleAge
    ) internal view returns (bool) {
        return Epoch1900.isEligible(_dateOfBirthEpoch1900, _minEligibleAge);
    }
    
    /**
     * @notice Convert existing Unix timestamp to Epoch1900 format
     * @param _unixTimestamp Standard Unix timestamp
     * @return Timestamp in Epoch1900 format
     */
    function toEpoch1900(
        uint256 _unixTimestamp
    ) internal pure returns (uint256) {
        return Epoch1900.fromUnix(_unixTimestamp);
    }
    
    /**
     * @notice Convert Epoch1900 timestamp to Unix timestamp
     * @param _epoch1900 Timestamp in Epoch1900 format
     * @return Standard Unix timestamp
     */
    function toUnixEpoch(
        uint256 _epoch1900
    ) internal pure returns (uint256) {
        return Epoch1900.toUnix(_epoch1900);
    }
    
    /**
     * @notice Get current time in Epoch1900 format
     * @return Current time as Epoch1900 timestamp
     */
    function getNowEpoch1900() internal view returns (uint256) {
        return Epoch1900.now1900();
    }
}
