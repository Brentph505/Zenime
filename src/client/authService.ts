/**
 * authService.ts
 *
 * Pure service layer for all AniList API operations.
 * No React — all functions are plain async utilities called by useAuth.
 *
 * Covers:
 *  - OAuth flow helpers (CSRF, auth URL)
 *  - User data fetching
 *  - Full media list CRUD (save, update, delete)
 *  - Favourite toggle (anime, manga, character, staff, studio)
 *  - List entry query
 *  - Notification count polling
 *  - User anime/manga list queries (via Apollo hook helper)
 *  - MAL ID → AniList ID conversion
 *  - Watched/read progress sync
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { UserData, type MediaListStatus } from './userInfoTypes';

// ─── Env ──────────────────────────────────────────────────────────────────────

const CLIENT_ID     = import.meta.env.VITE_CLIENT_ID     ?? '';
const CLIENT_SECRET = import.meta.env.VITE_CLIENT_SECRET ?? '';
const REDIRECT_URI  = import.meta.env.VITE_REDIRECT_URI  ?? '';

const ANILIST_GQL = 'https://graphql.anilist.co';
const ANILIST_REQUEST_INTERVAL_MS = 2000;

// Shared GraphQL request gate so the app does not burst requests and trip AniList 429s.
let anilistRequestGate: Promise<void> = Promise.resolve();
let lastAniListRequestAt = 0;

function waitForAniListRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastAniListRequestAt;
  const waitMs = Math.max(0, ANILIST_REQUEST_INTERVAL_MS - elapsed);

  if (waitMs > 0) {
    return new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  lastAniListRequestAt = now;
  return Promise.resolve();
}

async function withAniListRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  const previous = anilistRequestGate;
  let release!: () => void;
  anilistRequestGate = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  await waitForAniListRateLimit();

  try {
    return await fn();
  } finally {
    release();
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type { MediaListStatus } from './userInfoTypes';

export interface SaveEntryInput {
  /** AniList media ID (not MAL ID) */
  mediaId: number;
  status?: MediaListStatus;
  score?: number;              // 0–100 (AniList default scoring)
  scoreRaw?: number;           // if you prefer raw score
  progress?: number;           // episodes watched / chapters read
  progressVolumes?: number;    // manga volumes
  repeat?: number;             // rewatch / reread count
  priority?: number;
  private?: boolean;
  hiddenFromStatusLists?: boolean;
  notes?: string;
  startedAt?: { year?: number; month?: number; day?: number };
  completedAt?: { year?: number; month?: number; day?: number };
}

export interface MediaListEntryResult {
  id: number;
  status: MediaListStatus;
  score: number;
  progress: number;
  progressVolumes: number | null;
  repeat: number;
  private: boolean;
  notes: string | null;
  startedAt: { year: number | null; month: number | null; day: number | null };
  completedAt: { year: number | null; month: number | null; day: number | null };
  updatedAt: number;
  media: {
    id: number;
    title: { romaji: string; english: string | null };
    episodes: number | null;
    status?: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS' | 'UNKNOWN' | null;
    nextAiringEpisode?: { episode: number } | null;
    chapters: number | null;
    type: 'ANIME' | 'MANGA';
    coverImage?: { large?: string; medium?: string } | null;
    genres?: string[];
    isAdult?: boolean;
  };
}

export interface AniListUserFull extends UserData {
  id: number;
  about: string | null;
  siteUrl: string;
  donatorTier: number;
  donatorBadge: string | null;
  createdAt: number;
  updatedAt: number;
  options: {
    titleLanguage: string;
    displayAdultContent: boolean;
    airingNotifications: boolean;
    profileColor: string;
  };
  mediaListOptions: {
    scoreFormat: string;
    rowOrder: string;
    animeList: { sectionOrder: string[]; splitCompletedSectionByFormat: boolean };
    mangaList: { sectionOrder: string[]; splitCompletedSectionByFormat: boolean };
  };
  favourites: {
    anime: { nodes: Array<{ id: number; title: { romaji: string; english: string | null } }> };
    manga: { nodes: Array<{ id: number; title: { romaji: string; english: string | null } }> };
    characters: { nodes: Array<{ id: number; name: { full: string } }> };
    staff: { nodes: Array<{ id: number; name: { full: string } }> };
    studios: { nodes: Array<{ id: number; name: string }> };
  };
}

// ─── Low-level GQL helper ────────────────────────────────────────────────────

