import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { SiAnilist, SiMyanimelist } from 'react-icons/si';
import { FaArrowLeft } from 'react-icons/fa6';
import {
  CardGrid,
  StyledCardGrid,
  SkeletonCard,
  fetchStudio,
  fetchStudioJikan,
  type JikanProducer,
  type Anime,
} from '../index';
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

const fadeIn = keyframes`from { opacity: 0 } to { opacity: 1 }`;
const slideU = keyframes`from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) }`;

// ─── Design tokens (mirrors Info.tsx) ─────────────────────────────────────────

const A = {
  accent:     '#c084fc',
  accentDim:  'rgba(192,132,252,0.15)',
  text:       'var(--global-text)',
  muted:      'var(--global-text-muted)',
  card:       'var(--global-card-bg)',
  border:     'var(--global-border)',
};

// ─── Layout ───────────────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  animation: ${fadeIn} 0.4s ease;
`;

// ─── Studio header ───────────────────────────────────────────────────────────

const StudioHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.5rem 0;
  border-bottom: 1px solid #e5e7eb;
  animation: ${slideU} 0.4s ease both;
  .dark-mode & {
    border-bottom: 1px solid ${A.border};
  }
  @media (max-width: 500px) {
    gap: 0.85rem;
    padding: 1rem 0;
  }
`;

const StudioAvatar = styled.div<{ $color?: string; $imageUrl?: string }>`
  width: 64px;
  height: 64px;
  border-radius: 14px;
  background: ${({ $imageUrl, $color }) =>
    $imageUrl
      ? `url(${$imageUrl}) center/cover no-repeat, ${$color || A.accent}`
      : $color || A.accent};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.45rem;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
  letter-spacing: 0.04em;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  .dark-mode & {
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
  }
  @media (max-width: 500px) {
    width: 52px;
    height: 52px;
    font-size: 1.15rem;
    border-radius: 11px;
  }
`;

const StudioInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const Eyebrow = styled.div`
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${A.accent};
`;

const StudioName = styled.h1`
  font-size: clamp(1.5rem, 4vw, 2.1rem);
  font-weight: 800;
  line-height: 1.1;
  margin: 0;
  color: #1f2937;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  .dark-mode & {
    color: ${A.text};
  }
`;

const MetaLine = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
  color: ${A.muted};
  font-size: 0.76rem;
`;

const GhostLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: ${A.muted};
  text-decoration: none;
  font-size: 0.76rem;
  font-weight: 600;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: color 0.2s ease;
  &:hover {
    color: ${A.accent};
  }
`;

const Dot = styled.span`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: ${A.muted};
  opacity: 0.5;
  flex-shrink: 0;
`;

// Top-right corner: back action as a quiet ghost icon button
const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
`;

const IconBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: ${A.muted};
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
  &:hover {
    background: ${A.accentDim};
    color: ${A.accent};
  }
`;

// ─── Catalog ──────────────────────────────────────────────────────────────────

const CatalogSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const CatalogHeader = styled.div`
  display: flex;
  align-items: center;
`;

const SectionLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #6b7280;
  &::before {
    content: '';
    display: inline-block;
    width: 12px;
    height: 2px;
    background: ${A.accent};
    margin-right: 0.5rem;
    vertical-align: middle;
  }
  .dark-mode & {
    color: ${A.muted};
  }
`;

const TabNav = styled.div`
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar {
    display: none;
  }
  scrollbar-width: none;
  .dark-mode & {
    border-bottom: 1px solid ${A.border};
  }
`;

const Tab = styled.button<{ $active?: boolean }>`
  padding: 0.7rem 1.1rem;
  background: none;
  border: none;
  border-bottom: 2px solid
    ${({ $active }) => ($active ? A.accent : 'transparent')};
  margin-bottom: -1px;
  color: ${({ $active }) => ($active ? '#1f2937' : '#6b7280')};
  font-size: 0.78rem;
  font-weight: ${({ $active }) => ($active ? '700' : '500')};
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
  &:hover {
    color: ${A.text};
  }
  .dark-mode & {
    color: ${({ $active }) => ($active ? A.text : A.muted)};
  }
  @media (max-width: 480px) {
    padding: 0.6rem 0.8rem;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
  }
