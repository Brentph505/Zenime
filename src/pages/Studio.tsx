import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import {
  CardGrid,
  StyledCardGrid,
  SkeletonCard,
  fetchStudio,
  fetchStudioJikan,
  type JikanProducer,
  useAuth,
} from '../index';
import type { Anime } from '../hooks/animeInterface';
import { SkeletonStudio } from '../components/Skeletons/Skeletons';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudioAnimeResult {
  id: string;
  malId: number | null;
  title: {
    romaji: string;
    english: string | null;
    native: string;
    userPreferred: string;
  };
  status: string;
  image: string;
  imageHash: string;
  cover: string;
  coverHash: string;
  popularity: number;
  description: string | null;
  rating: number | null;
  genres: string[];
  color: string | null;
  totalEpisodes: number;
  type: string;
  releaseDate: number;
  season: string;
  startDate: { year: number | null; month: number | null; day: number | null };
  isMain: boolean;
  studioIds: number[];
  studios: string[];
}

interface StudioData {
  id: number;
  name: string;
  isAnimationStudio: boolean;
  siteUrl: string;
  favourites: number;
  isFavourite: boolean;
  anime: {
    results: StudioAnimeResult[];
    currentPage: number;
    hasNextPage: boolean;
    totalPages: number;
    total: number;
  };
}

type AnimeType = 'ALL' | 'TV' | 'MOVIE' | 'ONA' | 'OVA' | 'TV_SHORT';

// ─── Animations ───────────────────────────────────────────────────────────────

const slideUp = keyframes`
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const popIn = keyframes`
  0% { opacity: 0; transform: scale(0.98); }
  100% { opacity: 1; transform: scale(1); }
`;

// ─── Layout ───────────────────────────────────────────────────────────────────

const PageLayout = styled.div`
  gap: 1rem;
  margin: 0 auto;
  max-width: 125rem;
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  animation: ${fadeIn} 0.3s ease;
`;

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HeroWrapper = styled.div`
  position: relative;
  background-color: var(--global-secondary-bg);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  animation: ${popIn} 0.35s ease;
`;

const HeroAccentBar = styled.div<{ $color?: string }>`
  height: 3px;
  width: 100%;
  background: ${({ $color }) =>
    $color
      ? `linear-gradient(90deg, ${$color}, transparent)`
      : 'linear-gradient(90deg, var(--primary-accent-bg), transparent)'};
`;

const HeroBody = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 1.5rem;
  flex-wrap: wrap;

  @media (max-width: 500px) {
    padding: 1rem;
    gap: 1rem;
  }
`;

const StudioAvatar = styled.div<{ $color?: string; $imageUrl?: string }>`
  width: 60px;
  height: 60px;
  border-radius: var(--global-border-radius);
  background: ${({ $imageUrl, $color }) =>
    $imageUrl
      ? `url(${$imageUrl}) center/cover no-repeat, ${$color || 'var(--primary-accent-bg)'}`
      : $color || 'var(--primary-accent-bg)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  font-weight: bold;
  color: #fff;
  flex-shrink: 0;
  letter-spacing: 0.05em;

  @media (max-width: 500px) {
    width: 48px;
    height: 48px;
    font-size: 1.1rem;
  }
`;

const HeroInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

// BackButton removed - was unused

const StudioName = styled.h1`
  font-size: clamp(1.4rem, 4vw, 2.2rem);
  font-weight: bold;
  color: var(--global-text);
  margin: 0;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const HeroStats = styled.div`
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;

  @media (max-width: 500px) {
    gap: 1rem;
  }
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
`;

const StatValue = styled.span`
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--primary-accent);
  line-height: 1;
