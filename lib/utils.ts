// Get a DOB epoch timestamp for someone of a specific age
export function getDobEpochFromAge(age: number) {
  return BigInt(Math.floor(Date.now() / 1000) - age * 365 * 24 * 60 * 60);
}
