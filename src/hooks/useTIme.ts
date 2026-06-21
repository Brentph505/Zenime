// /hooks/useTIme.ts
//
// Season helpers.
//
// These are computed fresh on every call (not captured once at module load)
// and their boundaries match AniList's real season definition used elsewhere
// in the app (useApi.ts `monthToSeason`):
//   WINTER = Jan–Mar  (1,2,3)
//   SPRING = Apr–Jun  (4,5,6)
//   SUMMER = Jul–Sep  (7,8,9)
//   FALL   = Oct–Dec  (10,11,12)

export const date = new Date();

export const time = new Date().getTime();

export const year = new Date().getFullYear();

export const month = new Date().getMonth();

export const getCurrentSeason = (): string => {
  const m = new Date().getMonth() + 1; // 1-indexed
  if (m <= 3) return 'WINTER';
  if (m <= 6) return 'SPRING';
  if (m <= 9) return 'SUMMER';
  return 'FALL';
};

export const getNextSeason = (): string => {
  const m = new Date().getMonth() + 1; // 1-indexed
  if (m <= 3) return 'SPRING';
  if (m <= 6) return 'SUMMER';
  if (m <= 9) return 'FALL';
  return 'WINTER';
};
