/**
 * Epoch1900 TypeScript Utilities
 * 
 * This module provides utilities for working with Epoch1900 timestamps
 * in TypeScript, particularly for use in tests.
 */

// The offset between Unix epoch (1970-01-01) and Epoch1900 (1900-01-01)
// 70 years = 70 * 365 + 17 leap days = 25567 days = 2208988800 seconds
const EPOCH_OFFSET = 2208988800;

/**
 * Convert a JavaScript Date object to an Epoch1900 timestamp
 * @param date JavaScript Date object
 * @returns Epoch1900 timestamp (seconds since 1900-01-01)
 */
export function dateToEpoch1900(date: Date): number {
    // Get Unix timestamp (milliseconds since 1970) and convert to seconds
    const unixTimestamp = Math.floor(date.getTime() / 1000);
    // Add offset to get Epoch1900
    return unixTimestamp + EPOCH_OFFSET;
}

/**
 * Convert an Epoch1900 timestamp to a JavaScript Date object
 * @param epoch1900 Epoch1900 timestamp (seconds since 1900-01-01)
 * @returns JavaScript Date object
 */
export function epoch1900ToDate(epoch1900: number): Date {
    // Subtract offset to get Unix timestamp (seconds), then convert to milliseconds
    const unixTimestampMs = (epoch1900 - EPOCH_OFFSET) * 1000;
    return new Date(unixTimestampMs);
}

/**
 * Get the current time as an Epoch1900 timestamp
 * @returns Current time as Epoch1900 timestamp
 */
export function now1900(): number {
    return dateToEpoch1900(new Date());
}

/**
 * Create an Epoch1900 timestamp from year, month, day
 * @param year Year (1900-9999)
 * @param month Month (1-12)
 * @param day Day (1-31)
 * @returns Epoch1900 timestamp
 */
export function createEpoch1900(year: number, month: number, day: number): number {
    if (year < 1900) {
        throw new Error("Year must be at least 1900");
    }
    // JavaScript months are 0-indexed
    const date = new Date(year, month - 1, day);
    return dateToEpoch1900(date);
}

/**
 * Get Epoch1900 timestamp for a date with specified age in years ago from now
 * @param years Age in years
 * @returns Epoch1900 timestamp for that many years ago
 */
export function getDobEpochFromAge(years: number): number {
    const now = new Date();
    const birthDate = new Date();
    birthDate.setFullYear(now.getFullYear() - years);
    return dateToEpoch1900(birthDate);
}

/**
 * Calculate age based on Epoch1900 birth date
 * @param birthDateEpoch1900 Birth date as Epoch1900 timestamp
 * @returns Age in years
 */
export function calculateAge(birthDateEpoch1900: number): number {
    const now = now1900();
    if (now < birthDateEpoch1900) {
        throw new Error("Birth date is in the future");
    }
    
    const birthDate = epoch1900ToDate(birthDateEpoch1900);
    const currentDate = new Date();
    
    let age = currentDate.getFullYear() - birthDate.getFullYear();
    
    // Adjust age if birthday hasn't occurred yet this year
    if (
        currentDate.getMonth() < birthDate.getMonth() ||
        (currentDate.getMonth() === birthDate.getMonth() && 
         currentDate.getDate() < birthDate.getDate())
    ) {
        age--;
    }
    
    return age;
}

/**
 * Check if a person is eligible based on minimum age
 * @param birthDateEpoch1900 Birth date as Epoch1900 timestamp
 * @param minEligibleAge Minimum eligible age
 * @returns Whether the person meets minimum age requirements
 */
export function isEligible(birthDateEpoch1900: number, minEligibleAge: number): boolean {
    return calculateAge(birthDateEpoch1900) >= minEligibleAge;
}

// Export a specific type for Epoch1900
export type Epoch1900 = number;