`;

const StatLabel = styled.span`
  font-size: 0.65rem;
  color: var(--global-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
`;

// ─── Filters + Header ─────────────────────────────────────────────────────────

const CatalogHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const CatalogTitle = styled.div`
  font-size: 1rem;
  font-weight: bold;
  color: var(--global-text);
  text-transform: uppercase;
  letter-spacing: 0.04em;

  span {
    color: var(--primary-accent);
  }
`;

const TabContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;

  @media (max-width: 500px) {
    justify-content: center;
  }
`;

const Tab = styled.button<{ $isActive: boolean }>`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 0.6rem;
  max-width: 4.5rem;
  min-width: 4.5rem;
  border: none;
  font-weight: bold;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  background-color: ${({ $isActive }) =>
    $isActive ? 'var(--primary-accent)' : 'var(--global-div)'};
  color: var(--global-text);
  transition:
    background-color 0.2s ease,
    transform 0.2s ease-in-out;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 0.72rem;

  &:active,
  &:focus {
    transform: scale(1.025);
  }
  &:active {
    transform: scale(0.975);
  }

  &:hover {
    background-color: ${({ $isActive }) =>
      $isActive ? 'var(--primary-accent)' : 'var(--global-button-hover-bg)'};
  }

  @media (max-width: 500px) {
    padding: 0.5rem 0.75rem;
    font-size: 0.68rem;
    max-width: 3.5rem;
    min-width: 3.5rem;
  }
`;

const Section = styled.section`
  border-radius: var(--global-border-radius);
  animation: ${slideUp} 0.3s ease;
`;

const ErrorMessage = styled.div`
  padding: 1rem;
  background-color: #ffdddd;
  border-left: 4px solid #f44336;
  color: #f44336;
  border-radius: var(--global-border-radius);

  p {
    margin: 0;
    font-weight: bold;
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function dedupeById(results: StudioAnimeResult[]): StudioAnimeResult[] {
  const seen = new Set<string>();
  return results.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

const TYPE_LABELS: Record<AnimeType, string> = {
  ALL: 'All',
  TV: 'TV',
  MOVIE: 'Movie',
  ONA: 'ONA',
  OVA: 'OVA',
  TV_SHORT: 'Short',
};

const FILTER_TYPES: AnimeType[] = ['ALL', 'TV', 'MOVIE', 'ONA', 'OVA', 'TV_SHORT'];

// ─── Component ────────────────────────────────────────────────────────────────

function Studio() {
  const { studioId } = useParams<{ studioId: string }>();

  // User authentication data
  const { isLoggedIn, userData } = useAuth();

  const [data, setData] = useState<StudioData | null>(null);
  const [jikanData, setJikanData] = useState<JikanProducer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<AnimeType>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch Jikan producer data for studio logo
  useEffect(() => {
    if (!studioId) return;

    const fetchJikanData = async () => {
      try {
        const result = await fetchStudioJikan(studioId);
        setJikanData(result);
      } catch (err) {
        console.error('Failed to fetch Jikan studio data:', err);
      }
    };

    fetchJikanData();
  }, [studioId]);

  const fetchData = useCallback(async (page: number, append: boolean = false) => {
    if (!studioId) {
      setError('Studio ID not found');
      setLoading(false);
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await fetchStudio(studioId, page, 20, 'kickassanime');
      if (append && data) {
        // Append new results to existing data
        setData({
          ...result,
          anime: {
            ...result.anime,
            results: [...data.anime.results, ...result.anime.results],
          },
        });
      } else {
        setData(result);
      }
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load studio data');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [studioId, data]);

  useEffect(() => {
    fetchData(1);
  }, [studioId]);

  useEffect(() => {
    if (data) {
      document.title = `${data.name} | Studio Catalog`;
    }
  }, [data]);

  const handleLoadMore = () => {
    if (!loadingMore && data?.anime.hasNextPage) {
      fetchData(currentPage + 1, true);
    }
  };

  const allAnime: StudioAnimeResult[] = data ? dedupeById(data.anime.results) : [];

  const filteredAnime =
    activeType === 'ALL'
      ? allAnime
      : allAnime.filter((a) => a.type === activeType);

  const totalCount = data?.anime.total ?? 0;
  const airingCount = allAnime.filter((a) => a.status === 'Ongoing').length;

  if (loading && !data) {
    return <SkeletonStudio />;
  }

  return (
    <PageLayout>
      {error && (
        <ErrorMessage>
          <p>ERROR: {error}</p>
        </ErrorMessage>
      )}

      {/* ── Hero ── */}
      {data && (
        <HeroWrapper>
          <HeroAccentBar />
          <HeroBody>

            <StudioAvatar
              $color={allAnime[0]?.color ?? undefined}
              $imageUrl={jikanData?.images?.jpg?.image_url || undefined}
            >
              {/* Always show logo if available, otherwise initials */}
              {!jikanData?.images?.jpg?.image_url && getInitials(data.name)}
            </StudioAvatar>

            <HeroInfo>
              {/* Removed Back to watch button */}
              <StudioName>{data.name}</StudioName>
              <HeroStats>
                <Stat>
                  <StatValue>{totalCount}</StatValue>
                  <StatLabel>Total Anime</StatLabel>
                </Stat>
                <Stat>
                  <StatValue>{data.favourites.toLocaleString()}</StatValue>
                  <StatLabel>Favourites</StatLabel>
                </Stat>
                {airingCount > 0 && (
                  <Stat>
                    <StatValue>{airingCount}</StatValue>
                    <StatLabel>Airing Now</StatLabel>
                  </Stat>
                )}
              </HeroStats>
            </HeroInfo>
          </HeroBody>
        </HeroWrapper>
      )}

      {/* ── Catalog Header + Type Filters ── */}
      <CatalogHeader>
        <CatalogTitle>
          Full Catalog{' '}
          <span>·</span>{' '}
          {totalCount} anime
        </CatalogTitle>

        <TabContainer>
          {FILTER_TYPES.map((type) => {
            const count =
              type === 'ALL'
                ? allAnime.length
                : allAnime.filter((a) => a.type === type).length;
            if (type !== 'ALL' && count === 0) return null;
            return (
              <Tab
                key={type}
                $isActive={activeType === type}
                onClick={() => setActiveType(type)}
                title={`${TYPE_LABELS[type]} (${count})`}
              >
                {TYPE_LABELS[type]}
              </Tab>
            );
          })}
        </TabContainer>
      </CatalogHeader>

      {/* ── Grid ── */}
      <Section>
        {(loading || error) && !data ? (
          <StyledCardGrid>
            {Array.from({ length: 17 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </StyledCardGrid>
        ) : (
          <CardGrid
            animeData={filteredAnime as unknown as Anime[]}
            hasNextPage={data?.anime.hasNextPage ?? false}
            onLoadMore={handleLoadMore}
          />
        )}
        {loadingMore && (
          <StyledCardGrid>
            {Array.from({ length: 8 }, (_, i) => (
              <SkeletonCard key={`loading-${i}`} />
            ))}
          </StyledCardGrid>
        )}
      </Section>
    </PageLayout>
  );
}

export default Studio;