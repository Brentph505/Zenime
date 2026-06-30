import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../client/useAuth';
import { type AnimeListEntry, type MediaListStatus } from '../../client/authService';
import { useUserMediaList } from '../../hooks/useUserAnimeList';
import { ANILIST_ENTRY_CHANGED_EVENT } from '../../hooks/useAniListEntry';
import { CardGrid, EditEntryModal } from '../../index';
import type { Anime } from '../../index';

type MediaTab = 'anime' | 'manga';

const ANIME_STATUS_OPTIONS: { value: MediaListStatus; label: string }[] = [
  { value: 'CURRENT',   label: 'Watching' },
  { value: 'PLANNING',  label: 'Plan to Watch' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REPEATING', label: 'Re-watching' },
  { value: 'PAUSED',    label: 'Paused' },
  { value: 'DROPPED',    label: 'Dropped' },
];

const MANGA_STATUS_OPTIONS: { value: MediaListStatus; label: string }[] = [
  { value: 'CURRENT',   label: 'Reading' },
  { value: 'PLANNING',  label: 'Plan to Read' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REPEATING', label: 'Re-reading' },
  { value: 'PAUSED',    label: 'Paused' },
  { value: 'DROPPED',    label: 'Dropped' },
];

const TAB_OPTIONS: { value: MediaTab; label: string }[] = [
  { value: 'anime', label: 'Anime' },
  { value: 'manga', label: 'Manga' },
];

const ANILIST_STATUS_LABELS: Record<string, string> = {
  FINISHED: 'Completed',
  RELEASING: 'Ongoing',
  NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED: 'Cancelled',
  HIATUS: 'On hiatus',
};

const Container = styled.div`
  margin-top: 0.75rem;
  margin-bottom: 1rem;

  @media (max-width: 600px) {
    margin-top: 0.5rem;
    margin-bottom: 0.75rem;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
`;

const HeadingGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  @media (max-width: 600px) {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
  color: var(--global-text);

  @media (max-width: 600px) {
    font-size: 0.9rem;
  }
`;

const SectionSubtext = styled.p`
  margin: 0;
  font-size: 0.78rem;
  color: var(--global-text-muted);
  flex: 1;
  text-align: right;

  @media (min-width: 601px) {
    text-align: left;
  }

  @media (max-width: 400px) {
    display: none;
  }
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;

  @media (max-width: 600px) {
    flex-direction: column;
    gap: 0.4rem;
  }
`;

const TabGroup = styled.div`
  display: flex;
  gap: 0.35rem;
  padding: 0.25rem;
  border-radius: 999px;
  background: var(--global-card-bg);
  border: 1px solid var(--global-border);
  flex-shrink: 0;
  align-self: flex-start;

  @media (max-width: 600px) {
    width: 100%;
    justify-content: center;
    align-self: stretch;
  }
`;

const TabButton = styled.button<{ $active: boolean }>`
  border: none;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  color: ${({ $active }) => ($active ? '#fff' : 'var(--global-text-muted)')};
  background: ${({ $active }) => ($active ? 'var(--primary-accent)' : 'transparent')};
  min-width: 5.5rem;
  transition: all 0.2s ease;

  @media (max-width: 600px) {
    flex: 1;
    min-width: 0;
    padding: 0.4rem 0.6rem;
  }
`;

const SearchAndStatusRow = styled.div`
  display: flex;
  gap: 0.5rem;
  width: 100%;

  @media (max-width: 600px) {
    width: 100%;
  }
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 0.6rem 0.75rem;
  border-radius: var(--global-border-radius);
  border: 1px solid var(--global-border);
  background: var(--global-secondary-bg);
  color: var(--global-text);
  outline: none;
  font-size: 0.85rem;

  @media (min-width: 601px) {
    width: 240px;
    flex: none;
  }

  @media (max-width: 600px) {
    padding: 0.5rem 0.65rem;
    font-size: 0.8rem;
  }

  &::placeholder {
    color: var(--global-text-muted);
    font-size: 0.8rem;

    @media (max-width: 600px) {
      font-size: 0.75rem;
    }
  }
`;

const StatusDropdown = styled.select`
  padding: 0.6rem 0.75rem;
  border-radius: var(--global-border-radius);
  background-color: var(--global-secondary-bg);
  color: var(--global-text);
  border: 1px solid var(--global-border);
  cursor: pointer;
  font-size: 0.85rem;

  @media (min-width: 601px) {
    width: 160px;
  }

  @media (max-width: 600px) {
    width: 140px;
    flex-shrink: 0;
    padding: 0.5rem 0.65rem;
    font-size: 0.8rem;
  }

  @media (max-width: 350px) {
    width: 120px;
    font-size: 0.75rem;
  }
`;

const Message = styled.div`
  margin: 1.5rem 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1rem;
  font-weight: 600;
  color: var(--global-text-muted);
  padding: 2rem 1rem;

  @media (max-width: 600px) {
    margin: 1rem 0;
    font-size: 0.9rem;
    padding: 1.5rem 0.75rem;
  }
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
    margin: 2rem 0.5rem;
    padding: 1.5rem 1rem;
    font-size: 0.95rem;
    font-weight: 600;
  }

  @media (max-width: 400px) {
    margin: 1.5rem 0.25rem;
    font-size: 0.85rem;
  }
`;

export const WatchingAnilist = () => {
  const { isLoggedIn, userData } = useAuth();

  const [activeTab, setActiveTab] = useState<MediaTab>('anime');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusAnime, setSelectedStatusAnime] = useState<MediaListStatus>(
    () => (localStorage.getItem('selectedStatusAnime') as MediaListStatus) || 'CURRENT',
  );
  const [selectedStatusManga, setSelectedStatusManga] = useState<MediaListStatus>(
    () => (localStorage.getItem('selectedStatusManga') as MediaListStatus) || 'CURRENT',
  );
  const [editingAnime, setEditingAnime] = useState<Anime | null>(null);

  const selectedStatus = activeTab === 'anime' ? selectedStatusAnime : selectedStatusManga;

  const animeList = useUserMediaList(
    isLoggedIn ? userData?.name : undefined,
    selectedStatusAnime,
    'ANIME',
  );
  const mangaList = useUserMediaList(
    isLoggedIn ? userData?.name : undefined,
    selectedStatusManga,
    'MANGA',
  );

  const activeList = activeTab === 'anime' ? animeList : mangaList;

  useEffect(() => {
    const handler = () => {
      void animeList.refresh();
      void mangaList.refresh();
    };
    window.addEventListener(ANILIST_ENTRY_CHANGED_EVENT, handler);
    return () => window.removeEventListener(ANILIST_ENTRY_CHANGED_EVENT, handler);
  }, [animeList.refresh, mangaList.refresh]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as MediaListStatus;
    if (activeTab === 'anime') {
      setSelectedStatusAnime(newStatus);
      localStorage.setItem('selectedStatusAnime', newStatus);
    } else {
      setSelectedStatusManga(newStatus);
      localStorage.setItem('selectedStatusManga', newStatus);
    }
  };

  const handleTabChange = (tab: MediaTab) => {
    setActiveTab(tab);
    setSearchTerm('');
  };

  const mappedData = useMemo(() => {
    const filteredEntries = activeList.entries.filter((entry: AnimeListEntry) => {
      const search = searchTerm.trim().toLowerCase();
      if (!search) return true;
      const title = `${entry.media.title.english ?? ''} ${entry.media.title.romaji ?? ''}`.toLowerCase();
      return title.includes(search);
    });

    return filteredEntries.map((entry: AnimeListEntry) => ({
      id: String(entry.media.id),
      malId: null,
      image: entry.media.coverImage.large,
      color: entry.media.coverImage.color ?? undefined,
      title: {
        romaji: entry.media.title.romaji,
        english: entry.media.title.english ?? entry.media.title.romaji,
        native: '',
        userPreferred: entry.media.title.english ?? entry.media.title.romaji,
      },
      status: ANILIST_STATUS_LABELS[entry.media.status] ?? entry.media.status,
      rating: entry.media.averageScore ?? 0,
      releaseDate: entry.media.startDate.year ?? 0,
      totalEpisodes: entry.media.episodes ?? entry.media.chapters ?? 0,
      currentEpisode: entry.progress,
      type: entry.media.type === 'MANGA' ? 'MANGA' : entry.media.format,
      description: '',
      cover: entry.media.coverImage.large,
      coverHash: '',
      imageHash: '',
      popularity: 0,
      duration: 0,
      season: '',
      studios: [],
      studioIds: [],
      synonyms: [],
      isLicensed: false,
      isAdult: false,
      countryOfOrigin: '',
      trailer: { id: '', site: '', thumbnail: '', thumbnailHash: '' },
      startDate: {
        year: entry.media.startDate.year ?? 0,
        month: entry.media.startDate.month ?? 0,
        day: entry.media.startDate.day ?? 0,
      },
      endDate: { year: 0, month: 0, day: 0 },
      recommendations: [],
      characters: [],
      relations: [],
      mappings: [],
      artwork: [],
      episodes: [],
    }));
  }, [activeList.entries, searchTerm]);

  return (
    <Container>
      <HeaderRow>
        <HeadingGroup>
          <SectionTitle>AniList Library</SectionTitle>
          <SectionSubtext>
            Search your saved {activeTab === 'anime' ? 'anime' : 'manga'} and switch list status.
          </SectionSubtext>
        </HeadingGroup>

        <Toolbar>
          <TabGroup>
            {TAB_OPTIONS.map(({ value, label }) => (
              <TabButton
                key={value}
                $active={activeTab === value}
                onClick={() => handleTabChange(value)}
              >
                {label}
              </TabButton>
            ))}
          </TabGroup>

          <SearchAndStatusRow>
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${activeTab === 'anime' ? 'anime' : 'manga'}...`}
            />
            <StatusDropdown value={selectedStatus} onChange={handleStatusChange}>
              {(activeTab === 'anime' ? ANIME_STATUS_OPTIONS : MANGA_STATUS_OPTIONS).map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </StatusDropdown>
          </SearchAndStatusRow>
        </Toolbar>
      </HeaderRow>

      {activeList.loading ? (
        <Message>Loading…</Message>
      ) : activeList.error ? (
        <Message>Error: {activeList.error}</Message>
      ) : mappedData.length > 0 ? (
        <CardGrid
          animeData={mappedData as any}
          hasNextPage={false}
          onLoadMore={() => {}}
          showEditButton={true}
          onEdit={(anime) => setEditingAnime(anime)}
        />
      ) : (
        <Message>No {activeTab === 'anime' === 'anime' ? 'anime' : 'manga'} entries found.</Message>
      )}

      {editingAnime && (
        <EditEntryModal
          anime={editingAnime}
          isOpen={true}
          onClose={() => setEditingAnime(null)}
        />
      )}
    </Container>
  );
};
