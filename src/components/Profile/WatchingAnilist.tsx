import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate, Link } from 'react-router-dom';
import { Seasons, Anime, useTitleWithSubtitle } from '../../index';
import { SiMyanimelist, SiAnilist } from 'react-icons/si';
import { FaExternalLinkAlt } from 'react-icons/fa';
import { useSettings } from '../Profile/SettingsProvider';

// Custom hook for responsive screen size detection
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return windowSize;
};

const AnimeDataContainer = styled.div`
  margin-bottom: 1.5rem;

  @media (max-width: 1000px) {
    margin-bottom: 0rem;
  }
`;

const AnimeDataContainerTop = styled.div`
  border-radius: var(--global-border-radius);
  background-color: var(--global-div-tr);
  margin: 1rem 0;
  padding: 0.75rem;
  color: var(--global-text);
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 1rem;

  @media (max-width: 750px) {
    flex-direction: column;
    align-items: center;
    padding: 0.75rem;
    gap: 0.75rem;
  }

  @media (max-width: 500px) {
    padding: 0.5rem;
    gap: 0.5rem;
  }
`;

const AnimeDataContainerMiddle = styled.div`
  border-radius: var(--global-border-radius);
  padding-top: 0.6rem;
  color: var(--global-text);
  display: flex;
  flex-direction: row;
  align-items: flex-start;

  @media (max-width: 500px) {
    padding-top: 0;
  }
`;

const AnimeDataContainerBottom = styled.div`
  margin-top: 0.6rem;

  @media (max-width: 750px) {
    margin-top: 0;
  }
`;

const ParentContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;

  @media (min-width: 750px) {
    grid-template-columns: 1.2fr 1fr;
  }

  @media (min-width: 1500px) {
    grid-template-columns: 1.25fr 1fr;
  }
`;

const AnimeDataText = styled.div`
  text-align: left;
  font-size: 0.8rem;
  width: 100%;

  .anime-title {
    line-height: 1.6rem;
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--global-text);
    margin-bottom: 0.5rem;
    text-align: center;

    @media (min-width: 751px) {
      text-align: left;
    }

    @media (max-width: 500px) {
      font-size: 1.25rem;
      margin-bottom: 0.2rem;
      line-height: 1.4rem;
    }
  }

  .anime-title-romaji {
    font-style: italic;
    margin-top: 0rem;
    line-height: 0.6rem;
    margin-bottom: 0.5rem;
    text-align: center;

    @media (min-width: 751px) {
      text-align: left;
    }

    @media (max-width: 500px) {
      line-height: 1rem;
      margin-bottom: 0.25rem;
    }
  }

  p {
    color: #828181;
    margin-top: 0rem;
    margin-bottom: 0.2rem;
    line-height: 1.3rem;

    @media (max-width: 500px) {
      line-height: 1.2rem;
      font-size: 0.75rem;
    }
  }

  .Description {
    line-height: 1rem;
    max-width: 50rem;
    font-size: 0.9rem;

    @media (max-width: 500px) {
      font-size: 0.8rem;
    }
  }

  strong {
    color: var(--global-text);
  }

  .Seasons-Sections-Titles {
    color: var(--global-text);
    margin-top: 1rem;
    font-size: 1.25rem;
    font-weight: bold;

    @media (max-width: 500px) {
      font-size: 1rem;
      margin-top: 0.75rem;
    }
  }
`;

const AnimeInfoImage = styled.img`
  border-radius: var(--global-border-radius);
  max-height: 15rem;
  width: 10.5rem;
  object-fit: cover;

  @media (max-width: 500px) {
    max-height: 12rem;
    width: 8.5rem;
  }
`;

const ImageWrapper = styled.div`
  position: relative;
  display: inline-block;
  cursor: pointer;
  width: 10.5rem;
  max-height: 15rem;
  flex-shrink: 0;

  @media (max-width: 500px) {
    width: 8.5rem;
    max-height: 12rem;
  }

  @media (hover: none) and (pointer: coarse) {
    cursor: default;
  }