/**
 * Thrown by `gql()` when AniList responds with HTTP 429. Carries the
 * `Retry-After` value (seconds) so callers can back off intelligently
 * instead of retrying immediately on the next poll/interval.
 */
export interface AniListRateLimitError extends Error {
  isRateLimit: true;
  retryAfter: number;
}

function isAniListRateLimitError(err: unknown): err is AniListRateLimitError {
  return !!err && typeof err === 'object' && (err as any).isRateLimit === true;
}

export { isAniListRateLimitError };

async function gql<T = any>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<T> {
  return withAniListRateLimit(async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await axios.post<{ data: T; errors?: { message: string }[] }>(
        ANILIST_GQL,
        { query, variables },
        { headers, timeout: 12_000 },
      );

      if (res.data.errors?.length) {
        const msg = res.data.errors.map(e => e.message).join(', ');
        throw new Error(`AniList GraphQL error: ${msg}`);
      }

      return res.data.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        const retryAfter = Number(err.response.headers['retry-after'] ?? '60');
        const rateLimitErr = Object.assign(new Error('AniList rate limited'), {
          isRateLimit: true as const,
          retryAfter,
        });
        throw rateLimitErr;
      }
      throw err;
    }
  });
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

export function generateCsrfToken(): string {
  return uuidv4();
}

export function buildAuthUrl(csrfToken: string): string {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    scope:         '',
    response_type: 'code',
    redirect_uri:  REDIRECT_URI,
    state:         csrfToken,
  });
  return `https://anilist.co/api/v2/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await axios.post<{ access_token: string }>(
    'https://anilist.co/api/v2/oauth/token',
    {
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  REDIRECT_URI,
    },
  );
  if (!res.data.access_token) throw new Error('No access_token in response');
  return res.data.access_token;
}

// ─── User data ────────────────────────────────────────────────────────────────

const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    Viewer {
      id
      name
      bannerImage
      avatar { large medium }
      statistics {
        anime {
          count
          meanScore
          standardDeviation
          minutesWatched
          episodesWatched
          formats { format count }
          statuses { status count }
          scores   { score count }
          genres   { genre count }
        }
        manga {
          count
          meanScore
          standardDeviation
          chaptersRead
          volumesRead
          formats { format count }
          statuses { status count }
          scores   { score count }
          genres   { genre count }
        }
      }
    }
  }
`;

export async function fetchUserData(token: string): Promise<UserData> {
  const data = await gql<{ Viewer: UserData }>(VIEWER_QUERY, {}, token);
  if (!data?.Viewer) throw new Error('No Viewer in response');
  return data.Viewer;
}

/** Extended user profile including favourites and preferences */
export async function fetchAniListUser(token: string): Promise<AniListUserFull> {
  const FULL_VIEWER_QUERY = /* GraphQL */ `
    query FullViewer {
      Viewer {
        id name bannerImage about siteUrl
        donatorTier donatorBadge createdAt updatedAt
        avatar { large medium }
        options {
          titleLanguage displayAdultContent
          airingNotifications profileColor
        }
        mediaListOptions {
          scoreFormat rowOrder
          animeList { sectionOrder splitCompletedSectionByFormat }
          mangaList { sectionOrder splitCompletedSectionByFormat }
        }
        statistics {
          anime {
            count meanScore standardDeviation minutesWatched episodesWatched
            formats { format count } statuses { status count }
            scores  { score count  } genres  { genre  count }
          }
          manga {
            count meanScore standardDeviation chaptersRead volumesRead
            formats { format count } statuses { status count }
            scores  { score count  } genres  { genre  count }
          }
        }
        favourites {
          anime      { nodes { id title { romaji english } } }
          manga      { nodes { id title { romaji english } } }
          characters { nodes { id name  { full } } }
          staff      { nodes { id name  { full } } }
          studios    { nodes { id name } }
        }
      }
    }
  `;
  const data = await gql<{ Viewer: AniListUserFull }>(FULL_VIEWER_QUERY, {}, token);
  if (!data?.Viewer) throw new Error('No Viewer in response');
  return data.Viewer;
}

// ─── Notification count ───────────────────────────────────────────────────────

export async function fetchNotificationCount(token: string): Promise<number> {
  const NOTIF_QUERY = /* GraphQL */ `
    query NotifCount {
      Viewer { unreadNotificationCount }
    }
  `;
  try {
    const data = await gql<{ Viewer: { unreadNotificationCount: number } }>(
      NOTIF_QUERY, {}, token,
    );
    return data?.Viewer?.unreadNotificationCount ?? 0;
  } catch {
    return 0;
  }
}

