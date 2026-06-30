import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { StatusIndicator, type Anime } from '../../index';
import { useTitleWithSubtitle } from '../../hooks/useTitleWithSubtitle';
import { FaPlay, FaInfoCircle } from 'react-icons/fa';
import { TbCards } from 'react-icons/tb';
import { FaStar, FaCalendarAlt, FaEdit } from 'react-icons/fa';

// Types that are non-anime formats (manga, light novels, one-shots, etc.)
const MANGA_FORMAT_TYPES = new Set([
  'MANGA', 'ONE_SHOT', 'NOVEL', 'LIGHT_NOVEL',
]);

const StyledCardWrapper = styled.div`
  color: var(--global-text);
  animation: slideUp 0.4s ease;
  text-decoration: none;
  &:hover,
  &:active,
  &:focus {
    z-index: 2;
  }
`;

const StyledCardItem = styled.div`
  width: 100%;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transform: scale(1);
  transition: 0.2s ease-in-out;
`;

const ImageDisplayWrapper = styled.div`
  transition: 0.2s ease-in-out;
  @media (min-width: 501px) {
    &:hover,
    &:active,
    &:focus {
      transform: translateY(-10px);
    }
  }
`;

const AnimeImage = styled.div`
  position: relative;
  text-align: left;
  overflow: hidden;
  border-radius: var(--global-border-radius);
  padding-top: calc(100% * 184 / 133);
  background: var(--global-card-bg);
  box-shadow: 2px 2px 10px var(--global-card-shadow);
  transition: background-color 0.2s ease-in-out;
  animation: slideUp 0.5s ease-in-out;
`;

const PlayIcon = styled(FaPlay)`
  position: absolute;
  top: 50%;
  left: 50%;
  color: #fff;
  transform: translate(-50%, -50%);
  font-size: 2rem;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 1;
`;

const InfoIcon = styled(FaInfoCircle)`
  position: absolute;
  top: 50%;
  left: 50%;
  color: #fff;
  transform: translate(-50%, -50%);
  font-size: 2rem;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 1;
`;

const ImageWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;

  img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: var(--global-border-radius);
    transition: filter 0.3s ease-in-out;
    filter: none;
  }

  &:hover img {
    filter: brightness(0.5);
  }

  &:hover ${PlayIcon} {
    opacity: 1;
  }

  &:hover ${InfoIcon} {
    opacity: 1;
  }
`;

const AdultBadge = styled.span`
  position: absolute;
  top: 0.35rem;
  left: 0.35rem;
  z-index: 2;
  padding: 0.14rem 0.4rem;
  background: rgba(220, 38, 38, 0.95);
  color: #fff;
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-radius: 999px;
  white-space: nowrap;
`;

const PosterLink = styled(Link)`
  display: block;
  text-decoration: none;
`;

const TitleContainer = styled.div<{ $isHovered: boolean }>`
  display: flex;
  align-items: center;
  padding: 0.5rem;
  margin-top: 0.35rem;
  gap: 0.4rem;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background 0.2s ease;
  text-decoration: none;

  &:hover,
  &:active,
  &:focus {
    background: var(--global-card-title-bg);
  }
`;

const TitleLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  text-decoration: none;
  color: inherit;
`;

const Title = styled.h5<{ $isHovered: boolean; color?: string }>`
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: ${(props) => (props.$isHovered ? props.color : 'var(--title-color)')};
  transition: 0.2s ease-in-out;

  @media (max-width: 500px) {
    font-size: 0.7rem;
  }
`;

const ImgDetail = React.memo(styled.p<{ $isHovered: boolean; color?: string }>`
  animation: slideRight 0.2s ease-in-out;
  position: absolute;
  bottom: 0;
  margin: 0.25rem;
  padding: 0.2rem;
  font-size: 0.8rem;
  font-weight: bold;
  color: ${(props) => props.color};
  opacity: 0.9;
  background-color: var(--global-button-shadow);
  border-radius: var(--global-border-radius);
  backdrop-filter: blur(10px);
  transition: 0.2s ease-in-out;
`);

const CardDetails = styled.div`
  animation: slideRight 0.4s ease-in-out;
  width: 100%;
  font-family: Arial;
  font-weight: bold;
  font-size: 0.75rem;
  color: rgba(102, 102, 102, 0.65);
  margin: 0;
  display: flex;
  align-items: center;
  padding: 0.25rem 0rem;
  gap: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  svg {
    margin-bottom: 0.12rem;
    margin-right: -0.4rem;
  }
`;

const EditButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);

  &:hover {
    background: var(--primary-accent, #c084fc);
    transform: scale(1.1);
  }
`;

export const CardItem: React.FC<{ anime: Anime; isLatestTab?: boolean; showEditButton?: boolean; onEdit?: (anime: Anime) => void }> = ({ anime, isLatestTab = false, showEditButton, onEdit }) => {
  // ✅ FIX: Removed the internal `loading` state that was gated by setTimeout(0).
  // That pattern caused every card to render <SkeletonCard /> on mount and
  // then flip to the real card after a microtask — on page 1 the flip raced
  // against React's reconciliation and many cards never resolved.
  // The parent (Home.tsx) already shows a full skeleton grid while data is
  // fetching, so CardItem only ever mounts once data is ready. No internal
  // loading gate is needed here.

  const [isHovered, setIsHovered] = useState(false);
  const [isTitleHovered, setIsTitleHovered] = useState(false);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  const imageSrc = anime.image || '';

  const { title: displayTitle, subtitle: displaySubtitle } = useTitleWithSubtitle(anime.title);

  const isHentaiAnime = Boolean(
    anime.genres?.some((genre) => genre?.toLowerCase() === 'hentai'),
  );
  const isAdultAnime = Boolean(
    anime.isAdult ||
      anime.genres?.some(
        (genre) =>
          genre?.toLowerCase() === 'hentai' ||
          genre?.toLowerCase() === 'ecchi',
      ),
  );

  const truncateTitle = useMemo(
    () => (title: string, maxLength: number) =>
      title.length > maxLength ? `${title.slice(0, maxLength)}...` : title,
    [],
  );

  const displayDetail = useMemo(() => {
    return (
      <ImgDetail $isHovered={isHovered} color={anime.color}>
        {anime.type}
      </ImgDetail>
    );
  }, [isHovered, anime.color, anime.type]);

  return (
    <StyledCardWrapper
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <StyledCardItem>
        {/* Poster → /watch/:id for anime, /info/:id for manga/non-anime formats */}
        <PosterLink
          to={MANGA_FORMAT_TYPES.has(anime.type) ? `/info/${anime.id}?type=${anime.type}` : `${isLatestTab && anime.totalEpisodes ? `/watch/${anime.id}?ep=${anime.totalEpisodes}` : `/watch/${anime.id}`}`}
          title={(MANGA_FORMAT_TYPES.has(anime.type) ? 'Info: ' : 'Play ') + (anime.title.english || anime.title.romaji)}
        >
          <ImageDisplayWrapper>
            <AnimeImage>
              <ImageWrapper>
                <img
                  src={imageSrc}
                  loading='eager'
                  alt={
                    anime.title.english || anime.title.romaji + ' Cover Image'
                  }
                />
                {isAdultAnime && (
                  <AdultBadge>
                    {isHentaiAnime ? '+18 Hentai' : '+18 NSFW'}
                  </AdultBadge>
                )}
                {MANGA_FORMAT_TYPES.has(anime.type) ? (
                  <InfoIcon
                    title={
                      'Info: ' + (anime.title.english || anime.title.romaji)
                    }
                  />
                ) : (
                  <PlayIcon
                    title={
                      'Play ' + (anime.title.english || anime.title.romaji)
                    }
                  />
                )}
              </ImageWrapper>
              {isHovered && displayDetail}
              {showEditButton && onEdit && (
                <EditButton
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(anime);
                  }}
                  title="Edit Entry"
                >
                  <FaEdit size={14} />
                </EditButton>
              )}
            </AnimeImage>
          </ImageDisplayWrapper>
        </PosterLink>

        {/* Title → /info/:id */}
        <TitleContainer
          $isHovered={isTitleHovered}
          onMouseEnter={() => setIsTitleHovered(true)}
          onMouseLeave={() => setIsTitleHovered(false)}
        >
          <TitleLink
            to={`/info/${anime.id}${MANGA_FORMAT_TYPES.has(anime.type) ? `?type=${anime.type}` : ''}`}
            title={'Info: ' + (anime.title.english || anime.title.romaji)}
          >
            <StatusIndicator status={anime.status} />
            <Title
              $isHovered={isTitleHovered}
              color={anime.color}
              title={'Title: ' + (anime.title.english || anime.title.romaji)}
            >
              {truncateTitle(displayTitle, 35)}
            </Title>
          </TitleLink>
        </TitleContainer>

        <div>
          {displaySubtitle && (
            <CardDetails title='Subtitle'>
              {truncateTitle(displaySubtitle, 24)}
            </CardDetails>
          )}
          <CardDetails title='Card Details'>
            {anime.releaseDate && (
              <>
                <FaCalendarAlt />
                {anime.releaseDate}
              </>
            )}
            {(anime.totalEpisodes || anime.episodes) && (
              <>
                <TbCards />
                {anime.totalEpisodes || anime.episodes}
              </>
            )}
            {anime.rating && (
              <>
                <FaStar />
                {anime.rating}
              </>
            )}
          </CardDetails>
        </div>
      </StyledCardItem>
    </StyledCardWrapper>
  );
};