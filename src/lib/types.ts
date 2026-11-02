export type Gender = 'male' | 'female' | 'other';
export type AgeGroup = 'u15' | '15-24' | '25-39' | '40+';

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: 'u15', label: 'Under 15' },
  { value: '15-24', label: '15–24' },
  { value: '25-39', label: '25–39' },
  { value: '40+', label: '40+' },
];

export function ageGroupOf(age: number): AgeGroup {
  if (age < 15) return 'u15';
  if (age < 25) return '15-24';
  if (age < 40) return '25-39';
  return '40+';
}

export interface Player {
  id: number;
  name: string;
  heightCm: number;
  weightKg: number;
  age: number;
  gender: Gender;
  /** derived from age, used for leaderboard filters */
  ageGroup: AgeGroup;
}

export interface JumpRow {
  id: number;
  playerId: number;
  heightCm: number;
  flightMs: number;
  spinDeg: number;
  impactG: number;
  deviceModel: string | null;
  createdAt: number;
  matchId: number | null;
}

/** Every sport the app can score. The first two are jump variants measured by the same detector. */
export type SportId = 'height' | 'spin' | 'reaction' | 'throw' | 'balance';

/** Saved in matches.mode; kept as an alias so old code and data keep working. */
export type MatchMode = SportId;
