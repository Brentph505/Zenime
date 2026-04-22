import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom'; // Assuming you're using React Router for navigation
import { TbCards } from 'react-icons/tb';
import { FaStar, FaCalendarAlt } from 'react-icons/fa';
import { Anime, StatusIndicator } from '../../index';

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
  background: linear-gradient(90deg, rgba(20, 20, 20, 0.95) 0%, rgba(40, 40, 40, 0.85) 50%, rgba(60, 60, 60, 0.7) 100%),
    url(${({ $backgroundImage }) => $backgroundImage}) center/cover no-repeat;
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

  &:hover,
  &:active,
  &:focus {
    margin-left: 0.35rem;
    box-shadow: 0 0 25px rgba(0, 0, 0, 0.5);
    transform: translateY(-2px);
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
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
`;

const Details = styled.p`
  font-size: 0.75rem;
  margin: 0;
  color: rgba(200, 200, 200, 0.8);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  svg {
    margin-left: 0.4rem;
  }
`;

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
        <Link
          to={`/watch/${anime.id}`}
          key={anime.id}
          style={{ textDecoration: 'none', color: 'inherit' }}
          title={`${anime.title.userPreferred}`}
          aria-label={`Watch ${anime.title.userPreferred}`}
        >
          <AnimeCard
            $backgroundImage={anime.image}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <AnimeImageStyled
              src={anime.image}
              alt={anime.title.userPreferred}
            />
            <InfoStyled>
              <TitleWithDot>
                <StatusIndicator status={anime.status} />
                <Title>{anime.title.english || anime.title.romaji}</Title>
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
      ))}
    </SidebarStyled>
  );
};
