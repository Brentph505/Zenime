import { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  HomeCarousel,
  CardGrid,
  StyledCardGrid,
  SkeletonSlide,
  SkeletonCard,
  fetchTrendingAnime,
  fetchPopularAnime,
  fetchTopAnime,
  fetchTopAiringAnime,
  fetchUpcomingSeasons,
  fetchRecentEpisodes,
  HomeSideBar,
  EpisodeCard,
  getNextSeason,
  time,
  Paging,
  Anime,
  Episode,
} from '../index';
import AnimeSchedule from '../components/Home/AnimeSchedule';

const SimpleLayout = styled.div`
  gap: 1rem;
  margin: 0 auto;
  max-width: 125rem;
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
`;

const ContentSidebarLayout = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;

  @media (min-width: 1000px) {
    flex-direction: row;
    justify-content: space-between;
  }
`;

const TabContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-radius: var(--global-border-radius);
  width: 100%;
`;

const TabScrollArea = styled.div`
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: visible;
  white-space: nowrap;
  scrollbar-width: none;
  -ms-overflow-style: none;
  flex: 1;
  min-width: 0;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const TabGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
`;

const Tab = styled.div<{ $isActive: boolean }>`
  background: ${({ $isActive }) =>
    $isActive ? 'var(--primary-accent)' : 'transparent'};
  border: 1px solid ${({ $isActive }) =>
    $isActive ? 'var(--primary-accent)' : 'var(--global-border, rgba(0,0,0,0.1))'};
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-weight: bold;
  color: var(--global-text);
  position: relative;
  overflow: hidden;
  margin: 0;
  font-size: 0.75rem;
  padding: 0.45rem 0.85rem;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background-color 0.2s ease, border-color 0.2s ease;

  &:hover,
  &:active,
  &:focus {
    background: var(--primary-accent);
    border-color: var(--primary-accent);
  }

  @media (max-width: 500px) {
    padding: 0.4rem 0.7rem;
    font-size: 0.7rem;
  }
`;

const PagingControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  border: 1px solid var(--global-border, rgba(0,0,0,0.1));
  border-radius: var(--global-border-radius);
  padding: 0.3rem 0.5rem;
  margin-left: 0.4rem;

  @media (max-width: 500px) {
    padding: 0.35rem 0.5rem;
    gap: 0.35rem;
  }
`;

const PageButton = styled.button<{ $disabled?: boolean }>`
  background: transparent;
  border: none;
  border-radius: var(--global-border-radius);
  color: ${({ $disabled }) =>
    $disabled ? 'var(--global-text-muted, #555)' : 'var(--global-text)'};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  font-size: 0.95rem;
  line-height: 1;
  padding: 0.25rem 0.45rem;
  transition: background-color 0.2s ease;
  opacity: ${({ $disabled }) => ($disabled ? 0.35 : 1)};

  &:hover:not(:disabled) {
    background: var(--primary-accent);
  }

  @media (max-width: 500px) {
    padding: 0.3rem 0.5rem;
    font-size: 1rem;
  }
`;

const PageNumber = styled.span`
  font-size: 0.8rem;
  font-weight: bold;
  color: var(--global-text);
  min-width: 1.2rem;
  text-align: center;
  user-select: none;

  @media (max-width: 500px) {
    font-size: 0.75rem;
    min-width: 1rem;
  }
`;

const Section = styled.section`
  padding: 0rem;
  border-radius: var(--global-border-radius);
`;

const ErrorMessage = styled.div`
  padding: 1rem;
  margin: 1rem 0;
  background-color: #ffdddd;
  border-left: 4px solid #f44336;
  color: #f44336;
  border-radius: var(--global-border-radius);

  p {
    margin: 0;
    font-weight: bold;
  }
