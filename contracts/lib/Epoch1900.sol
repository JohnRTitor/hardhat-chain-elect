// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.8;

/**
 * @title Epoch1900 Library
 * @author Custom Implementation
 * @notice Utility for timestamps starting from January 1, 1900
 * @dev Provides conversion between standard Unix epoch and Epoch1900
 */
library Epoch1900 {
    // Constant for the difference between Unix epoch (1970) and Epoch1900
    // 70 years = 70 * 365 + 17 leap days = 25567 days = 2208988800 seconds
    uint256 private constant EPOCH_OFFSET = 2208988800;
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant SECONDS_PER_LEAP_YEAR = 366 days;
    uint256 private constant SECONDS_PER_DAY = 24 hours;
    
    /**
     * @notice Convert Unix timestamp to Epoch1900 format
     * @param _unixTimestamp Standard Unix timestamp (seconds since 1970)
     * @return Epoch1900 timestamp (seconds since 1900)
     */
    function fromUnix(uint256 _unixTimestamp) internal pure returns (uint256) {
        return _unixTimestamp + EPOCH_OFFSET;
    }
    
    /**
     * @notice Convert Epoch1900 timestamp to Unix timestamp
     * @param _epoch1900 Epoch1900 timestamp (seconds since 1900)
     * @return Standard Unix timestamp (seconds since 1970)
     */
    function toUnix(uint256 _epoch1900) internal pure returns (uint256) {
        require(_epoch1900 >= EPOCH_OFFSET, "Epoch1900: Date before 1970 is not supported for conversion to Unix");
        return _epoch1900 - EPOCH_OFFSET;
    }
    
    /**
     * @notice Get current time in Epoch1900 format
     * @return Current time as Epoch1900 timestamp
     */
    function now1900() internal view returns (uint256) {
        return fromUnix(block.timestamp);
    }
    
    /**
     * @notice Calculate age based on Epoch1900 birth date
     * @param _birthDateEpoch1900 Birth date as Epoch1900 timestamp
     * @return Age in years
     */
    function calculateAge(uint256 _birthDateEpoch1900) internal view returns (uint256) {
        uint256 currentEpoch1900 = now1900();
        require(currentEpoch1900 >= _birthDateEpoch1900, "Epoch1900: Birth date is in the future");
        
        // Simple approximation: divide by seconds per year
        return (currentEpoch1900 - _birthDateEpoch1900) / SECONDS_PER_YEAR;
    }
    
    /**
     * @notice Check if a person is eligible based on minimum age
     * @param _birthDateEpoch1900 Birth date as Epoch1900 timestamp
     * @param _minEligibleAge Minimum eligible age
     * @return isEligible Whether the person meets minimum age requirements
     */
    function isEligible(uint256 _birthDateEpoch1900, uint256 _minEligibleAge) internal view returns (bool) {
        return calculateAge(_birthDateEpoch1900) >= _minEligibleAge;
    }
    
    /**
     * @notice Convert a date to Epoch1900 timestamp
     * @param _year Year (1900-9999)
     * @param _month Month (1-12)
     * @param _day Day (1-31)
     * @return Epoch1900 timestamp
     */
    function fromDate(uint16 _year, uint8 _month, uint8 _day) internal pure returns (uint256) {
        require(_year >= 1900, "Epoch1900: Year must be at least 1900");
        require(_month >= 1 && _month <= 12, "Epoch1900: Month must be between 1 and 12");
        require(_day >= 1 && _day <= 31, "Epoch1900: Day must be between 1 and 31");
        
        // Calculate days since 1900-01-01
        uint256 days_since_epoch = 0;
        
        // Add days for years
        for (uint16 y = 1900; y < _year; y++) {
            if (isLeapYear(y)) {
                days_since_epoch += 366;
            } else {
                days_since_epoch += 365;
            }
        }
        
        // Add days for months
        uint8[12] memory days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (isLeapYear(_year)) {
            days_in_month[1] = 29;  // February has 29 days in leap years
        }
        
        for (uint8 m = 1; m < _month; m++) {
            days_since_epoch += days_in_month[m - 1];
        }
        
        // Add days
        days_since_epoch += _day - 1; // -1 because we're starting from day 1, not day 0
        
        // Convert to seconds
        return days_since_epoch * SECONDS_PER_DAY;
    }
    
    /**
     * @notice Check if a year is a leap year
     * @param _year Year to check
     * @return True if leap year, false otherwise
     */
    function isLeapYear(uint16 _year) internal pure returns (bool) {
        if (_year % 400 == 0) return true;
        if (_year % 100 == 0) return false;
        if (_year % 4 == 0) return true;
        return false;
    }
}

/**
 * @title Epoch1900Type
 * @author Custom Implementation
 * @notice Type definition for Epoch1900 timestamps
 */
type Epoch1900Type is uint256;

/**
 * @title Epoch1900TypeLib
 * @author Custom Implementation
 * @notice Library for Epoch1900Type operations
 */
library Epoch1900TypeLib {
    // Constant for the difference between Unix epoch (1970) and Epoch1900
    uint256 private constant EPOCH_OFFSET = 2208988800;
    
    /**
     * @notice Wrap a uint256 into the Epoch1900Type
     * @param _value The uint256 value to wrap
     * @return The wrapped Epoch1900Type
     */
    function wrap(uint256 _value) internal pure returns (Epoch1900Type) {
        return Epoch1900Type.wrap(_value);
    }
    
    /**
     * @notice Unwrap an Epoch1900Type to a uint256
     * @param _value The Epoch1900Type to unwrap
     * @return The unwrapped uint256
     */
    function unwrap(Epoch1900Type _value) internal pure returns (uint256) {
        return Epoch1900Type.unwrap(_value);
    }
    
    /**
     * @notice Convert Unix timestamp to Epoch1900Type
     * @param _unixTimestamp Standard Unix timestamp
     * @return Epoch1900Type representation of the timestamp
     */
    function fromUnix(uint256 _unixTimestamp) internal pure returns (Epoch1900Type) {
        return wrap(_unixTimestamp + EPOCH_OFFSET);
    }
    
    /**
     * @notice Convert Epoch1900Type to Unix timestamp
     * @param _epoch1900 Epoch1900Type timestamp
     * @return Standard Unix timestamp
     */
    function toUnix(Epoch1900Type _epoch1900) internal pure returns (uint256) {
        uint256 value = unwrap(_epoch1900);
        require(value >= EPOCH_OFFSET, "Epoch1900: Date before 1970 is not supported for conversion to Unix");
        return value - EPOCH_OFFSET;
    }
    
    /**
     * @notice Get current time as Epoch1900Type
     * @return Current time as Epoch1900Type
     */
    function now1900() internal view returns (Epoch1900Type) {
        return fromUnix(block.timestamp);
    }
}