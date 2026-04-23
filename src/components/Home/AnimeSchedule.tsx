import { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
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
  isNew: boolean;
  id: string;
  image: string;
  type: string;
  rating: number;
  episode: number;
  airingAt: number;
}

type ScheduleData = Record<string, ScheduleItem[]>;
type DateLabels = Record<string, string>;

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper function to get day of week from ISO date string
function getDayOfWeek(dateString: string): string {
  try {
    // Parse the date string - already in UTC format (ends with Z)
    const date = new Date(dateString);
    const dayIndex = date.getUTCDay();
    return days[dayIndex];
  } catch {
    console.warn('Invalid date string:', dateString);
    return 'Unknown';
  }
}

// Helper function to get current week's date range starting from today
function getCurrentWeekDateRange(): [string, string] {
  const today = new Date();
  
  // Start from today
  const startDate = new Date(today);
  startDate.setUTCHours(0, 0, 0, 0);
  
  // End date = today + 6 days (next week)
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);
  
  const formatDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return [formatDate(startDate), formatDate(endDate)];
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

// Helper function to group anime by day of week from release dates
function groupByDay(animeList: AiringAnime[]): ScheduleData {
  const grouped: ScheduleData = {
    Sun: [],
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
  };

  if (!Array.isArray(animeList)) {
    console.error('animeList is not an array:', animeList);
    return grouped;
  }

  animeList.forEach((anime, idx) => {
    try {
      if (!anime || !anime.airingAt) {
        console.warn(`Anime ${idx} missing airingAt:`, anime);
        return;
      }

      // Convert Unix timestamp (seconds) to ISO date string for getDayOfWeek
      const releaseDate = new Date(anime.airingAt * 1000).toISOString();
      const dayName = getDayOfWeek(releaseDate);
      // Use userPreferred title, fallback to romaji
      const title = anime.title?.userPreferred || anime.title?.romaji || 'Unknown Title';
      const id = anime.id || `unknown-${idx}`;

      grouped[dayName].push({
        date: releaseDate,
        title,
        isNew: false,
        id,
        image: anime.image,
        type: anime.type,
        rating: anime.rating,
        episode: anime.episode,
        airingAt: anime.airingAt,
      });
    } catch (err) {
      console.error(`Error processing anime at index ${idx}:`, err, anime);
    }
  });

  // Sort each day's anime by airing time
  Object.keys(grouped).forEach((day) => {
    grouped[day].sort((a, b) => (a.airingAt || 0) - (b.airingAt || 0));
  });

  return grouped;
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

const ScheduleRow = styled.div`
  border-bottom: 1px solid var(--global-border);
  transition: background 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;

  &:hover {
    background: var(--global-tertiary-bg);
  }

  @media (max-width: 640px) {
    padding: 0.5rem 0;
    transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

const ScheduleRowInner = styled.div`
  display: flex;
  align-items: center;
  padding: 0.875rem 0.75rem;
  gap: 1rem;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: 640px) {
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.5rem;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

const AnimeImage = styled.img`
  width: 3rem;
  height: 4rem;
  object-fit: cover;
  border-radius: 0.25rem;
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: 640px) {
    width: 2.5rem;
    height: 3.5rem;
    border-radius: 0.2rem;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

const ScheduleContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
  overflow-x: hidden;

  @media (max-width: 640px) {
    gap: 0.15rem;
  }
`;

const ScheduleTime = styled.span`
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: var(--global-text-muted);
  letter-spacing: 0.03em;
  transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: 640px) {
    font-size: 0.65rem;
    transition: color 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

const ScheduleTitleText = styled.span`
  flex: 1;
  min-width: 10rem;
  font-size: 0.9375rem;
  color: var(--global-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: 640px) {
    font-size: 0.8rem;
    min-width: 0;
    font-weight: 600;
    transition: color 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

const RatingBadge = styled.span`
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--primary-accent);
  background: transparent;
  border: none;
  padding: 0;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: 640px) {
    font-size: 0.6rem;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
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
  border-bottom: 1px solid var(--global-border);
  padding: 0.875rem 0.75rem;
  display: flex;
  gap: 1rem;
  align-items: center;
  animation: ${pulse} 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;

  @media (max-width: 640px) {
    padding: 0.6rem 0.5rem;
    gap: 0.75rem;
  }
`;

const SkeletonImage = styled.div`
  width: 3rem;
  height: 4rem;
  background: var(--global-tertiary-bg);
  border-radius: 0.25rem;
  flex-shrink: 0;
`;

const SkeletonContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
`;

const SkeletonTitleLine = styled.div`
  height: 0.875rem;
  background: var(--global-tertiary-bg);
  border-radius: 0.25rem;
  width: 100%;
`;

const SkeletonMetaLine = styled.div`
  height: 0.65rem;
  background: var(--global-tertiary-bg);
  border-radius: 0.25rem;
  width: 40%;
`;

export default function AnimeSchedule() {
  // Get today's day of week as default active day
  const getTodayDay = (): string => {
    const today = new Date();
    const dayIndex = today.getUTCDay();
    return days[dayIndex];
  };

  const [activeDay, setActiveDay] = useState<string>(getTodayDay());
  const [showAll, setShowAll] = useState(false);
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    Sun: [],
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateLabels, setDateLabels] = useState<DateLabels>(getDateLabelsForWeek());

  // Fetch schedule on mount using current week's date range
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        console.log('🚀 Starting to fetch airing schedule...');
        setLoading(true);
        setError(null);

        // Use current week's date range (always fetch full week)
        const [startDate, endDate] = getCurrentWeekDateRange();

        console.log('📡 Calling fetchAiringSchedule with params:', {
          page: 1,
          perPage: 50,
          startDate,
          endDate,
        });

        const data = await fetchAiringSchedule(1, 50, startDate, endDate);

        console.log('✅ Full API Response:', data);

        let grouped: ScheduleData = {
          Sun: [],
          Mon: [],
          Tue: [],
          Wed: [],
          Thu: [],
          Fri: [],
          Sat: [],
        };

        if (
          data &&
          data.results &&
          Array.isArray(data.results) &&
          data.results.length > 0
        ) {
          console.log('✅ First result sample:', data.results[0]);
          grouped = groupByDay(data.results);
          console.log('✅ Grouped data:', grouped);
          setScheduleData(grouped);

          // Set date labels for each day of the week (always show dates)
          setDateLabels(getDateLabelsForWeek());
        }

        if (
          !data ||
          !data.results ||
          !Array.isArray(data.results) ||
          data.results.length === 0
        ) {
          console.warn('⚠️ No valid results in API response');
          setError('No airing data available');
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
  }, []); // Empty dependency array - fetch once on mount

  const entries = scheduleData[activeDay] || [];
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
  const displayLimit = isMobile ? 6 : entries.length;
  const displayedEntries = showAll ? entries : entries.slice(0, displayLimit);
  const hasMore = entries.length > displayLimit;

  // Get ordered days starting from today
  const getOrderedDays = (): string[] => {
    const today = new Date();
    const todayDayIndex = today.getUTCDay();
    const ordered: string[] = [];
    for (let i = 0; i < 7; i++) {
      const dayIndex = (todayDayIndex + i) % 7;
      ordered.push(days[dayIndex]);
    }
    return ordered;
  };

  const orderedDays = getOrderedDays();

  return (
    <ScheduleRoot>
      <ScheduleHeader>
        <ScheduleSubtitle>Upcoming Releases</ScheduleSubtitle>
        <ScheduleTitle>Airing Schedule</ScheduleTitle>
      </ScheduleHeader>

      <DayNav>
        {orderedDays.map((day) => {
          const isActive = day === activeDay;
          return (
            <DayButton
              key={day}
              onClick={() => {
                setActiveDay(day);
                setShowAll(false);
              }}
              $isActive={isActive}
            >
              <DayLabel $isActive={isActive}>{day}</DayLabel>
              {dateLabels[day] && <DateLabel>{dateLabels[day]}</DateLabel>}
            </DayButton>
          );
        })}
      </DayNav>

      <ScheduleList>
        {loading ? (
          <>
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonRow key={idx}>
                <SkeletonImage />
                <SkeletonContentWrapper>
                  <SkeletonTitleLine />
                  <SkeletonMetaLine />
                </SkeletonContentWrapper>
              </SkeletonRow>
            ))}
          </>
        ) : error ? (
          <EmptyState>{error}</EmptyState>
        ) : entries.length === 0 ? (
          <EmptyState>No airings scheduled for {activeDay}.</EmptyState>
        ) : (
          <>
            {displayedEntries.map((item: ScheduleItem, idx: number) => (
              <ScheduleRow key={item.id || idx}>
                <ScheduleRowInner>
                  {item.image && (
                    <AnimeImage src={item.image} alt={item.title} />
                  )}
                  <ScheduleContentWrapper>
                    <ScheduleTitleText>{item.title}</ScheduleTitleText>
                    <ScheduleTime>
                      Ep {item.episode} • {item.type} • Rating: {item.rating}%
                    </ScheduleTime>
                  </ScheduleContentWrapper>
                  <RatingBadge>⭐ {item.rating}</RatingBadge>
                </ScheduleRowInner>
              </ScheduleRow>
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
