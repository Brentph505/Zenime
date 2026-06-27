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
    chapters: number | null;
    type: 'ANIME' | 'MANGA';
    coverImage?: { large?: string; medium?: string } | null;
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

async function gql<T = any>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

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
 * Uses `resetNotificationCount: false` so viewing them here doesn't mutate the
 * server-side unread count (the UI clears the badge locally via useAuth).
 */
export async function fetchNotifications(
  token: string,
  page: number = 1,
  perPage: number = 25,
): Promise<FetchNotificationsResult> {
  // NotificationUnion is a GraphQL interface — common fields (id, createdAt,
  // type) must be selected *inside* each `... on <Type>` fragment, not at the
  // top level (querying them there returns "Cannot query field on
  // NotificationUnion").
  const NOTIFICATIONS_QUERY = /* GraphQL */ `
    query Notifications($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage currentPage }
        notifications(resetNotificationCount: false) {
          ... on AiringNotification {
            id type createdAt episode contexts
            media { id type title { userPreferred } coverImage { medium } }
          }
          ... on RelatedMediaAdditionNotification {
            id type createdAt
            media { id type title { userPreferred } coverImage { medium } }
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
            media { id type title { userPreferred } coverImage { medium } }
          }
          ... on MediaMergeNotification {
            id type createdAt reason context deletedMediaTitles
            media { id type title { userPreferred } coverImage { medium } }
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
  }>(NOTIFICATIONS_QUERY, { page, perPage }, token);

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
    id episodes chapters type
    title { romaji english }
    coverImage { large medium }
  }
`;

export async function fetchMediaListEntry(
  token: string,
  mediaId: number,
): Promise<MediaListEntryResult | null> {
  const QUERY = /* GraphQL */ `
    query GetEntry($mediaId: Int!) {
      MediaList(mediaId: $mediaId) { ${ENTRY_FIELDS} }
    }
  `;
  try {
    const data = await gql<{ MediaList: MediaListEntryResult | null }>(
      QUERY, { mediaId }, token,
    );
    return data?.MediaList ?? null;
  } catch (err: any) {
    // AniList returns a 404 GraphQL error when the entry doesn't exist
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
  const QUERY = /* GraphQL */ `
    query UserMediaState($mediaId: Int!) {
      Media: Media(id: $mediaId) { isFavourite }
      MediaList(mediaId: $mediaId) { ${ENTRY_FIELDS} }
    }
  `;
  try {
    const data = await gql<{ Media: { isFavourite: boolean } | null; MediaList: MediaListEntryResult | null }>(
      QUERY, { mediaId }, token,
    );
    return {
      isFavourite: !!data?.Media?.isFavourite,
      entry: data?.MediaList ?? null,
    };
  } catch (err) {
    // AniList returns a 404 GraphQL error when the list entry doesn't exist
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

// ─── Delete media list entry ──────────────────────────────────────────────────

export async function deleteMediaListEntry(
  token: string,
  listEntryId: number,
): Promise<void> {
  const MUTATION = /* GraphQL */ `
    mutation DeleteEntry($id: Int!) {
      DeleteMediaListEntry(id: $id) { deleted }
    }
  `;
  await gql(MUTATION, { id: listEntryId }, token);
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
  totalEpisodes?: number | null,
): Promise<MediaListEntryResult | null> {
  try {
    const existing = await fetchMediaListEntry(token, mediaId);
    const currentStatus = existing?.status;
    // Never regress AniList progress when rewatching earlier episodes.
    const effectiveProgress = Math.max(progress, existing?.progress ?? 0);

    let newStatus: MediaListStatus | undefined;
    if (totalEpisodes && effectiveProgress >= totalEpisodes) {
      newStatus = 'COMPLETED';
    } else if (!currentStatus || currentStatus === 'PLANNING') {
      newStatus = 'CURRENT';
    }

    // If no meaningful change is required, reuse the existing entry instead
    // of sending a redundant save that could trigger unexpected AniList behavior.
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
    };

    if (newStatus) {
      saveInput.status = newStatus;
    } else if (currentStatus) {
      saveInput.status = currentStatus;
    }

    return await saveMediaListEntry(token, saveInput);
  } catch (err) {
    console.error('[authService] syncWatchProgress failed:', err);
    return null;
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
    };

    if (newStatus) {
      saveInput.status = newStatus;
    } else if (currentStatus) {
      saveInput.status = currentStatus;
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

// ─── Full-card anime list fetch (used by WatchingAnilist) ────────────────────

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
    averageScore: number | null;
    startDate: { year: number | null; month: number | null; day: number | null };
    title: { romaji: string; english: string | null };
    coverImage: { large: string; color: string | null };
  };
}

/**
 * Fetch a user's anime list for a given status with full card-ready fields.
 * Does NOT require an auth token — AniList public lists are readable without one.
 */
export async function fetchUserAnimeList(
  username: string,
  status: MediaListStatus,
): Promise<AnimeListEntry[]> {
  const QUERY = `
    query GetUserAnimeList($username: String!, $status: MediaListStatus!) {
      MediaListCollection(
        userName: $username
        type: ANIME
        status: $status
        sort: UPDATED_TIME_DESC
      ) {
        lists {
          entries {
            id progress score status
            media {
              id format status episodes averageScore
              startDate { year month day }
              title     { romaji english }
              coverImage { large color }
            }
          }
        }
      }
    }
  `;

  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { username, status } }),
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