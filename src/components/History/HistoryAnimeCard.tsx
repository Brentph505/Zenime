import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { FaPlay } from 'react-icons/fa';
import { IoIosCloseCircleOutline } from 'react-icons/io';
import { useSettings } from '../Profile/SettingsProvider';

interface HistoryAnimeCardProps {
  animeId: string;
  titleEnglish?: string;
  titleRomaji?: string;
  coverImage?: string;
  lastEpisodeNumber: string | number;
  lastEpisodeTitle?: string;
  playbackPercentage: number;
  genres?: string[];
  isAdult?: boolean;
  onDelete: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void;
}

const PlayIcon = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ffffff;
  font-size: 2.5rem;
  opacity: 0;
  z-index: 1;
  transition: opacity 0.2s ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`;

const AnimeCloseButton = styled.button`
  position: absolute;
  top: 0.15rem;
  right: 0.15rem;
  background: transparent;
  border: none;
  color: #ffffff;
  cursor: pointer;
  display: none;
  transition: 0.2s ease-in-out;
  padding: 0.15rem;
  z-index: 2;
  line-height: 1;

  svg {
    font-size: 1.35rem;
    transition: transform 0.2s ease-in-out;
    transform: scale(0.95);

    &:hover,
    &:active,
    &:focus {
      transform: scale(1);
    }
  }
`;

const AnimeProgressBar = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  height: 0.25rem;
  border-radius: var(--global-border-radius);
  background-color: var(--primary-accent);
  transition: width 0.3s ease-in-out;
`;

const AdultBadge = styled.span`
  position: absolute;
  top: 0.35rem;
  left: 0.35rem;
  z-index: 2;
  padding: 0.18rem 0.4rem;
  background: rgba(220, 38, 38, 0.95);
  color: #ffffff;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-radius: 999px;
  white-space: nowrap;
`;

const AnimeCard = styled(Link)`
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transition: box-shadow 0.2s ease-in-out;
  text-decoration: none;

  &:hover,
  &:active,
  &:focus {
    box-shadow: 2px 2px 10px var(--global-card-hover-shadow);

    ${PlayIcon} {
      opacity: 1;
    }

    ${AnimeCloseButton} {
      display: block;
    }
  }

  .episode-info {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    padding: 0.5rem;
    background: linear-gradient(
      360deg,
      rgba(8, 8, 8, 1) -15%,
      transparent 100%
    );
    color: white;
    box-sizing: border-box;

    .episode-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 0.95rem;
      font-weight: bold;
      margin: 0.25rem 0 0;
    }

    .episode-number {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.65);
      margin: 0.15rem 0 0.35rem;
    }
  }
`;

const HistoryCardImage = styled.img<{ $blurred?: boolean }>`
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  display: block;
  background: linear-gradient(135deg, var(--global-secondary-bg, #161b22) 0%, var(--global-tertiary-bg, #21262d) 100%);
  transition: filter 0.2s ease-in-out;
  filter: ${({ $blurred }) => ($blurred ? 'blur(5px) brightness(0.75)' : 'none')};

  ${AnimeCard}:hover & {
    filter: brightness(0.5);
  }
`;

export const HistoryAnimeCard: React.FC<HistoryAnimeCardProps> = ({
  animeId,
  titleEnglish,
  titleRomaji,
  coverImage,
  lastEpisodeNumber,
  lastEpisodeTitle,
  playbackPercentage,
  genres,
  isAdult,
  onDelete,
}) => {
  const { settings } = useSettings();

  const animeTitle = String(titleEnglish || titleRomaji || 'Unknown Anime');
  const cleanEpisodeNumber = String(lastEpisodeNumber || 1).split('-')[0];
  const displayTitle = `${animeTitle}${lastEpisodeTitle ? ` - ${lastEpisodeTitle}` : ''}`;

  const normalizedGenres = genres?.map((genre) => genre?.toLowerCase()) ?? [];
  const isHentai = normalizedGenres.some((genre) => genre === 'hentai');
  const isNsfw = isAdult || normalizedGenres.some((genre) => genre === 'ecchi');
  const shouldBlur = Boolean(
    (isHentai && settings.blurHentai) ||
      (!isHentai && isNsfw && settings.blurNSFW),
  );

  return (
    <AnimeCard
      to={`/watch/${animeId}?ep=${cleanEpisodeNumber}`}
      title={`Continue watching ${animeTitle}`}
    >
      <HistoryCardImage
        src={coverImage || ''}
        alt={`Cover for ${animeTitle}`}
        data-title={animeTitle}
        $blurred={shouldBlur}
        onError={(e) => {
          e.currentTarget.style.visibility = 'hidden';
        }}
        onLoad={(e) => {
          e.currentTarget.style.visibility = '';
        }}
      />

      {(isHentai || isNsfw) && (
        <AdultBadge>{isHentai ? '+18 Hentai' : '+18 NSFW'}</AdultBadge>
      )}

      <PlayIcon aria-label='Play'>
        <FaPlay />
      </PlayIcon>

      <div className='episode-info'>
        <p className='episode-title'>{displayTitle}</p>
        <p className='episode-number'>Episode {cleanEpisodeNumber}</p>
      </div>

      <AnimeProgressBar style={{ width: `${Math.max(playbackPercentage, 5)}%` }} />

      <AnimeCloseButton
        onClick={(e) => onDelete(animeId, e)}
        title='Remove from history'
        aria-label='Remove from history'
      >
        <IoIosCloseCircleOutline aria-hidden='true' />
      </AnimeCloseButton>
    </AnimeCard>
  );
};

export default HistoryAnimeCard;