`;

interface TabPaging {
  page: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const defaultPaging: TabPaging = { page: 1, hasNext: false, hasPrev: false };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeEpisodeToAnime = (ep: any): Anime => ({
  ...ep,
  currentEpisode: ep.currentEpisodeCount ?? ep.episodeNumber ?? 0,
  trailer: ep.trailer ?? { id: '', site: '', thumbnail: '', thumbnailHash: '' },
  synonyms: ep.synonyms ?? [],
  isLicensed: ep.isLicensed ?? false,
  isAdult: ep.isAdult ?? false,
  countryOfOrigin: ep.countryOfOrigin ?? '',
  cover: ep.cover ?? '',
  coverHash: ep.coverHash ?? '',
  description: ep.description ?? '',
  releaseDate: ep.releaseDate ?? 0,
  duration: ep.duration ?? 0,
  studios: ep.studios ?? [],
  studioIds: ep.studioIds ?? [],
  season: ep.season ?? '',
  startDate: ep.startDate ?? { year: 0, month: 0, day: 0 },
  endDate: ep.endDate ?? { year: 0, month: 0, day: 0 },
  recommendations: ep.recommendations ?? [],
  characters: ep.characters ?? [],
  relations: ep.relations ?? [],
  mappings: ep.mappings ?? [],
  artwork: ep.artwork ?? [],
  episodes: ep.episodes ?? [],
  color: ep.color ?? '#999999',
});

const loadingKeyMap: Record<string, 'trending' | 'popular' | 'topRated' | 'topAiring' | 'Upcoming' | 'latest'> = {
  trending: 'trending',
  popular: 'popular',
  topRated: 'topRated',
  latest: 'latest',
};

const Home = () => {
  const [itemsCount, setItemsCount] = useState(
    window.innerWidth > 500 ? 24 : 15,
  );

  const [activeTab, setActiveTab] = useState(() => {
    const now = Date.now();
    const savedData = localStorage.getItem('home tab');
    if (savedData) {
      const { tab, timestamp } = JSON.parse(savedData);
      if (now - timestamp < 300000) return tab;
      localStorage.removeItem('home tab');
    }
    return 'trending';
  });

  const [state, setState] = useState({
    watchedEpisodes: [] as Episode[],
    trendingAnime: [] as Anime[],
    popularAnime: [] as Anime[],
    topAnime: [] as Anime[],
    topAiring: [] as Anime[],
    Upcoming: [] as Anime[],
    latestAnime: [] as Anime[],
    error: null as string | null,
    // ✅ FIX: All tabs start as loading=true so the skeleton shows
    // immediately and nothing races against an "empty + not loading" check.
    loading: {
      trending: true,
      popular: true,
      topRated: true,
      topAiring: true,
      Upcoming: true,
      latest: true,
    },
  });

  const [paging, setPaging] = useState<Record<string, TabPaging>>({
    trending: defaultPaging,
    popular: defaultPaging,
    topRated: defaultPaging,
    latest: defaultPaging,
  });

  useEffect(() => {
    const handleResize = () =>
      setItemsCount(window.innerWidth > 500 ? 24 : 15);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const watchedEpisodesData = localStorage.getItem('watched-episodes');
    if (watchedEpisodesData) {
      const allEpisodes = JSON.parse(watchedEpisodesData);
      const latestEpisodes: Episode[] = Object.keys(allEpisodes).map(
        (id) => allEpisodes[id][allEpisodes[id].length - 1],
      );
      setState((prev) => ({ ...prev, watchedEpisodes: latestEpisodes }));
    }
  }, []);

  // ✅ FIX: Single source of truth for page-1 data. Removed the second
  // useEffect that watched activeTab and tried to re-fetch page 1 — it was
  // the source of the race condition. The initial fetch below covers all tabs.
  useEffect(() => {
    const fetchCount = Math.ceil(itemsCount * 1.4);

    const fetchData = async () => {
      try {
        setState((prev) => ({ ...prev, error: null }));

        const [trending, popular, topRated, topAiring, Upcoming, latest] =
          await Promise.all([
            fetchTrendingAnime(1, fetchCount),
            fetchPopularAnime(1, fetchCount),
            fetchTopAnime(1, fetchCount),
            fetchTopAiringAnime(1, 6),
            fetchUpcomingSeasons(1, 6),
            fetchRecentEpisodes(1, fetchCount, 'kickassanime'),
          ]);

        const trim = (p: Paging) => p.results.slice(0, itemsCount);

        setState((prev) => ({
          ...prev,
          trendingAnime: trim(trending),
          popularAnime: trim(popular),
          topAnime: trim(topRated),
          topAiring: trim(topAiring),
          Upcoming: trim(Upcoming),
          latestAnime: trim(latest).map(normalizeEpisodeToAnime),
        }));

        setPaging({
          trending: { page: 1, hasNext: trending.hasNextPage ?? false, hasPrev: false },
          popular:  { page: 1, hasNext: popular.hasNextPage  ?? false, hasPrev: false },
          topRated: { page: 1, hasNext: topRated.hasNextPage ?? false, hasPrev: false },
          latest:   { page: 1, hasNext: latest.hasNextPage   ?? false, hasPrev: false },
        });
      } catch {
        setState((prev) => ({ ...prev, error: 'An unexpected error occurred' }));
      } finally {
        setState((prev) => ({
          ...prev,
          loading: {
            trending: false,
            popular: false,
            topRated: false,
            topAiring: false,
            Upcoming: false,
            latest: false,
          },
        }));
      }
    };

    fetchData();
  }, [itemsCount]);

  useEffect(() => {
    document.title = `Zenime | Watch Anime Online, Free Anime Streaming`;
  }, [activeTab]);

  useEffect(() => {
    const tabData = JSON.stringify({ tab: activeTab, timestamp: time });
    localStorage.setItem('home tab', tabData);
  }, [activeTab]);

  // ✅ FIX: fetchTabPage is only used for explicit page-change navigation (prev/next).
  // It no longer needs to be called on tab switch because the initial fetch
  // already populates page 1 for every tab before loading=false is set.
  const fetchTabPage = async (tab: string, page: number, count: number) => {
    const fetchCount = Math.ceil(count * 1.4);
    const fetchers: Record<string, (p: number, c: number) => Promise<Paging>> = {
      trending: fetchTrendingAnime,
      popular: fetchPopularAnime,
      topRated: fetchTopAnime,
      latest: (p, c) => fetchRecentEpisodes(p, c, 'kickassanime'),
    };

    const fetcher = fetchers[tab];
    if (!fetcher) return;

    const loadingKey = loadingKeyMap[tab];

    setState((prev) => ({
      ...prev,
      loading: { ...prev.loading, [loadingKey]: true },
    }));

    try {
      const result = await fetcher(page, fetchCount);
      const raw = result.results.slice(0, count);
      const trimmed = tab === 'latest' ? raw.map(normalizeEpisodeToAnime) : raw;

      const dataKey: Record<string, string> = {
        trending: 'trendingAnime',
        popular: 'popularAnime',
        topRated: 'topAnime',
        latest: 'latestAnime',
      };

      setState((prev) => ({ ...prev, [dataKey[tab]]: trimmed }));
      setPaging((prev) => ({
        ...prev,
        [tab]: {
          page,
          hasNext: result.hasNextPage ?? false,
          hasPrev: page > 1,
        },
      }));
    } catch {
      setState((prev) => ({ ...prev, error: 'An unexpected error occurred' }));
    } finally {
      setState((prev) => ({
        ...prev,
        loading: { ...prev.loading, [loadingKey]: false },
      }));
    }
  };

  const handlePageChange = (tab: string, direction: 'prev' | 'next') => {
    const current = paging[tab];
    if (!current) return;
    const newPage = direction === 'next' ? current.page + 1 : current.page - 1;
    if (newPage < 1) return;
    fetchTabPage(tab, newPage, itemsCount);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderCardGrid = (
    animeData: Anime[],
    isLoading: boolean,
    hasError: boolean,
  ) => {
    return (
      <Section>
        {isLoading || hasError ? (
          <StyledCardGrid>
            {Array.from({ length: itemsCount }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </StyledCardGrid>
        ) : (
          <CardGrid animeData={animeData} hasNextPage={false} onLoadMore={() => {}} />
        )}
      </Section>
    );
  };

  const tabDataMap: Record<string, Anime[]> = {
    trending: state.trendingAnime,
    popular: state.popularAnime,
    topRated: state.topAnime,
    latest: state.latestAnime,
  };

  const SEASON = getNextSeason();
  const activePaging = paging[activeTab] ?? defaultPaging;
  const activeLoading = state.loading[loadingKeyMap[activeTab]];

  const TABS = [
    { key: 'trending', label: 'TRENDING' },
    { key: 'popular',  label: 'POPULAR'  },
    { key: 'topRated', label: 'TOP RATED' },
    { key: 'latest',   label: 'LATEST'   },
  ];

  return (
    <SimpleLayout>
      {state.error && (
        <ErrorMessage title='Error Message'>
          <p>ERROR: {state.error}</p>
        </ErrorMessage>
      )}
      {state.loading.trending || state.error ? (
        <SkeletonSlide />
      ) : (
        <HomeCarousel
          data={state.trendingAnime}
          loading={state.loading.trending}
          error={state.error}
        />
      )}
      <EpisodeCard />
      <ContentSidebarLayout>
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap: '1rem', minWidth: 0 }}>

          <TabContainer>
            <TabScrollArea>
              <TabGroup>
                {TABS.map(({ key, label }) => (
                  <Tab
                    key={key}
                    title={`${label} Tab`}
                    $isActive={activeTab === key}
                    onClick={() => setActiveTab(key)}
                  >
                    {label}
                  </Tab>
                ))}
              </TabGroup>
            </TabScrollArea>

            <PagingControls>
              <PageButton
                $disabled={!activePaging.hasPrev || activeLoading}
                disabled={!activePaging.hasPrev || activeLoading}
                onClick={() => handlePageChange(activeTab, 'prev')}
                title='Previous page'
              >
                ‹
              </PageButton>
              <PageNumber>{activePaging.page}</PageNumber>
              <PageButton
                $disabled={!activePaging.hasNext || activeLoading}
                disabled={!activePaging.hasNext || activeLoading}
                onClick={() => handlePageChange(activeTab, 'next')}
                title='Next page'
              >
                ›
              </PageButton>
            </PagingControls>
          </TabContainer>

          {renderCardGrid(
            tabDataMap[activeTab] ?? [],
            activeLoading,
            !!state.error,
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', padding: '0.75rem 0' }}>
            TOP AIRING
          </div>
          <HomeSideBar animeData={state.topAiring} />
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', padding: '0.75rem 0' }}>
            UPCOMING {SEASON}
          </div>
          <HomeSideBar animeData={state.Upcoming} />
        </div>
      </ContentSidebarLayout>

      <div style={{ width: '100%', marginTop: '2rem', boxSizing: 'border-box' }}>
        <AnimeSchedule />
      </div>
    </SimpleLayout>
  );
};

export default Home;