// Import Epoch1900 utilities
import { getDobEpochFromAge as getEpoch1900FromAge } from './epoch1900';

// Get a DOB epoch timestamp for someone of a specific age (Epoch1900 format)
export function getDobEpochFromAge(age: number) {
  return BigInt(getEpoch1900FromAge(age));
}

// Original function for backward compatibility if needed
export function getUnixDobEpochFromAge(age: number) {
  return BigInt(Math.floor(Date.now() / 1000) - age * 365 * 24 * 60 * 60);
}
