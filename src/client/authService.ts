// src/services/authService.ts
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { UserData, MediaListStatus } from '../index';
import { useQuery, gql } from '@apollo/client';

const clientId = import.meta.env.VITE_CLIENT_ID || 'default_client_id';
const clientSecret =
  import.meta.env.VITE_CLIENT_SECRET || 'default_client_secret';
const redirectUri =
  import.meta.env.VITE_REDIRECT_URI || 'default_redirect_uri';

export const generateCsrfToken = (): string => {
  return uuidv4();
};

export const buildAuthUrl = (csrfToken: string): string => {
  const scope = encodeURIComponent('');
  const state = encodeURIComponent(csrfToken);
  const encodedRedirectUri = encodeURIComponent(redirectUri);

  return `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&scope=${scope}&response_type=code&redirect_uri=${encodedRedirectUri}&state=${state}`;
};

export const getAccessToken = async (code: string): Promise<string> => {
  const url = 'https://anilist.co/api/v2/oauth/token';
  const payload = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  };

  try {
    const response = await axios.post(url, payload);
    if (response.data.access_token) {
      return response.data.access_token;
    } else {
      throw new Error('Access token not found in the response');
    }
  } catch (error) {
    console.error('Error obtaining access token:', error);
    throw new Error('Failed to obtain access token');
  }
};

export const fetchUserData = async (accessToken: string): Promise<UserData> => {
  try {
    const response = await axios.post(
      'https://graphql.anilist.co',
      {
        query: `
          query {
            Viewer {
              id
              name
              bannerImage
              avatar {
                large
              }
              statistics {
                anime {
                  count
                  episodesWatched
                  meanScore
                  minutesWatched
                }
              }
            }
          }
        `,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    );
    return response.data.data.Viewer;
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw new Error('Failed to fetch user data');
  }
};

const GET_USER_ANIME_LIST = gql`
  query GetUserAnimeList($username: String!, $status: MediaListStatus!) {
    MediaListCollection(
      userName: $username
      type: ANIME
      status: $status
      sort: UPDATED_TIME_DESC
    ) {
      lists {
        entries {
          media {
            id
            format
            title {
              romaji
              english
            }
            coverImage {
              large
              color
            }
            status
            episodes
            startDate {
              year
              month
              day
            }
            averageScore
            genres
          }
        }
      }
    }
  }
`;

// GraphQL mutations for updating watch progress
const SAVE_MEDIA_LIST_ENTRY = `
  mutation SaveMediaListEntry($mediaId: Int!, $progress: Int, $status: MediaListStatus) {
    SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status) {
      id
      progress
      status
      media {
        id
        title {
          romaji
          english
        }
      }
    }
  }
`;

const UPDATE_MEDIA_LIST_ENTRY = `
  mutation UpdateMediaListEntry($id: Int!, $progress: Int, $status: MediaListStatus) {
    UpdateMediaListEntry(id: $id, progress: $progress, status: $status) {
      id
      progress
      status
      media {
        id
        title {
          romaji
          english
        }
      }
    }
  }
`;

// Get user's media list entry for a specific anime
export const getUserMediaListEntry = async (
  accessToken: string,
  mediaId: number
): Promise<any> => {
  try {
    const response = await axios.post(
      'https://graphql.anilist.co',
      {
        query: `
          query GetMediaListEntry($mediaId: Int!) {
            MediaList(mediaId: $mediaId) {
              id
              progress
              status
              media {
                id
                title {
                  romaji
                  english
                }
                episodes
              }
            }
          }
        `,
        variables: { mediaId },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    );
    return response.data.data.MediaList;
  } catch (error) {
    console.error('Error fetching media list entry:', error);
    return null;
  }
};

// Save or update watch progress on AniList
export const saveWatchProgress = async (
  accessToken: string,
  mediaId: number,
  progress: number,
  status?: string
): Promise<any> => {
  try {
    // First check if user already has this anime in their list
    const existingEntry = await getUserMediaListEntry(accessToken, mediaId);

    let mutation;
    let variables;

    if (existingEntry) {
      // Update existing entry
      mutation = UPDATE_MEDIA_LIST_ENTRY;
      variables = {
        id: existingEntry.id,
        progress: progress,
        status: status || existingEntry.status,
      };
    } else {
      // Create new entry
      mutation = SAVE_MEDIA_LIST_ENTRY;
      variables = {
        mediaId: mediaId,
        progress: progress,
        status: status || 'CURRENT',
      };
    }

    const response = await axios.post(
      'https://graphql.anilist.co',
      {
        query: mutation,
        variables: variables,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    );

    console.log('✅ [AniList] Watch progress saved:', {
      mediaId,
      progress,
      status: variables.status,
    });

    return response.data.data.SaveMediaListEntry || response.data.data.UpdateMediaListEntry;
  } catch (error) {
    console.error('❌ [AniList] Failed to save watch progress:', error);
    throw new Error('Failed to save watch progress to AniList');
  }
};

// Mark anime as completed on AniList
export const markAnimeCompleted = async (
  accessToken: string,
  mediaId: number,
  totalEpisodes: number
): Promise<any> => {
  try {
    return await saveWatchProgress(accessToken, mediaId, totalEpisodes, 'COMPLETED');
  } catch (error) {
    console.error('❌ [AniList] Failed to mark anime as completed:', error);
    throw error;
  }
};

// Convert MAL ID to AniList ID
export const getAniListIdFromMalId = async (malId: number): Promise<number | null> => {
  try {
    const response = await axios.post(
      'https://graphql.anilist.co',
      {
        query: `
          query GetAniListId($idMal: Int!) {
            Media(idMal: $idMal, type: ANIME) {
              id
            }
          }
        `,
        variables: { idMal: malId },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    );
    return response.data.data.Media?.id || null;
  } catch (error) {
    console.error('❌ [AniList] Failed to get AniList ID from MAL ID:', error);
    return null;
  }
};

export const useUserAnimeList = (username: string, status: MediaListStatus) => {
  const { data, loading, error } = useQuery(GET_USER_ANIME_LIST, {
    variables: { username, status },
    skip: !username || !status,
  });

  return {
    animeList: data?.MediaListCollection,
    loading,
    error,
  };
};