// ─── Notifications list ───────────────────────────────────────────────────────

/**
 * A flattened, discriminated view of an AniList notification. AniList returns
 * per-type objects (AiringNotification, FollowingNotification, …); we project
 * them into one shape so the UI can render a single list without 12 branches.
 */
export interface AniListNotification {
  id: number;
  type: string;
  /** Unix seconds. */
  createdAt: number;
  /** Who triggered the notification (follows, replies, likes…). */
  user?: { id: number; name: string; avatar?: string } | null;
  /** The media the notification is about (airing, data change…). */
  media?: {
    id: number;
    title?: string;
    coverImage?: string;
    type?: string;
    genres?: string[];
    isAdult?: boolean;
  } | null;
  /** Episode / chapter number for airing notifications. */
  episode?: number | null;
  /** Free-text context (e.g. reply snippet) where AniList provides one. */
  context?: string;
  /** Reason code for activity/thread notifications (e.g. "liked"). */
  reason?: string;
  /** A direct AniList URL to the activity/thread when available. */
  activityUrl?: string;
}

export interface FetchNotificationsResult {
  items: AniListNotification[];
  hasNextPage: boolean;
}

/**
 * Fetch the signed-in viewer's notifications (most recent first).
 * Pass `resetNotificationCount: true` (done by useNotifications on first
 * load) to actually clear AniList's server-side unread count, not just the
 * local in-app badge.
 */
export async function fetchNotifications(
  token: string,
  page: number = 1,
  perPage: number = 25,
  resetNotificationCount: boolean = false,
): Promise<FetchNotificationsResult> {
  // NotificationUnion is a GraphQL interface — common fields (id, createdAt,
  // type) must be selected *inside* each `... on <Type>` fragment, not at the
  // top level (querying them there returns "Cannot query field on
  // NotificationUnion").
  //
  // FIX: `resetNotificationCount` now actually gets threaded through instead
  // of being hardcoded to `false`. Hardcoding it to false meant AniList's
  // real server-side unread counter never moved — "Mark all read" only ever
  // touched local React state, so the navbar badge would silently reappear
  // (showing the old count again) on the very next 5-minute poll. We pass
  // `true` from useNotifications.load() so opening the panel actually clears
  // the count for good, the same way it does on anilist.co itself.
  const NOTIFICATIONS_QUERY = /* GraphQL */ `
    query Notifications($page: Int, $perPage: Int, $resetCount: Boolean) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage currentPage }
        notifications(resetNotificationCount: $resetCount) {
          ... on AiringNotification {
            id type createdAt episode contexts
            media { id type title { userPreferred } coverImage { medium } genres isAdult }
          }
          ... on RelatedMediaAdditionNotification {
            id type createdAt
            media { id type title { userPreferred } coverImage { medium } genres isAdult }
          }
          ... on FollowingNotification {
            id type createdAt context
            user { id name avatar { medium } }
          }
          ... on ActivityMessageNotification {
            id type createdAt context activityId
            user { id name avatar { medium } }
          }
          ... on ActivityReplyNotification {
            id type createdAt context activityId
            user { id name avatar { medium } }
          }
          ... on ActivityReplySubscribedNotification {
            id type createdAt context activityId
            user { id name avatar { medium } }
          }
          ... on ActivityMentionNotification {
            id type createdAt context activityId
            user { id name avatar { medium } }
          }
          ... on ActivityLikeNotification {
            id type createdAt activityId
            user { id name avatar { medium } }
          }
          ... on ActivityReplyLikeNotification {
            id type createdAt activityId
            user { id name avatar { medium } }
          }
          ... on ThreadCommentMentionNotification {
            id type createdAt context
            thread { id title } comment { id }
            user { id name avatar { medium } }
          }
          ... on ThreadCommentReplyNotification {
            id type createdAt context
            thread { id title } comment { id }
            user { id name avatar { medium } }
          }
          ... on ThreadCommentSubscribedNotification {
            id type createdAt context
            thread { id title } comment { id }
            user { id name avatar { medium } }
          }
          ... on ThreadCommentLikeNotification {
            id type createdAt
            thread { id title } comment { id }
            user { id name avatar { medium } }
          }
          ... on ThreadLikeNotification {
            id type createdAt
            thread { id title }
            user { id name avatar { medium } }
          }
          ... on MediaDataChangeNotification {
            id type createdAt reason context
            media { id type title { userPreferred } coverImage { medium } genres isAdult }
          }
          ... on MediaMergeNotification {
            id type createdAt reason context deletedMediaTitles
            media { id type title { userPreferred } coverImage { medium } genres isAdult }
          }
          ... on MediaDeletionNotification {
            id type createdAt reason context deletedMediaTitle
          }
        }
      }
    }
  `;

  const data = await gql<{
    Page: {
      pageInfo: { hasNextPage: boolean };
      notifications: any[];
    } | null;
  }>(NOTIFICATIONS_QUERY, { page, perPage, resetCount: resetNotificationCount }, token);

  const raw = data?.Page?.notifications ?? [];
  const hasNextPage = data?.Page?.pageInfo?.hasNextPage ?? false;

  const items: AniListNotification[] = raw.map((n) => ({
    id: n.id,
    type: n.type ?? n.__typename ?? 'UNKNOWN',
    createdAt: n.createdAt ?? 0,
    user: n.user
      ? { id: n.user.id, name: n.user.name, avatar: n.user.avatar?.medium }
      : null,
    media: n.media
      ? {
          id: n.media.id,
          title: n.media.title?.userPreferred,
          coverImage: n.media.coverImage?.medium,
          type: n.media.type,
          genres: n.media.genres,
          isAdult: n.media.isAdult,
        }
      : null,
    episode: n.episode ?? null,
    // AniList returns an array of context fragments for many types; join them.
    context: Array.isArray(n.contexts)
      ? n.contexts.join(' ')
      : n.context ?? '',
    reason: n.reason,
    activityUrl: n.activityId
      ? `https://anilist.co/activity/${n.activityId}`
      : n.thread?.id
        ? `https://anilist.co/forum/thread/${n.thread.id}`
        : undefined,
  }));

  return { items, hasNextPage };
}

