/**
 * userInfoTypes.ts
 *
 * Type definitions for AniList user data.
 * Extended to cover fields returned by the full Viewer query in authService.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * Single source of truth for media list status values.
 * authService.ts re-defines this type locally to avoid circular imports.
 */
export type MediaListStatus =
  | 'CURRENT'
  | 'PLANNING'
  | 'COMPLETED'
  | 'REPEATING'
  | 'PAUSED'
  | 'DROPPED';

/** @deprecated Use the MediaListStatus string union instead. */
export enum MediaListStatusEnum {
  CURRENT   = 'CURRENT',
  PLANNING  = 'PLANNING',
  COMPLETED = 'COMPLETED',
  REPEATING = 'REPEATING',
  PAUSED    = 'PAUSED',
  DROPPED   = 'DROPPED',
}

type UserStatisticsSort =
  | 'COUNT_ASC'   | 'COUNT_DESC'
  | 'SCORE_ASC'   | 'SCORE_DESC'
  | 'MEAN_SCORE_ASC' | 'MEAN_SCORE_DESC'
  | 'PROGRESS_ASC'   | 'PROGRESS_DESC';

// ─── Core user data (returned by Viewer query) ────────────────────────────────

export interface UserData {
  name: string;
  avatar: {
    large: string;
    medium?: string;
  };
  bannerImage: string | null;
  statistics: UserStatistics;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface UserStatistics {
  anime: AnimeStatistics;
  manga: MangaStatistics;
}

/** Fields shared by both anime and manga statistics */
interface BaseStatistics {
  count: number;
  meanScore: number;
  standardDeviation: number;
  formats: UserFormatStatistic[];
  statuses: UserStatusStatistic[];
  scores: UserScoreStatistic[];
  lengths: UserLengthStatistic[];
  releaseYears: UserReleaseYearStatistic[];
  startYears: UserStartYearStatistic[];
  genres: UserGenreStatistic[];
  tags: UserTagStatistic[];
  countries: UserCountryStatistic[];
  staff: UserStaffStatistic[];
  studios: UserStudioStatistic[];
}

export interface AnimeStatistics extends BaseStatistics {
  minutesWatched: number;
  episodesWatched: number;
  chaptersRead?: never;
  volumesRead?: never;
  voiceActors: UserVoiceActorStatistic[];
}

export interface MangaStatistics extends BaseStatistics {
  chaptersRead: number;
  volumesRead: number;
  minutesWatched?: never;
  episodesWatched?: never;
  voiceActors?: never;
}

/** Union type — use type guards to narrow when needed */
export type AnimeMangaStatistics = AnimeStatistics | MangaStatistics;

// ─── Statistic detail types ───────────────────────────────────────────────────

export interface StatisticLimitSort {
  limit: number;
  sort: UserStatisticsSort[];
}

export interface UserFormatStatistic {
  format: string;
  count: number;
  meanScore?: number;
  minutesWatched?: number;
}

export interface UserStatusStatistic {
  status: MediaListStatus;
  count: number;
  meanScore?: number;
  minutesWatched?: number;
}

export interface UserScoreStatistic {
  score: number;
  count: number;
  meanScore?: number;
  minutesWatched?: number;
}

export interface UserLengthStatistic {
  length: string;
  count: number;
  meanScore?: number;
  minutesWatched?: number;
}

export interface UserReleaseYearStatistic {
  releaseYear: number;
  count: number;
  meanScore?: number;
  minutesWatched?: number;
  /** @deprecated Use releaseYear */
  year?: number;
}

export interface UserStartYearStatistic {
  startYear: number;
  count: number;
  meanScore?: number;
  minutesWatched?: number;
  /** @deprecated Use startYear */
  year?: number;
}

export interface UserGenreStatistic {
  genre: string;
  count: number;
  meanScore?: number;
  minutesWatched?: number;
}

export interface UserTagStatistic {
  tag: {
    id: number;
    name: string;
  };
  count: number;
  meanScore?: number;
  minutesWatched?: number;
}

export interface UserCountryStatistic {
  country: string;
  count: number;
  meanScore?: number;
  minutesWatched?: number;
}

export interface UserVoiceActorStatistic {
  voiceActor: {
    id: number;
    name: { full: string; native?: string };
    language: string;
  };
  count: number;
  meanScore?: number;
  minutesWatched?: number;
}

export interface UserStaffStatistic {
  staff: {
    id: number;
    name: { full: string; native?: string };
  };
  count: number;
  meanScore?: number;
  minutesWatched?: number;
}

export interface UserStudioStatistic {
  studio: {
    id: number;
    name: string;
  };
  count: number;
  meanScore?: number;
  minutesWatched?: number;
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isAnimeStatistics(s: AnimeMangaStatistics): s is AnimeStatistics {
  return 'minutesWatched' in s;
}

export function isMangaStatistics(s: AnimeMangaStatistics): s is MangaStatistics {
  return 'chaptersRead' in s;
}