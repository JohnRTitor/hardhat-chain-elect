export const GenderEnum = {
  MALE: 0,
  FEMALE: 1,
} as const;
export type Gender = (typeof GenderEnum)[keyof typeof GenderEnum];