// ─── Media list entry query ───────────────────────────────────────────────────

const ENTRY_FIELDS = /* GraphQL */ `
  id status score progress progressVolumes repeat private notes updatedAt
  startedAt   { year month day }
  completedAt { year month day }
  media {
    id episodes status nextAiringEpisode { episode } chapters type
    title { romaji english }
    coverImage { large medium }
    genres isAdult
  }
`;

export async function fetchMediaListEntry(
  token: string,
  mediaId: number,
): Promise<MediaListEntryResult | null> {
  // FIX: We previously queried the standalone `MediaList(mediaId: $mediaId)`
  // field. Per AniList's own docs, the viewer is NOT inferred for that query
  // shape — "even when making authenticated requests... if you only use the
  // mediaId field, it is very unlikely that you will get the entry for the
  // user you want." Without a userId/userName it can silently return the
  // wrong user's entry (or null), which broke status/score/progress reads,
  // delete-button enablement, and deletion (you can't delete an entry that
  // isn't yours).
  //
  // `Media.mediaListEntry` is AniList's documented way to fetch "the list
  // entry for the authenticated user" from a single media lookup, so we use
  // that instead.
  const QUERY = /* GraphQL */ `
    query GetEntry($mediaId: Int!) {
      Media(id: $mediaId) {
        mediaListEntry { ${ENTRY_FIELDS} }
      }
    }
  `;
  try {
    const data = await gql<{ Media: { mediaListEntry: MediaListEntryResult | null } | null }>(
      QUERY, { mediaId }, token,
    );
    return data?.Media?.mediaListEntry ?? null;
  } catch (err: any) {
    // AniList returns a 404 GraphQL error when the media itself doesn't exist
    if (err?.message?.includes('Not Found') || err?.message?.includes('404')) return null;
    throw err;
  }
}

/**
 * Combined view of the viewer's relationship to a single media item:
 * the MediaList entry (if any) plus the current favourite flag.
 *
 * Single GraphQL request — avoids two round-trips on the Info page.
 */
export interface UserMediaState {
  entry: MediaListEntryResult | null;
  isFavourite: boolean;
}

