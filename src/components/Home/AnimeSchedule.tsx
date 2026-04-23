import { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Link } from 'react-router-dom';
import { fetchAiringSchedule } from '../../hooks/useApi';

interface AnimeTitle {
  romaji: string;
  english: string | null;
  native: string;
  userPreferred: string;
}

interface AiringAnime {
  id: string;
  malId: number;
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
  title: AnimeTitle;
  country: string;
  image: string;
  imageHash: string;
  cover: string;
  coverHash: string;
  description: string | null;
  status: string;
  rating: number;
  genres: string[];
  color: string;
  duration: number | null;
  type: string;
  releaseDate: string;
}

interface ScheduleItem {
  date: string;
  title: string;
  englishTitle: string | null;
  romajiTitle: string;
  isNew: boolean;
  id: string;
  image: string;
  type: string;
  rating: number;
  episode: number;
  airingAt: number;
}

type DateLabels = Record<string, string>;

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper function to format airing time in user's local timezone (24-hour format)
function formatLocalTime24(unixTimestamp: number): string {
  try {
    // Convert Unix timestamp (seconds) to milliseconds and create Date object
    const date = new Date(unixTimestamp * 1000);
    
    // Format time in user's local timezone using 24-hour format
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    return timeFormatter.format(date);
  } catch (err) {
    console.warn('Error formatting time:', err);
    return 'Unknown time';
  }
}

// Helper function to format a date as YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to get the date string for a specific day index (0 = today, 1 = tomorrow, etc.)
function getDateStringForDay(dayOffset: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return formatDate(date);
}

// Helper function to get date labels for each day starting from today
function getDateLabelsForWeek(): DateLabels {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setUTCHours(0, 0, 0, 0);
  
  const labels: DateLabels = {};
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });
  
  // Get today's day index (0 = Sunday in JS)
  const todayDayIndex = today.getUTCDay();
  
  // Create ordered days starting from today
  const orderedDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dayIndex = (todayDayIndex + i) % 7;
    orderedDays.push(days[dayIndex]);
  }
  
  orderedDays.forEach((day, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);
    labels[day] = dateFormatter.format(date);
  });
  
  return labels;
}

const ScheduleRoot = styled.section`
  width: 100%;
  background: var(--global-card-bg);
  border-radius: var(--global-border-radius);
  padding: 1.5rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;

  @media (max-width: 640px) {
    padding: 1rem;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
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
  padding-bottom: 0;
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
  scrollbar-width: thin;
  scrollbar-color: var(--global-border) transparent;

  /* Hide scrollbar for Chrome, Safari and Opera */
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
    gap: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    flex-wrap: nowrap;
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
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @media (max-width: 640px) {
    padding: 0.4rem 0.5rem 0.6rem;
    gap: 0.15rem;
    flex-shrink: 0;
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
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
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

// New styled components for the improved layout
const ScheduleRowNew = styled(Link)`
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

