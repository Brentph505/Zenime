import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { TbCards } from 'react-icons/tb';
import { FaStar, FaCalendarAlt } from 'react-icons/fa';
import { Anime, StatusIndicator } from '../../index';
import { useTitleWithSubtitle } from '../../hooks/useTitleWithSubtitle';

const SidebarStyled = styled.div`
  transition: 0.2s ease-in-out;
  margin: 0;
  padding: 0;
  max-width: 24rem;
  @media (max-width: 1000px) {
    max-width: unset;
  }
`;

const TitleWithDot = styled.div`
  display: flex;
  align-items: center;
  padding: 0.5rem;
  margin-top: 0.35rem;
  gap: 0.4rem;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background 0.2s ease;
`;

const AnimeCard = styled.div<{ $backgroundImage: string }>`
  display: flex;
  /* Light mode default — clean light overlay so text is readable */
  background: linear-gradient(
      90deg,
      rgba(235, 237, 240, 0.96) 0%,
      rgba(235, 237, 240, 0.88) 60%,
      rgba(235, 237, 240, 0.55) 100%
    ),
    url(${({ $backgroundImage }) => $backgroundImage}) center/cover no-repeat;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  border-radius: var(--global-border-radius);
  align-items: center;
  overflow: hidden;
  gap: 0.5rem;
  cursor: pointer;
  margin-bottom: 0.5rem;
  animation: slideUp 0.5s ease-in-out;
  animation-fill-mode: backwards;
  transition:
    background-color 0.2s ease-in-out,
    margin-left 0.2s ease-in-out 0.1s,
    box-shadow 0.2s ease-in-out,
    transform 0.2s ease-in-out;
  position: relative;
  min-height: 6.5rem;

  /* Dark mode — dark overlay */
  .dark-mode & {
    background: linear-gradient(
        90deg,
        rgba(20, 20, 20, 0.95) 0%,
        rgba(40, 40, 40, 0.85) 50%,
        rgba(60, 60, 60, 0.7) 100%
      ),
      url(${({ $backgroundImage }) => $backgroundImage}) center/cover no-repeat;
    box-shadow: none;
  }

  &:hover,
  &:active,
  &:focus {
    margin-left: 0.35rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);

    .dark-mode & {
      box-shadow: 0 0 25px rgba(0, 0, 0, 0.5);
    }
  }

  @media (max-width: 500px) {
    &:hover,
    &:active,
    &:focus {
      margin-left: unset;
      transform: unset;
    }
  }
`;

const AnimeImageStyled = styled.img`
  width: 4.25rem;
  height: 6rem;
  object-fit: cover;
  border-radius: var(--global-border-radius);
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
`;

const InfoStyled = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 0.75rem;
`;

const Title = styled.p`
  top: 0;
  margin-bottom: 0.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.9rem;
  margin: 0;
  font-weight: 600;
  color: var(--global-text);
`;

const Details = styled.p`
  font-size: 0.75rem;
  margin: 0;
  color: var(--global-text);
  opacity: 0.75;

  svg {
    margin-left: 0.4rem;
  }
`;

// Sub-component to use useTitleWithSubtitle hook for each anime
const SideBarAnimeCard: React.FC<{ anime: Anime; index: number }> = ({ anime, index }) => {
  const { title: displayTitle, subtitle: displaySubtitle } = useTitleWithSubtitle(anime.title);

  return (
    <Link
      to={`/watch/${anime.id}`}
      key={anime.id}
      style={{ textDecoration: 'none', color: 'inherit' }}
      title={`${displayTitle}`}
      aria-label={`Watch ${displayTitle}`}
    >
      <AnimeCard
        $backgroundImage={anime.image}
        style={{ animationDelay: `${index * 0.1}s` }}
      >
        <AnimeImageStyled
          src={anime.image}
          alt={displayTitle}
        />
        <InfoStyled>
          <TitleWithDot>
            <StatusIndicator status={anime.status} />
            <Title>{displayTitle}</Title>
          </TitleWithDot>
          <Details>
            {anime.type && <>{anime.type}</>}
            {anime.releaseDate && (
              <>
                <FaCalendarAlt /> {anime.releaseDate}
              </>
            )}
            {anime.currentEpisode !== null &&
              anime.currentEpisode !== undefined &&
              anime.totalEpisodes !== null &&
              anime.totalEpisodes !== undefined &&
              anime.totalEpisodes !== 0 &&
              anime.totalEpisodes !== 0 && (
                <>
                  <TbCards /> {String(anime.currentEpisode).split('-')[0]}
                  {' / '}
                  {anime.totalEpisodes}
                </>
              )}
            {anime.rating && (
              <>
                <FaStar /> {anime.rating}
              </>
            )}
          </Details>
        </InfoStyled>
      </AnimeCard>
    </Link>
  );
};

export const HomeSideBar: React.FC<{ animeData: Anime[] }> = ({
  animeData,
}) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const displayedAnime = windowWidth <= 500 ? animeData.slice(0, 5) : animeData;

  return (
    <SidebarStyled>
      {displayedAnime.map((anime: Anime, index) => (
        <SideBarAnimeCard key={anime.id} anime={anime} index={index} />
      ))}
    </SidebarStyled>
  );
};