`;

const GridWrap = styled.div`
  animation: ${fadeIn} 0.25s ease;
`;

// ─── States ───────────────────────────────────────────────────────────────────

const ErrorWrap = styled.div`
  text-align: center;
  padding: 6rem 2rem;
  h2 {
    color: #f87171;
    margin-bottom: 0.75rem;
  }
  p {
    color: ${A.muted};
    margin-bottom: 2rem;
    font-size: 0.9rem;
  }
`;

const PrimaryBtn = styled.button`
  padding: 0.7rem 1.5rem;
  background: ${A.accent};
  color: #0a0a0c;
  border: none;
  border-radius: 4px;
  font-weight: 800;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
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
  const navigate = useNavigate();

  const [data, setData] = useState<StudioData | null>(null);
  const [jikanData, setJikanData] = useState<JikanProducer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<AnimeType>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch Jikan producer data for studio logo + metadata
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

  const fetchData = useCallback(
    async (page: number, append: boolean = false) => {
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
    },
    [studioId, data],
  );

  useEffect(() => {
    fetchData(1);
  }, [studioId]);

  useEffect(() => {
    if (data) {
      document.title = `${data.name} · Studio · Zenime`;
    } else {
      document.title = 'Studio · Zenime';
    }
  }, [data]);

  const handleLoadMore = () => {
    if (!loadingMore && data?.anime.hasNextPage) {
      fetchData(currentPage + 1, true);
    }
  };

  const allAnime: StudioAnimeResult[] = data ? dedupeById(data.anime.results) : [];

  const filteredAnime =
    activeType === 'ALL' ? allAnime : allAnime.filter((a) => a.type === activeType);

  if (loading && !data) {
    return <SkeletonStudio />;
  }

  if (error && !data) {
    return (
      <ErrorWrap>
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <PrimaryBtn onClick={() => navigate('/home')}>Back to Home</PrimaryBtn>
      </ErrorWrap>
    );
  }

  return (
    <Container>
      {/* ── Studio header ── */}
      {data && (
        <StudioHeader>
          <StudioAvatar
            $color={allAnime[0]?.color ?? undefined}
            $imageUrl={jikanData?.images?.jpg?.image_url || undefined}
          >
            {!jikanData?.images?.jpg?.image_url && getInitials(data.name)}
          </StudioAvatar>

          <StudioInfo>
            <Eyebrow>Studio</Eyebrow>
            <StudioName>{data.name}</StudioName>
            <MetaLine>
              {jikanData?.mal_id && (
                <>
                  <GhostLink
                    href={`https://myanimelist.net/anime/producer/${jikanData.mal_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="MyAnimeList"
                  >
                    <SiMyanimelist size={15} /> MyAnimeList
                  </GhostLink>
                  {data.siteUrl && <Dot />}
                </>
              )}
              {data.siteUrl && (
                <GhostLink
                  href={data.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="AniList"
                >
                  <SiAnilist size={15} /> AniList
                </GhostLink>
              )}
            </MetaLine>
          </StudioInfo>
        </StudioHeader>
      )}

      {/* ── Catalog ── */}
      <CatalogSection>
        <CatalogHeader>
          <SectionLabel>Full Catalog</SectionLabel>
        </CatalogHeader>

        <TabNav>
          {FILTER_TYPES.map((type) => {
            const count =
              type === 'ALL'
                ? allAnime.length
                : allAnime.filter((a) => a.type === type).length;
            if (type !== 'ALL' && count === 0) return null;
            return (
              <Tab
                key={type}
                $active={activeType === type}
                onClick={() => setActiveType(type)}
                title={`${TYPE_LABELS[type]} (${count})`}
              >
                {TYPE_LABELS[type]}
              </Tab>
            );
          })}
        </TabNav>

        <GridWrap>
          {error ? (
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
        </GridWrap>
      </CatalogSection>
    </Container>
  );
}

export default Studio;



