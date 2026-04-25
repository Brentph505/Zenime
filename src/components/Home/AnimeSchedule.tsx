import { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Link } from 'react-router-dom';
import { fetchAiringSchedule, AniListAiringItem } from '../../hooks/useApi';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScheduleItem {
  id: string;
  airingAt: number;
  episode: number;
  title: string;
  englishTitle: string | null;
  romajiTitle: string;
  image: string;
  color: string | null;
  type: string;
  format: string;
  rating: number | null;
  genres: string[];
  countryOfOrigin: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date / Time helpers  (all LOCAL timezone — adapts wherever the user is)
// ─────────────────────────────────────────────────────────────────────────────

const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Short day abbreviation for a given offset from today in LOCAL time.
 * dayOffset = 0 → today's day name, 1 → tomorrow's, etc.
 */
function getDayAbbr(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return DAY_ABBRS[d.getDay()];
}

/**
 * Returns a short date label like "Apr 26" for a given day offset.
 */
function getShortDate(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Formats a Unix timestamp (seconds) as HH:MM in the user's LOCAL timezone.
 */
function formatLocalTime(unixSeconds: number): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(unixSeconds * 1000));
  } catch {
    return '--:--';
  }
}

/**
 * Maps a raw AniListAiringItem to the leaner ScheduleItem shape the UI uses.
 */
function mapToScheduleItem(raw: AniListAiringItem): ScheduleItem {
  const { media } = raw;
  return {
    id: String(media.id),
    airingAt: raw.airingAt,
    episode: raw.episode,
    title: media.title.userPreferred || media.title.romaji || 'Unknown',
    englishTitle: media.title.english ?? null,
    romajiTitle: media.title.romaji || 'Unknown',
    image: media.coverImage.large || media.coverImage.medium || '',
    color: media.coverImage.color ?? null,
    type: media.type ?? 'ANIME',
    format: media.format ?? '',
    rating: media.averageScore ?? null,
    genres: media.genres ?? [],
    countryOfOrigin: media.countryOfOrigin ?? '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Styled components
// ─────────────────────────────────────────────────────────────────────────────

const ScheduleRoot = styled.section`
  width: 100%;
  background: var(--global-card-bg);
  border-radius: var(--global-border-radius);
  padding: 1.5rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;

  @media (max-width: 640px) {
    padding: 1rem;
  }
`;

const ScheduleHeader = styled.div`
  margin-bottom: 1.5rem;

  @media (max-width: 640px) {
    margin-bottom: 1rem;
  }
`;

const ScheduleSubtitle = styled.span`
  font-size: 0.8rem;
  color: var(--global-text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: block;
  margin-bottom: 0.2rem;

  @media (max-width: 640px) {
    font-size: 0.7rem;
  }
`;

const ScheduleTitle = styled.h2`
  font-size: 1.625rem;
  font-weight: 700;
  color: var(--global-text);
  margin: 0;
  letter-spacing: -0.02em;

  @media (max-width: 640px) {
    font-size: 1.25rem;
  }
`;

const DayNav = styled.nav`
  display: flex;
  align-items: flex-end;
  gap: 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--global-border);
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
  scrollbar-width: thin;
  scrollbar-color: var(--global-border) transparent;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--global-border);
    border-radius: 2px;
  }

  @media (max-width: 640px) {
    margin-bottom: 1rem;
    -webkit-overflow-scrolling: touch;
  }
`;

const DayButton = styled.button<{ $isActive: boolean }>`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem 0.875rem 0.875rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-bottom: ${({ $isActive }) =>
    $isActive ? '2px solid var(--primary-accent)' : 'none'};
  margin-bottom: ${({ $isActive }) => ($isActive ? '-1px' : '0')};
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    opacity: 0.8;
  }

  @media (max-width: 640px) {
    padding: 0.4rem 0.5rem 0.6rem;
    gap: 0.15rem;
    min-width: fit-content;
  }
`;

const DayLabel = styled.span<{ $isActive: boolean }>`
  font-size: ${({ $isActive }) => ($isActive ? '1.625rem' : '1.0625rem')};
  font-weight: ${({ $isActive }) => ($isActive ? '700' : '400')};
  color: ${({ $isActive }) =>
    $isActive ? 'var(--global-text)' : 'var(--global-text-muted)'};
  letter-spacing: 0.01em;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  line-height: 1;

  @media (max-width: 640px) {
    font-size: ${({ $isActive }) => ($isActive ? '0.875rem' : '0.7rem')};
  }
`;

const DateLabel = styled.span`
  font-size: 0.6875rem;
  color: var(--primary-accent);
  letter-spacing: 0.04em;
  line-height: 1;
  font-weight: 500;

  @media (max-width: 640px) {
    font-size: 0.5rem;
    letter-spacing: 0.02em;
  }
`;

const ScheduleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
`;

const EmptyState = styled.div`
  padding: 3rem 0.75rem;
  color: var(--global-text-muted);
  font-size: 0.875rem;
  text-align: center;

  @media (max-width: 640px) {
    padding: 2rem 0.5rem;
    font-size: 0.8rem;
  }
`;

const ViewMoreButton = styled.button`
  width: 100%;
  padding: 0.75rem 1rem;
  margin-top: 1rem;
  background: transparent;
  border: 1px solid var(--global-border);
  color: var(--global-text-muted);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: var(--global-tertiary-bg);
    color: var(--global-text);
    border-color: var(--primary-accent);
  }

  @media (max-width: 640px) {
    padding: 0.6rem 0.8rem;
    font-size: 0.8rem;
    margin-top: 0.75rem;
  }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
`;

const SkeletonRow = styled.div`
  display: flex;
  align-items: center;
  padding: 0.875rem 0;
  gap: 1rem;
  border-bottom: 1px solid var(--global-border);
  animation: ${pulse} 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;

  @media (max-width: 640px) {
    padding: 0.75rem 0;
    gap: 0.75rem;
  }
`;

const SkeletonTime = styled.div`
  width: 3.5rem;
  height: 1rem;
  background: var(--global-tertiary-bg);
  border-radius: 0.25rem;
  flex-shrink: 0;
`;

const SkeletonImage = styled.div`
  width: 3.5rem;
  height: 4.5rem;
  background: var(--global-tertiary-bg);
  border-radius: 0.375rem;
  flex-shrink: 0;

  @media (max-width: 640px) {
    width: 2.75rem;
    height: 3.75rem;
  }
`;

const SkeletonContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
`;

const SkeletonTitleLine = styled.div`
  height: 1rem;
  background: var(--global-tertiary-bg);
  border-radius: 0.25rem;
  width: 80%;
`;

const SkeletonRomajiLine = styled.div`
  height: 0.75rem;
  background: var(--global-tertiary-bg);
  border-radius: 0.25rem;
  width: 60%;
`;

const SkeletonMetaLine = styled.div`
  height: 0.65rem;
  background: var(--global-tertiary-bg);
  border-radius: 0.25rem;
  width: 30%;
`;

const SkeletonRating = styled.div`
  width: 2rem;
  height: 1rem;
  background: var(--global-tertiary-bg);
  border-radius: 0.25rem;
  flex-shrink: 0;
`;

const ScheduleRow = styled(Link)`
  display: flex;
  align-items: center;
  padding: 0.875rem 0;
  gap: 1rem;
  border-bottom: 1px solid var(--global-border);
  transition: background 0.2s ease;
  text-decoration: none;
  color: inherit;

  &:hover {
    background: var(--global-tertiary-bg);
  }

  @media (max-width: 640px) {
    padding: 0.75rem 0;
    gap: 0.75rem;
  }
`;

const TimeWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 3.5rem;
  flex-shrink: 0;

  @media (max-width: 640px) {
    min-width: 2.75rem;
  }
`;

const TimeText = styled.span`
  font-family: 'JetBrains Mono', 'SF Mono', 'Courier New', monospace;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--global-text);
  letter-spacing: 0.05em;
  text-align: center;

  @media (max-width: 640px) {
    font-size: 0.75rem;
  }