export async function fetchUserMediaState(
  token: string,
  mediaId: number,
): Promise<UserMediaState> {
  // FIX: same root cause as fetchMediaListEntry above — `MediaList(mediaId:
  // $mediaId)` doesn't reliably scope to the authenticated viewer. Nesting
  // `mediaListEntry` under `Media` does.
  const QUERY = /* GraphQL */ `
    query UserMediaState($mediaId: Int!) {
      Media(id: $mediaId) {
        isFavourite
        mediaListEntry { ${ENTRY_FIELDS} }
      }
    }
  `;
  try {
    const data = await gql<{
      Media: { isFavourite: boolean; mediaListEntry: MediaListEntryResult | null } | null;
    }>(QUERY, { mediaId }, token);
    return {
      isFavourite: !!data?.Media?.isFavourite,
      entry: data?.Media?.mediaListEntry ?? null,
    };
  } catch (err) {
    // AniList returns a 404 GraphQL error when the media itself doesn't exist
    // — that's a valid "no entry" state, so swallow it. Other errors propagate.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Not Found') || msg.includes('404')) {
      return { entry: null, isFavourite: false };
    }
    throw err;
  }
}

/** Fetch all entries in a user's anime or manga list with a given status */
export async function fetchUserList(
  token: string,
  username: string,
  type: 'ANIME' | 'MANGA',
  status: MediaListStatus,
): Promise<MediaListEntryResult[]> {
  const QUERY = /* GraphQL */ `
    query UserList($username: String!, $type: MediaType!, $status: MediaListStatus!) {
      MediaListCollection(userName: $username, type: $type, status: $status, sort: UPDATED_TIME_DESC) {
        lists {
          entries { ${ENTRY_FIELDS} }
        }
      }
    }
  `;
  const data = await gql<{
    MediaListCollection: { lists: Array<{ entries: MediaListEntryResult[] }> }
  }>(QUERY, { username, type, status }, token);

  return data?.MediaListCollection?.lists?.flatMap(l => l.entries) ?? [];
}

/**
 * Fetch a user's ENTIRE anime or manga list (all statuses at once) in a
 * single GraphQL request. Use this instead of looping fetchUserList() over
 * every MediaListStatus — that pattern costs 6 requests per sync and is a
 * major contributor to AniList 429s.
 */
export async function fetchFullMediaListCollection(
  token: string,
  username: string,
  type: 'ANIME' | 'MANGA',
): Promise<MediaListEntryResult[]> {
  const QUERY = /* GraphQL */ `
    query FullUserList($username: String!, $type: MediaType!) {
      MediaListCollection(userName: $username, type: $type) {
        lists {
          entries { ${ENTRY_FIELDS} }
        }
      }
    }
  `;
  const data = await gql<{
    MediaListCollection: { lists: Array<{ entries: MediaListEntryResult[] }> } | null;
  }>(QUERY, { username, type }, token);

  return data?.MediaListCollection?.lists?.flatMap(l => l.entries) ?? [];
}

// ─── Save / update media list entry ──────────────────────────────────────────

const SAVE_MUTATION = /* GraphQL */ `
  mutation SaveEntry(
    $mediaId: Int!
    $status: MediaListStatus
    $score: Float
    $scoreRaw: Int
    $progress: Int
    $progressVolumes: Int
    $repeat: Int
    $priority: Int
    $private: Boolean
    $hiddenFromStatusLists: Boolean
    $notes: String
    $startedAt: FuzzyDateInput
    $completedAt: FuzzyDateInput
  ) {
    SaveMediaListEntry(
      mediaId: $mediaId
      status: $status
      score: $score
      scoreRaw: $scoreRaw
      progress: $progress
      progressVolumes: $progressVolumes
      repeat: $repeat
      priority: $priority
      private: $private
      hiddenFromStatusLists: $hiddenFromStatusLists
      notes: $notes
      startedAt: $startedAt
      completedAt: $completedAt
    ) { ${ENTRY_FIELDS} }
  }
`;

// Keep progress writes for one title ordered when playback emits close events.
const animeProgressQueues = new Map<number, Promise<unknown>>();

export async function saveMediaListEntry(
  token: string,
  input: SaveEntryInput,
): Promise<MediaListEntryResult> {
  const data = await gql<{ SaveMediaListEntry: MediaListEntryResult }>(
    SAVE_MUTATION,
    { ...input },
    token,
  );
  if (!data?.SaveMediaListEntry) throw new Error('SaveMediaListEntry returned null');
  return data.SaveMediaListEntry;
}

// ─── Batched save (multiple entries in ONE request via GraphQL aliases) ──────

/**
 * Push progress/status updates for multiple anime in ONE request instead of
 * N separate SaveMediaListEntry calls. Callers are responsible for resolving
 * status (CURRENT/COMPLETED/etc) per entry beforehand — this does not apply
 * any of syncWatchProgress's PLANNING→CURRENT or airing-episode-clamp logic,
 * since that logic needs each entry's *current* server state first. Use
 * `syncWatchProgressBatch` below if you want that behavior automatically.
 */
