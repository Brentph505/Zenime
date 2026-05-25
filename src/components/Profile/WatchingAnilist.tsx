import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../client/useAuth';
import { fetchUserAnimeList, type AnimeListEntry, type MediaListStatus } from '../../client/authService';
import { CardGrid } from '../../index';

// ─── Types ────────────────────────────────────────────────────────────────────

// All valid status values as a plain const — lets us call Object.keys/values
// without needing an enum (MediaListStatus is a type-only string union).
const STATUS_OPTIONS: { value: MediaListStatus; label: string }[] = [
  { value: 'CURRENT',   label: 'Watching'      },
  { value: 'PLANNING',  label: 'Plan to Watch' },
  { value: 'COMPLETED', label: 'Completed'     },
  { value: 'REPEATING', label: 'Re-watching'   },
  { value: 'PAUSED',    label: 'Paused'        },
  { value: 'DROPPED',   label: 'Dropped'       },
];

const ANILIST_STATUS_LABELS: Record<string, string> = {
  FINISHED:         'Completed',
  RELEASING:        'Ongoing',
  NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED:        'Cancelled',
  HIATUS:           'On hiatus',
};

// ─── Styled components ────────────────────────────────────────────────────────

const Container = styled.div`
  margin-top: 1rem;
  margin-bottom: 1rem;
`;

const Message = styled.div`
  margin: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.5rem;
  font-weight: bold;
`;

const NotLoggedIn = styled.div`
  margin: 5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  font-size: 1.5rem;
  font-weight: bold;
  max-width: 100%;

  @media (max-width: 600px) {
    margin: 1rem 0;
    padding: 0.85rem;
    font-size: 0.95rem;
    font-weight: 600;
  }
`;

const StatusDropdown = styled.select`
  margin-left: 1rem;
  margin-bottom: 1.5rem;
  padding: 0.75rem;
  border-radius: var(--global-border-radius);
  background-color: var(--global-secondary-bg);
  color: var(--global-text);
  border: none;
  cursor: pointer;
`;

// ─── Component ────────────────────────────────────────────────────────────────

export const WatchingAnilist = () => {
  const { isLoggedIn, userData } = useAuth();

  const [selectedStatus, setSelectedStatus] = useState<MediaListStatus>(
    () => (localStorage.getItem('selectedStatus') as MediaListStatus) || 'CURRENT',
  );
  const [entries, setEntries]   = useState<AnimeListEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fetchList = useCallback(async (username: string, status: MediaListStatus) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUserAnimeList(username, status);
      setEntries(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load anime list');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && userData?.name) {
      fetchList(userData.name, selectedStatus);
    }
  }, [isLoggedIn, userData?.name, selectedStatus, fetchList]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as MediaListStatus;
    setSelectedStatus(newStatus);
    localStorage.setItem('selectedStatus', newStatus);
  };

  // ── Guard states ────────────────────────────────────────────────────────────

  if (!isLoggedIn) {
    return <NotLoggedIn>Please log in to view your AniList.</NotLoggedIn>;
  }
  if (loading) return <Message>Loading…</Message>;
  if (error)   return <Message>Error: {error}</Message>;

  // ── Map AniList entries to the Anime shape CardGrid expects ─────────────────

  const animeData = entries.map((entry: AnimeListEntry) => ({
    id:            String(entry.media.id),
    malId:         null,
    image:         entry.media.coverImage.large,
    color:         entry.media.coverImage.color ?? undefined,
    title: {
      romaji:   entry.media.title.romaji,
      english:  entry.media.title.english ?? entry.media.title.romaji,
      native:   '',
      userPreferred: entry.media.title.english ?? entry.media.title.romaji,
    },
    status:        ANILIST_STATUS_LABELS[entry.media.status] ?? entry.media.status,
    rating:        entry.media.averageScore ?? 0,
    releaseDate:   entry.media.startDate.year ?? 0,
    totalEpisodes: entry.media.episodes ?? 0,
    currentEpisode: entry.progress,
    type:          entry.media.format,
    // Required fields with safe defaults
    description:   '',
    cover:         entry.media.coverImage.large,
    coverHash:     '',
    imageHash:     '',
    popularity:    0,
    duration:      0,
    season:        '',
    studios:       [],
    studioIds:     [],
    synonyms:      [],
    isLicensed:    false,
    isAdult:       false,
    countryOfOrigin: '',
    trailer:       { id: '', site: '', thumbnail: '', thumbnailHash: '' },
    startDate:     { year: entry.media.startDate.year ?? 0, month: entry.media.startDate.month ?? 0, day: entry.media.startDate.day ?? 0 },
    endDate:       { year: 0, month: 0, day: 0 },
    recommendations: [],
    characters:    [],
    relations:     [],
    mappings:      [],
    artwork:       [],
    episodes:      [],
  }));

  return (
    <Container>
      <h3>
        AniList
        <StatusDropdown value={selectedStatus} onChange={handleStatusChange}>
          {STATUS_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </StatusDropdown>
      </h3>

      {animeData.length > 0 ? (
        <CardGrid
          animeData={animeData as any}
          hasNextPage={false}
          onLoadMore={() => {}}
        />
      ) : (
        <Message>No entries found.</Message>
      )}
    </Container>
  );
};