`;

const InfoIconOverlay = styled(Link)<{ $show: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: var(--global-border-radius);
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  color: white;

  &:hover {
    opacity: 1;
  }

  @media (hover: none) and (pointer: coarse) {
    opacity: ${({ $show }) => ($show ? 0.7 : 0)};
    &:hover {
      opacity: ${({ $show }) => ($show ? 0.7 : 0)};
    }
  }
`;

const Button = styled.button`
  padding: 0.5rem 0.6rem;
  background-color: var(--primary-accent);
  color: white;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.3s ease;
  outline: none;

  &:hover,
  &:active,
  &:focus {
    background-color: var(--primary-accent-bg);
  }

  @media (max-width: 1000px) {
    display: block;
    margin: 0 auto;
    margin-bottom: 0.5rem;
  }
`;

const ShowTrailerButton = styled(Button)`
  padding: 0rem;
  width: 10.5rem;
  background-color: var(--global-div);
  transition:
    background-color 0.3s ease,
    transform 0.2s ease-in-out;
  color: var(--global-text);
  font-size: 0.85rem;
  margin-bottom: 0.5rem;

  &:hover,
  &:active,
  &:focus {
    background-color: var(--primary-accent);
    z-index: 2;
  }

  @media (max-width: 500px) {
    font-size: 0.8rem;
    width: 8.5rem;
  }
`;

const MalAniContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: center;

  @media (min-width: 751px) {
    justify-content: flex-start;
  }
`;

const MalAnilistSvg = styled.div`
  height: 2.5rem;
  width: 5rem;
  border-radius: var(--global-border-radius);
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--global-div);
  color: var(--global-text);
  transition: 0.1s ease-in-out;

  &:hover,
  &:active,
  &:focus {
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.975);
  }

  @media (max-width: 500px) {
    width: 4rem;
    height: 2rem;
  }
`;

const ShowMoreButton = styled.button`
  background-color: var(--global-div);
  color: #828181;
  display: flex;
  border: none;
  padding: 0.5rem;
  border-radius: var(--global-border-radius);
  margin: 0.5rem 0;
  text-align: left;
  width: 100%;
  transition:
    color 0.3s ease,
    transform 0.2s ease-in-out;

  &:hover,
  &:active,
  &:focus {
    background-color: var(--global-div);
  }

  @media (max-width: 500px) {
    margin: 0.25rem 0;
    font-size: 0.8rem;
  }
`;

const IframeTrailer = styled.iframe`
  aspect-ratio: 16/9;
  position: relative;
  border: none;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
`;

const ClickableText = styled.span`
  color: var(--global-text);
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: var(--primary-accent);
  }
`;

const TrailerOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: fadeIn 0.3s ease-in-out;
  padding: 1rem;
  box-sizing: border-box;
`;

const TrailerOverlayContent = styled.div`
  width: 100%;
  max-width: 60%;
  aspect-ratio: 16 / 9;
  background-color: var(--global-div);
  border-radius: var(--global-border-radius);
  overflow: hidden;

  @media (max-width: 750px) {
    max-width: 90%;
  }

  @media (max-width: 500px) {
    max-width: 100%;
  }
`;

const LeftColumnWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;

  @media (min-width: 751px) {
    align-items: flex-start;
    margin-right: 1rem;
  }
`;

const DescriptionContainer = styled.div`
  @media (max-width: 750px) {
    width: 100%;
  }