export async function saveMediaListEntriesBatch(
  token: string,
  entries: SaveEntryInput[],
): Promise<Record<string, MediaListEntryResult>> {
  if (entries.length === 0) return {};

  const variableDefs: string[] = [];
  const mutationParts: string[] = [];
  const variables: Record<string, unknown> = {};

  entries.forEach((entry, i) => {
    variableDefs.push(
      `$mediaId${i}: Int!, $status${i}: MediaListStatus, $progress${i}: Int`,
    );
    mutationParts.push(
      `e${i}: SaveMediaListEntry(mediaId: $mediaId${i}, status: $status${i}, progress: $progress${i}) { ${ENTRY_FIELDS} }`,
    );
    variables[`mediaId${i}`] = entry.mediaId;
    variables[`status${i}`] = entry.status ?? null;
    variables[`progress${i}`] = entry.progress ?? null;
  });

  const query = `mutation (${variableDefs.join(', ')}) { ${mutationParts.join(' ')} }`;
  return gql<Record<string, MediaListEntryResult>>(query, variables, token);
}

/**
 * Batched equivalent of syncWatchProgress for multiple anime at once.
 * Fetches the viewer's current list ONCE (1 request), resolves the same
 * PLANNING→CURRENT / COMPLETED / airing-episode-clamp rules that
 * syncWatchProgress uses per-item, then pushes all changed entries in ONE
 * aliased mutation (1 request). Total: 2 requests for the whole batch,
 * instead of up to 2 requests PER anime.
 */
export async function syncWatchProgressBatch(
  token: string,
  username: string,
  updates: { mediaId: number; progress: number }[],
): Promise<Record<string, MediaListEntryResult>> {
  if (updates.length === 0) return {};

  const existingEntries = await fetchFullMediaListCollection(token, username, 'ANIME');
  const existingById = new Map(existingEntries.map((e) => [e.media.id, e]));

  const toSave: SaveEntryInput[] = [];

  for (const { mediaId, progress } of updates) {
    const existing = existingById.get(mediaId);
    const requestedProgress = Math.max(0, Math.floor(Number(progress) || 0));
    const nextAiringEpisode = existing?.media?.nextAiringEpisode?.episode;
    const releasedEpisodeLimit =
      existing?.media?.status === 'RELEASING' && nextAiringEpisode != null
        ? Math.max(0, nextAiringEpisode - 1)
        : null;
    const requestedReleasedProgress =
      releasedEpisodeLimit == null
        ? requestedProgress
        : Math.min(requestedProgress, releasedEpisodeLimit);
    const currentStatus = existing?.status;
    const existingProgress =
      releasedEpisodeLimit == null
        ? existing?.progress ?? 0
        : Math.min(existing?.progress ?? 0, releasedEpisodeLimit);
    const effectiveProgress = Math.max(requestedReleasedProgress, existingProgress);

    let newStatus: MediaListStatus | undefined;
    const finishedEpisodeCount = existing?.media?.episodes;
    if (
      existing?.media?.status === 'FINISHED' &&
      finishedEpisodeCount &&
      effectiveProgress >= finishedEpisodeCount
    ) {
      newStatus = 'COMPLETED';
    } else if (!currentStatus || currentStatus === 'PLANNING') {
      newStatus = 'CURRENT';
    }

    // No real change — skip it, keeps the batched mutation smaller.
    if (
      existing &&
      effectiveProgress === existing.progress &&
      (newStatus === undefined || newStatus === currentStatus)
    ) {
      continue;
    }

    toSave.push({
      mediaId,
      progress: effectiveProgress,
      status: newStatus ?? currentStatus ?? 'CURRENT',
    });
  }

  if (toSave.length === 0) return {};

  return saveMediaListEntriesBatch(token, toSave);
}

// ─── Delete media list entry ──────────────────────────────────────────────────

export async function deleteMediaListEntry(
  token: string,
  listEntryId: number,
): Promise<boolean> {
  const MUTATION = /* GraphQL */ `
    mutation DeleteEntry($id: Int!) {
      DeleteMediaListEntry(id: $id) { deleted }
    }
  `;
  const data = await gql<{ DeleteMediaListEntry: { deleted: boolean } }>(
    MUTATION,
    { id: listEntryId },
    token,
  );
  return !!data?.DeleteMediaListEntry?.deleted;
}

// ─── Toggle favourite ─────────────────────────────────────────────────────────

