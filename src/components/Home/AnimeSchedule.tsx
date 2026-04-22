import { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { fetchAiringSchedule } from '../../hooks/useApi';

interface AiringAnime {
  id: string;
  title: string;
  image: string;
  type: string;
  rating: number;
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
}

type ScheduleData = Record<string, ScheduleItem[]>;
type DateLabels = Record<string, string>;

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper function to get day of week from date string (YYYY-MM-DD)
function getDayOfWeek(dateString: string): string {
  try {
    const date = new Date(dateString + 'T00:00:00Z');
    const dayIndex = date.getUTCDay();
    return days[dayIndex];
  } catch {
    console.warn('Invalid date string:', dateString);
    return 'Unknown';
  }
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
      if (!anime || !anime.releaseDate) {
        console.warn(`Anime ${idx} missing releaseDate:`, anime);
        return;
      }

      const dayName = getDayOfWeek(anime.releaseDate);
      const title = anime.title || 'Unknown Title';
      const id = anime.id || `unknown-${idx}`;

      grouped[dayName].push({
        date: anime.releaseDate,
        title,
        isNew: false,
        id,
        image: anime.image,
        type: anime.type,
        rating: anime.rating,
      });
    } catch (err) {
      console.error(`Error processing anime at index ${idx}:`, err, anime);
    }
  });

  // Sort each day's anime by date
  Object.keys(grouped).forEach((day) => {
    grouped[day].sort((a, b) => a.date.localeCompare(b.date));
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

const TimezoneInfo = styled.span`
  font-size: 0.75rem;
  color: var(--primary-accent);
  letter-spacing: 0.04em;
  display: inline-block;
  margin-left: 0.5rem;
  font-weight: 500;

  @media (max-width: 640px) {
    font-size: 0.65rem;
    display: block;
    margin-left: 0;
    margin-top: 0.25rem;
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
  const [activeDay, setActiveDay] = useState('Wed');
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
  const [dateLabels, setDateLabels] = useState<DateLabels>({});

  const dayToParams = (day: string): [string, number] => {
    const dayMap: Record<string, [string, number]> = {
      Sun: ['Sunday', 0],
      Mon: ['Monday', 1],
      Tue: ['Tuesday', 2],
      Wed: ['Wednesday', 3],
      Thu: ['Thursday', 4],
      Fri: ['Friday', 5],
      Sat: ['Saturday', 6],
    };
    return dayMap[day] ?? ['Sunday', 0];
  };

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        console.log('🚀 Starting to fetch airing schedule...');
        setLoading(true);
        setError(null);

        const [weekStart, weekEnd] = dayToParams(activeDay);

        console.log('📡 Calling fetchAiringSchedule with params:', {
          page: 1,
          perPage: 50,
          weekStart,
          weekEnd,
        });

        const data = await fetchAiringSchedule(1, 50, weekStart, weekEnd);

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

          const labels: DateLabels = {};
          days.forEach((day) => {
            const firstOfDay = grouped[day]?.[0];
            if (firstOfDay) {
              const date = new Date(firstOfDay.date + 'T00:00:00Z');
              const dateFormatter = new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
              });
              labels[day] = dateFormatter.format(date);
            } else {
              labels[day] = '';
            }
          });
          setDateLabels(labels);
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
  }, [activeDay]);

  const entries = scheduleData[activeDay] || [];
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
  const displayLimit = isMobile ? 6 : entries.length;
  const displayedEntries = showAll ? entries : entries.slice(0, displayLimit);
  const hasMore = entries.length > displayLimit;

  return (
    <ScheduleRoot>
      <ScheduleHeader>
        <ScheduleSubtitle>Upcoming Releases</ScheduleSubtitle>
        <ScheduleTitle>Airing Schedule</ScheduleTitle>
      </ScheduleHeader>

      <DayNav>
        {days.map((day) => {
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
                      {item.type} • Rating: {item.rating}%
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