`;

const AnimeImage = styled.img`
  width: 3.5rem;
  height: 4.5rem;
  object-fit: cover;
  border-radius: 0.375rem;
  flex-shrink: 0;

  @media (max-width: 640px) {
    width: 2.75rem;
    height: 3.75rem;
    border-radius: 0.25rem;
  }
`;

const ContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
`;

const AnimeTitleEnglish = styled.span`
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--global-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;

  @media (max-width: 640px) {
    font-size: 0.85rem;
  }
`;

const AnimeTitleRomaji = styled.span`
  font-size: 0.75rem;
  color: var(--global-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: italic;

  @media (max-width: 640px) {
    font-size: 0.65rem;
  }
`;

const EpisodeInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.125rem;
`;

const EpisodeBadge = styled.span`
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--primary-accent);
  background: rgba(var(--primary-accent-rgb, 255, 165, 0), 0.1);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;

  @media (max-width: 640px) {
    font-size: 0.6rem;
    padding: 0.1rem 0.25rem;
  }
`;

const TypeBadge = styled.span`
  font-size: 0.65rem;
  color: var(--global-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;

  @media (max-width: 640px) {
    font-size: 0.55rem;
  }
`;

const RatingWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 2.5rem;
  flex-shrink: 0;

  @media (max-width: 640px) {
    min-width: 2rem;
  }
`;

const RatingValue = styled.span`
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--primary-accent);

  @media (max-width: 640px) {
    font-size: 0.8rem;
  }
`;

const RatingLabel = styled.span`
  font-size: 0.55rem;
  color: var(--global-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;

  @media (max-width: 640px) {
    font-size: 0.45rem;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const DAY_OFFSETS = [0, 1, 2, 3, 4, 5, 6]; // 0 = today … 6 = 6 days from now
const MOBILE_LIMIT = 6;

export default function AnimeSchedule() {
  const [activeDayOffset, setActiveDayOffset] = useState<number>(0);
  const [showAll, setShowAll] = useState(false);
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch whenever the selected day changes
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setScheduleData([]);

      try {
        console.log(`🗓️ Fetching AniList schedule for dayOffset=${activeDayOffset}`);
        const rawItems = await fetchAiringSchedule(activeDayOffset);

        if (cancelled) return;

        const items = rawItems.map(mapToScheduleItem);
        setScheduleData(items);
        console.log(`✅ ${items.length} items loaded for offset ${activeDayOffset}`);
      } catch (err) {
        if (cancelled) return;
        console.error('❌ AnimeSchedule fetch error:', err);
        setError('Failed to load airing schedule. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [activeDayOffset]);

  // Reset "show all" when day changes
  useEffect(() => {
    setShowAll(false);
  }, [activeDayOffset]);

  const isMobile =
    typeof window !== 'undefined' && window.innerWidth <= 640;
  const displayLimit = isMobile ? MOBILE_LIMIT : scheduleData.length;
  const displayedEntries = showAll
    ? scheduleData
    : scheduleData.slice(0, displayLimit);
  const hasMore = !showAll && scheduleData.length > displayLimit;

  return (
    <ScheduleRoot>
      <ScheduleHeader>
        <ScheduleSubtitle>Upcoming Releases</ScheduleSubtitle>
        <ScheduleTitle>Airing Schedule</ScheduleTitle>
      </ScheduleHeader>

      {/* Day tab bar — ordered from today outward */}
      <DayNav>
        {DAY_OFFSETS.map((offset) => {
          const isActive = offset === activeDayOffset;
          const abbr = getDayAbbr(offset);
          const dateStr = getShortDate(offset);
          return (
            <DayButton
              key={offset}
              onClick={() => setActiveDayOffset(offset)}
              $isActive={isActive}
            >
              <DayLabel $isActive={isActive}>{abbr}</DayLabel>
              <DateLabel>{dateStr}</DateLabel>
            </DayButton>
          );
        })}
      </DayNav>

      <ScheduleList>
        {loading ? (
          <>
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonRow key={idx}>
                <SkeletonTime />
                <SkeletonImage />
                <SkeletonContentWrapper>
                  <SkeletonTitleLine />
                  <SkeletonRomajiLine />
                  <SkeletonMetaLine />
                </SkeletonContentWrapper>
                <SkeletonRating />
              </SkeletonRow>
            ))}
          </>
        ) : error ? (
          <EmptyState>{error}</EmptyState>
        ) : scheduleData.length === 0 ? (
          <EmptyState>
            No airings scheduled for {getDayAbbr(activeDayOffset)},{' '}
            {getShortDate(activeDayOffset)}.
          </EmptyState>
        ) : (
          <>
            {displayedEntries.map((item, idx) => (
              <ScheduleRow key={item.id || idx} to={`/watch/${item.id}`}>
                {/* Local airing time */}
                <TimeWrapper>
                  <TimeText>{formatLocalTime(item.airingAt)}</TimeText>
                </TimeWrapper>

                {/* Cover image */}
                {item.image && (
                  <AnimeImage
                    src={item.image}
                    alt={item.englishTitle || item.title}
                    loading="lazy"
                  />
                )}

                {/* Title + meta */}
                <ContentWrapper>
                  <AnimeTitleEnglish>
                    {item.englishTitle || item.title}
                  </AnimeTitleEnglish>
                  {item.romajiTitle !== (item.englishTitle || item.title) && (
                    <AnimeTitleRomaji>{item.romajiTitle}</AnimeTitleRomaji>
                  )}
                  <EpisodeInfo>
                    <EpisodeBadge>Ep {item.episode}</EpisodeBadge>
                    <TypeBadge>{item.format || item.type}</TypeBadge>
                  </EpisodeInfo>
                </ContentWrapper>

                {/* Score */}
                <RatingWrapper>
                  {item.rating !== null ? (
                    <>
                      <RatingValue>{item.rating}</RatingValue>
                      <RatingLabel>Score</RatingLabel>
                    </>
                  ) : (
                    <RatingValue style={{ opacity: 0.3 }}>—</RatingValue>
                  )}
                </RatingWrapper>
              </ScheduleRow>
            ))}

            {hasMore && (
              <ViewMoreButton onClick={() => setShowAll(true)}>
                View More ({scheduleData.length - displayLimit} remaining)
              </ViewMoreButton>
            )}
          </>
        )}
      </ScheduleList>
    </ScheduleRoot>
  );
}