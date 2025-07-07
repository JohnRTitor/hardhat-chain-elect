export const GenderEnum = {
  MALE: 0,
  FEMALE: 1,
} as const;
export type Gender = (typeof GenderEnum)[keyof typeof GenderEnum];

export const ElectionStatusEnum = {
  NEW: 0,
  ACTIVE: 1,
  COMPLETED: 2,
  ARCHIVED: 3,
} as const;
export type ElectionStatus =
  (typeof ElectionStatusEnum)[keyof typeof ElectionStatusEnum];