`;

export const WatchAnimeData: React.FC<{ animeData: Anime }> = ({
  animeData,
}) => {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [isDescriptionExpanded, setDescriptionExpanded] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [showInfoOverlay, setShowInfoOverlay] = useState(false);
  const { width } = useWindowSize();
  
  const isMobile = width <= 750;
  const isSmallMobile = width <= 500;
  
  const { title: displayTitle, subtitle: displaySubtitle } = useTitleWithSubtitle(animeData.title);

  const getAnimeIdFromUrl = useCallback(() => {
    const pathParts = window.location.pathname.split('/');
    return pathParts[2];
  }, []);

  const toggleDescription = () => {
    setDescriptionExpanded(!isDescriptionExpanded);
  };

  useEffect(() => {
    setDescriptionExpanded(false);
    setShowInfoOverlay(false);
  }, [getAnimeIdFromUrl()]);

  const removeHTMLTags = (description: string): string => {
    return description.replace(/<[^>]+>/g, '').replace(/\([^)]*\)/g, '');
  };

  const toggleTrailer = () => {
    setShowTrailer(!showTrailer);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showTrailer) {
        setShowTrailer(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showTrailer]);

  // Reset info overlay when clicking outside on mobile
  useEffect(() => {
    if (!isSmallMobile) {
      setShowInfoOverlay(false);
    }
  }, [isSmallMobile]);

  return (
    <>
      {animeData && (
        <AnimeDataContainer>
          <AnimeDataContainerTop>
            <LeftColumnWrapper>
              <ImageWrapper
                onClick={() => {
                  if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
                    navigate(`/info/${animeData.id}`);
                  }
                }}
                style={{ touchAction: 'manipulation' }}
              >
                <AnimeInfoImage
                  src={animeData.image}
                  alt='Anime Title Image'
                />
                <InfoIconOverlay
                  to={`/info/${animeData.id}`}
                  title="View Info"
                  $show={showInfoOverlay}
                  onClick={e => {
                    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches && !showInfoOverlay) {
                      e.preventDefault();
                      setShowInfoOverlay(true);
                    }
                  }}
                >
                  <FaExternalLinkAlt size={24} />
                </InfoIconOverlay>
              </ImageWrapper>
              {animeData.trailer && animeData.status !== 'Not yet aired' && (
                <ShowTrailerButton onClick={toggleTrailer}>
                  <p>
                    <strong>TRAILER</strong>
                  </p>
                </ShowTrailerButton>
              )}
              <MalAniContainer>
                {animeData.id && (
                  <a
                    href={`https://anilist.co/${!animeData.type ? 'anime' : animeData.type.toLowerCase() === 'manga' || animeData.type.toLowerCase() === 'novel' ? 'manga' : 'anime'}/${animeData.id}`}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <MalAnilistSvg>
                      <SiAnilist size={'1.5rem'} />
                    </MalAnilistSvg>
                  </a>
                )}
                {animeData.malId && (
                  <a
                    href={`https://myanimelist.net/${!animeData.type ? 'anime' : animeData.type.toLowerCase() === 'manga' || animeData.type.toLowerCase() === 'novel' ? 'manga' : 'anime'}/${animeData.malId}`}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <MalAnilistSvg>
                      <SiMyanimelist size={'2.75rem'} />
                    </MalAnilistSvg>
                  </a>
                )}
              </MalAniContainer>
            </LeftColumnWrapper>
            
            <AnimeDataText>
              <p className='anime-title'>
                {displayTitle}
              </p>
              {displaySubtitle && (
                <p
                  className='anime-title-romaji'
                  style={{ color: animeData.color }}
                >
                  {displaySubtitle}
                </p>
              )}
              
              {animeData.description && (
                <DescriptionContainer>
                  <p className='Description'>
                    <ShowMoreButton onClick={toggleDescription}>
                      {isDescriptionExpanded
                        ? removeHTMLTags(animeData.description)
                        : `${removeHTMLTags(animeData.description).substring(isSmallMobile ? 80 : 100)}...`}
                      {isDescriptionExpanded ? ' [Show Less]' : ' [Show More]'}
                    </ShowMoreButton>
                  </p>
                </DescriptionContainer>
              )}
              
              <ParentContainer>
                <AnimeDataContainerMiddle>
                  <AnimeDataText>
                    {animeData.type ? (
                      <p>
                        Type: <ClickableText onClick={() => navigate(`/search?query=&format=${encodeURIComponent(animeData.type!)}`)}><strong>{animeData.type}</strong></ClickableText>
                      </p>
                    ) : (
                      <p>
                        Type: <strong>Unknown</strong>
                      </p>
                    )}
                    {animeData.releaseDate ? (
                      <p>
                        Year: <ClickableText onClick={() => navigate(`/search?year=${animeData.releaseDate}`)}><strong>{animeData.releaseDate}</strong></ClickableText>
                      </p>
                    ) : (
                      <p>
                        Year: <strong>Unknown</strong>
                      </p>
                    )}
                    {animeData.status && (
                      <p>
                        Status:{' '}
                        <strong>
                          {animeData.status === 'Completed'
                            ? 'Finished'
                            : animeData.status === 'Ongoing'
                              ? 'Airing'
                              : animeData.status}
                        </strong>
                      </p>
                    )}
                    {animeData.rating ? (
                      <p>
                        Rating: <strong>{animeData.rating}</strong>
                      </p>
                    ) : (
                      <p>
                        Rating: <strong>Unknown</strong>
                      </p>
                    )}
                    {animeData.studios && animeData.studios.length > 0 ? (
                      <p>
                        Studios:{' '}
                        <strong>
                          {animeData.studios.map((studio, index) => (
                            <React.Fragment key={studio}>
                              <ClickableText
                                onClick={() =>
                                  navigate(
                                    `/studio/${
                                      animeData.studioIds?.[index] || studio
                                    }`,
                                  )
                                }
                              >
                                {studio}
                              </ClickableText>
                              {index < animeData.studios.length - 1 && ', '}
                            </React.Fragment>
                          ))}
                        </strong>
                      </p>
                    ) : (
                      <p>
                        Studios: <strong>Unknown</strong>
                      </p>
                    )}
                  </AnimeDataText>
                </AnimeDataContainerMiddle>
                <AnimeDataContainerBottom>
                  <AnimeDataText>
                    {animeData.totalEpisodes !== null ? (
                      <p>
                        Episodes: <strong>{animeData.totalEpisodes}</strong>
                      </p>
                    ) : (
                      <p>
                        Episodes: <strong>Unknown</strong>
                      </p>
                    )}
                    {animeData.duration ? (
                      <p>
                        Duration: <strong>{animeData.duration} min</strong>
                      </p>
                    ) : (
                      <p>
                        Duration: <strong>Unknown</strong>
                      </p>
                    )}
                    {animeData.season ? (
                      <p>
                        Season:{' '}
                        <ClickableText onClick={() => navigate(`/search?season=${animeData.season?.toUpperCase()}`)}>
                          <strong>
                            {animeData.season.toUpperCase()}
                          </strong>
                        </ClickableText>
                      </p>
                    ) : (
                      <p>
                        Season: <strong>Unknown</strong>
                      </p>
                    )}
                    {animeData.countryOfOrigin && (
                      <p>
                        Country: <strong>{animeData.countryOfOrigin}</strong>
                      </p>
                    )}
                    {animeData.genres && animeData.genres.length > 0 ? (
                      <p>
                        Genres:{' '}
                        <strong>
                          {animeData.genres.map((genre, index) => (
                            <React.Fragment key={genre}>
                              <ClickableText
                                onClick={() =>
                                  navigate(`/search?genres=${encodeURIComponent(genre)}`)
                                }
                              >
                                {genre}
                              </ClickableText>
                              {index < animeData.genres.length - 1 && ', '}
                            </React.Fragment>
                          ))}
                        </strong>
                      </p>
                    ) : (
                      <p>
                        Genres: <strong>Unknown</strong>
                      </p>
                    )}
                  </AnimeDataText>
                </AnimeDataContainerBottom>
              </ParentContainer>
            </AnimeDataText>
          </AnimeDataContainerTop>
        </AnimeDataContainer>
      )}
      {animeData.relations &&
        animeData.relations.some(
          (relation: any) =>
            relation.relationType.toUpperCase() === 'PREQUEL' ||
            relation.relationType.toUpperCase() === 'SEQUEL',
        ) && (
          <>
            <AnimeDataText>
              <p className='Seasons-Sections-Titles'>SEASONS</p>
              <Seasons
                relations={animeData.relations.filter(
                  (relation: any) =>
                    relation.relationType.toUpperCase() === 'PREQUEL' ||
                    relation.relationType.toUpperCase() === 'SEQUEL',
                )}
              />
            </AnimeDataText>
          </>
        )}
      {showTrailer && (
        <TrailerOverlay onClick={toggleTrailer}>
          <TrailerOverlayContent onClick={(e) => e.stopPropagation()}>
            <IframeTrailer
              src={`https://www.youtube.com/embed/${animeData.trailer.id}`}
              allowFullScreen
            />
          </TrailerOverlayContent>
        </TrailerOverlay>
      )}
    </>
  );
};