const AnimeImageNew = styled.img`
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

export default function AnimeSchedule() {
  // Get today's day of week as default active day (0 = today)
  const getTodayDayIndex = (): number => 0;

  const [activeDayIndex, setActiveDayIndex] = useState<number>(getTodayDayIndex());
  const [showAll, setShowAll] = useState(false);
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dateLabels = getDateLabelsForWeek();

  // Get the date string for the active day
  const getActiveDateString = (): string => {
    return getDateStringForDay(activeDayIndex);
  };

  // Fetch schedule for a specific date when activeDayIndex changes
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        console.log('🚀 Starting to fetch airing schedule...');
        setLoading(true);
        setError(null);

        // Use specific date for both startDate and endDate (single day request)
        const dateString = getActiveDateString();

        console.log('📡 Calling fetchAiringSchedule with params:', {
          page: 1,
          perPage: 50,
          startDate: dateString,
          endDate: dateString,
        });

        const data = await fetchAiringSchedule(1, 50, dateString, dateString);

        console.log('✅ Full API Response:', data);

        if (
          data &&
          data.results &&
          Array.isArray(data.results) &&
          data.results.length > 0
        ) {
          console.log('✅ First result sample:', data.results[0]);
          
          // Convert API results to ScheduleItem array
          const items: ScheduleItem[] = data.results.map((anime: AiringAnime) => {
            const releaseDate = new Date(anime.airingAt * 1000).toISOString();
            const title = anime.title?.userPreferred || anime.title?.romaji || 'Unknown Title';
            const englishTitle = anime.title?.english || null;
            const romajiTitle = anime.title?.romaji || 'Unknown Title';
            const id = anime.id || `unknown-${Math.random()}`;
            
            return {
              date: releaseDate,
              title,
              englishTitle,
              romajiTitle,
              isNew: false,
              id,
              image: anime.image,
              type: anime.type,
              rating: anime.rating,
              episode: anime.episode,
              airingAt: anime.airingAt,
            };
          });
          
          // Sort by airing time
          items.sort((a, b) => (a.airingAt || 0) - (b.airingAt || 0));
          
          console.log('✅ Schedule items:', items);
          setScheduleData(items);
        } else {
          console.warn('⚠️ No valid results in API response');
          setScheduleData([]);
        }
      } catch (err) {
        console.error('❌ Error in fetchSchedule:', err);
        setError('Failed to load airing schedule');
        console.error('API Error details:', {
          message: err instanceof Error ? err.message : String(err),
          error: err,
          stack: err instanceof Error ? err.stack : undefined,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [activeDayIndex]); // Fetch when active day changes

  const entries = scheduleData;
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
  const displayLimit = isMobile ? 6 : entries.length;
  const displayedEntries = showAll ? entries : entries.slice(0, displayLimit);
  const hasMore = entries.length > displayLimit;

  // Get ordered day indices (0 = today, 1 = tomorrow, etc.)
  const getOrderedDayIndices = (): number[] => {
    return [0, 1, 2, 3, 4, 5, 6];
  };

  const orderedDayIndices = getOrderedDayIndices();

  return (
    <ScheduleRoot>
      <ScheduleHeader>
        <ScheduleSubtitle>Upcoming Releases</ScheduleSubtitle>
        <ScheduleTitle>Airing Schedule</ScheduleTitle>
      </ScheduleHeader>

      <DayNav>
        {orderedDayIndices.map((dayIndex) => {
          const isActive = dayIndex === activeDayIndex;
          const dayName = days[(new Date().getUTCDay() + dayIndex) % 7];
          return (
            <DayButton
              key={dayIndex}
              onClick={() => {
                setActiveDayIndex(dayIndex);
                setShowAll(false);
              }}
              $isActive={isActive}
            >
              <DayLabel $isActive={isActive}>{dayName}</DayLabel>
              {dateLabels[dayName] && <DateLabel>{dateLabels[dayName]}</DateLabel>}
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
        ) : entries.length === 0 ? (
          <EmptyState>No airings scheduled for {days[(new Date().getUTCDay() + activeDayIndex) % 7]}.</EmptyState>
        ) : (
          <>
            {displayedEntries.map((item: ScheduleItem, idx: number) => (
              <ScheduleRowNew key={item.id || idx} to={`/watch/${item.id}`}>
                <TimeWrapper>
                  <TimeText>{formatLocalTime24(item.airingAt)}</TimeText>
                </TimeWrapper>
                {item.image && (
                  <AnimeImageNew src={item.image} alt={item.englishTitle || item.title} />
                )}
                <ContentWrapper>
                  <AnimeTitleEnglish>{item.englishTitle || item.title}</AnimeTitleEnglish>
                  <AnimeTitleRomaji>{item.romajiTitle}</AnimeTitleRomaji>
                  <EpisodeInfo>
                    <EpisodeBadge>Ep {item.episode}</EpisodeBadge>
                    <TypeBadge>{item.type}</TypeBadge>
                  </EpisodeInfo>
                </ContentWrapper>
                <RatingWrapper>
                  <RatingValue>{item.rating}</RatingValue>
                  <RatingLabel>Score</RatingLabel>
                </RatingWrapper>
              </ScheduleRowNew>
            ))}
            {hasMore && !showAll && (
              <ViewMoreButton onClick={() => setShowAll(true)}>
                View More
              </ViewMoreButton>
            )}
          </>
        )}
      </ScheduleList>
    </ScheduleRoot>
  );
}