export async function toggleFavourite(
  token: string,
  params: {
    animeId?: number;
    mangaId?: number;
    characterId?: number;
    staffId?: number;
    studioId?: number;
  },
): Promise<void> {
  const MUTATION = /* GraphQL */ `
    mutation ToggleFav(
      $animeId: Int
      $mangaId: Int
      $characterId: Int
      $staffId: Int
      $studioId: Int
    ) {
      ToggleFavourite(
        animeId: $animeId
        mangaId: $mangaId
        characterId: $characterId
        staffId: $staffId
        studioId: $studioId
      ) {
        anime      { nodes { id } }
        manga      { nodes { id } }
        characters { nodes { id } }
        staff      { nodes { id } }
        studios    { nodes { id } }
      }
    }
  `;
  await gql(MUTATION, params, token);
}

// ─── ID conversion ────────────────────────────────────────────────────────────

/** Convert a MyAnimeList ID to an AniList media ID. Returns null on failure. */
export async function malIdToAniListId(malId: number): Promise<number | null> {
  try {
    const data = await gql<{ Media: { id: number } | null }>(
      /* GraphQL */ `query MALtoAL($idMal: Int!) { Media(idMal: $idMal, type: ANIME) { id } }`,
      { idMal: malId },
    );
    return data?.Media?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Convenience: sync watch progress ────────────────────────────────────────

/**
 * Sync watch progress to AniList.
 * Automatically sets status to CURRENT if it was PLANNING,
 * and COMPLETED if progress reaches total episodes.
 */
export async function syncWatchProgress(
  token: string,
  mediaId: number,
  progress: number,
  _totalEpisodes?: number | null,
): Promise<MediaListEntryResult | null> {
  const previous = animeProgressQueues.get(mediaId) ?? Promise.resolve();
  const current = previous.then(async () => {
    try {
      const existing = await fetchMediaListEntry(token, mediaId);
      const requestedProgress = Math.max(0, Math.floor(Number(progress) || 0));
      const nextAiringEpisode = existing?.media?.nextAiringEpisode?.episode;
      const releasedEpisodeLimit =
        existing?.media?.status === 'RELEASING' && nextAiringEpisode != null
          ? Math.max(0, nextAiringEpisode - 1)
          : null;

      // AniList metadata is authoritative for airing shows. Never push a
      // provider's planned future episode to the user's list.
      const requestedReleasedProgress =
        releasedEpisodeLimit == null
          ? requestedProgress
          : Math.min(requestedProgress, releasedEpisodeLimit);
      const currentStatus = existing?.status;
      const existingProgress =
        releasedEpisodeLimit == null
          ? existing?.progress ?? 0
          : Math.min(existing?.progress ?? 0, releasedEpisodeLimit);
      // Preserve real progress, but repair an impossible value already stored
      // above AniList's current airing episode.
      const effectiveProgress = Math.max(requestedReleasedProgress, existingProgress);

      let newStatus: MediaListStatus | undefined;
      const finishedEpisodeCount = existing?.media?.episodes;
      if (
        existing?.media?.status === 'FINISHED' &&
        finishedEpisodeCount &&
        effectiveProgress >= finishedEpisodeCount
      ) {
        newStatus = 'COMPLETED';
      } else if (!currentStatus || currentStatus === 'PLANNING') {
        newStatus = 'CURRENT';
      }

      if (
        existing &&
        effectiveProgress === existing.progress &&
        (newStatus === undefined || newStatus === currentStatus)
      ) {
        return existing;
      }

      const saveInput: SaveEntryInput = {
        mediaId,
        progress: effectiveProgress,
        status: newStatus ?? currentStatus ?? 'CURRENT',
      };

      if (newStatus) {
        saveInput.status = newStatus;
      } else if (currentStatus) {
        saveInput.status = currentStatus;
      } else {
        saveInput.status = 'CURRENT';
      }

      return await saveMediaListEntry(token, saveInput);
    } catch (err) {
      console.error('[authService] syncWatchProgress failed:', err);
      return null;
    }
  });

  animeProgressQueues.set(mediaId, current);
  try {
    return await current as MediaListEntryResult | null;
  } finally {
    if (animeProgressQueues.get(mediaId) === current) {
      animeProgressQueues.delete(mediaId);
    }
  }
}

/**
 * Mark an anime as completed with all episodes watched.
 */
export async function markAnimeCompleted(
  token: string,
  mediaId: number,
  totalEpisodes: number,
): Promise<MediaListEntryResult | null> {
  return saveMediaListEntry(token, {
    mediaId,
    progress: totalEpisodes,
    status: 'COMPLETED',
  });
}

/**
 * Sync manga reading progress (chapters read) to AniList.
 * Mirrors syncWatchProgress: auto-sets CURRENT if it was PLANNING,
 * and COMPLETED if progress reaches the total chapter count.
 */
export async function syncMangaReadProgress(
  token: string,
  mediaId: number,
  progress: number,
  totalChapters?: number | null,
): Promise<MediaListEntryResult | null> {
  try {
    const existing = await fetchMediaListEntry(token, mediaId);
    const currentStatus = existing?.status;
    const effectiveProgress = Math.max(progress, existing?.progress ?? 0);

    let newStatus: MediaListStatus | undefined;
    if (totalChapters && effectiveProgress >= totalChapters) {
      newStatus = 'COMPLETED';
    } else if (!currentStatus || currentStatus === 'PLANNING') {
      newStatus = 'CURRENT';
    }

    if (
      existing &&
      effectiveProgress === existing.progress &&
      (newStatus === undefined || newStatus === currentStatus)
    ) {
      return existing;
    }

    const saveInput: any = {
      mediaId,
      progress: effectiveProgress,
      status: newStatus ?? currentStatus ?? 'CURRENT',
    };

    if (newStatus) {
      saveInput.status = newStatus;
    } else if (currentStatus) {
      saveInput.status = currentStatus;
    } else {
      saveInput.status = 'CURRENT';
    }

    return await saveMediaListEntry(token, saveInput);
  } catch (err) {
    console.error('[authService] syncMangaReadProgress failed:', err);
    return null;
  }
}

// ─── Backward-compatible aliases ──────────────────────────────────────────────
// The refactor renamed these functions. Aliases keep existing call sites working
// without requiring changes across the codebase.

/**
 * @deprecated Use `syncWatchProgress` instead.
 * Kept for backward compatibility with Player.tsx and other existing callers.
 */
export async function saveWatchProgress(
  token: string,
  mediaId: number,
  progress: number,
  totalEpisodes?: number | null,
): Promise<MediaListEntryResult | null> {
  return syncWatchProgress(token, mediaId, progress, totalEpisodes);
}

/**
 * @deprecated Use `malIdToAniListId` instead.
 * Kept for backward compatibility with Player.tsx and other existing callers.
 */
export async function getAniListIdFromMalId(malId: number): Promise<number | null> {
  return malIdToAniListId(malId);
}

// ─── Full-card media list fetch (used by the AniList profile section) ─────

export interface AnimeListEntry {
  id: number;
  progress: number;
  score: number;
  status: MediaListStatus;
  media: {
    id: number;
    format: string;
    status: string;
    episodes: number | null;
    chapters: number | null;
    averageScore: number | null;
    startDate: { year: number | null; month: number | null; day: number | null };
    title: { romaji: string; english: string | null };
    coverImage: { large: string; color: string | null };
    type: 'ANIME' | 'MANGA';
  };
}

/**
 * Fetch a user's list for a given media type and status with full card-ready fields.
 * Does NOT require an auth token — AniList public lists are readable without one.
 */
export async function fetchUserMediaList(
  username: string,
  status: MediaListStatus,
  type: 'ANIME' | 'MANGA',
): Promise<AnimeListEntry[]> {
  const QUERY = `
    query GetUserMediaList($username: String!, $status: MediaListStatus!, $type: MediaType!) {
      MediaListCollection(
        userName: $username
        type: $type
        status: $status
        sort: UPDATED_TIME_DESC
      ) {
        lists {
          entries {
            id progress score status
            media {
              id format status episodes chapters averageScore
              startDate { year month day }
              title     { romaji english }
              coverImage { large color }
              type
            }
          }
        }
      }
    }
  `;

  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { username, status, type } }),
  });

  if (!res.ok) throw new Error(`AniList request failed: ${res.status}`);
  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join(', '));
  }

  return json.data?.MediaListCollection?.lists?.flatMap(
    (l: { entries: AnimeListEntry[] }) => l.entries,
  ) ?? [];
}

export async function fetchUserAnimeList(
  username: string,
  status: MediaListStatus,
): Promise<AnimeListEntry[]> {
  return fetchUserMediaList(username, status, 'ANIME');
}

export async function fetchUserMangaList(
  username: string,
  status: MediaListStatus,
): Promise<AnimeListEntry[]> {
  return fetchUserMediaList(username, status, 'MANGA');
}