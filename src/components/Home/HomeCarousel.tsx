import { FC } from 'react';
import styled from 'styled-components';
import { FaPlay } from 'react-icons/fa';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/swiper-bundle.css';
import { useNavigate } from 'react-router-dom';
import { SkeletonSlide, Anime } from '../../index';
import { TbCards } from 'react-icons/tb';
import { FaStar } from 'react-icons/fa';
import { FaClock } from 'react-icons/fa6';
import { FaInfoCircle } from 'react-icons/fa';
import { useSettings } from '../Profile/SettingsProvider';

const StyledSwiperContainer = styled(Swiper)`
  position: relative;
  max-width: 100%;
  height: 24rem;
  border-radius: var(--global-border-radius);
  cursor: grab;

  @media (max-width: 1000px) {
    height: 20rem;
  }
  @media (max-width: 500px) {
    height: 18rem;
  }
`;

const StyledSwiperSlide = styled(SwiperSlide)`
  position: relative;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  animation: fadeIn 0.4s ease-in-out forwards;
`;

/* Desktop: diagonal side gradient. Mobile: stronger bottom-up for legibility */
const DarkOverlay = styled.div`
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  border-radius: var(--global-border-radius);
  z-index: 1;
  background: linear-gradient(45deg, rgba(8, 8, 8, 1) 0%, transparent 60%);

  @media (max-width: 500px) {
    background: linear-gradient(
      to top,
      rgba(8, 8, 8, 0.97) 0%,
      rgba(8, 8, 8, 0.75) 55%,
      rgba(8, 8, 8, 0.15) 100%
    );
  }
`;

const SlideImageWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--global-border-radius);
`;

const SlideImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--global-border-radius);
  position: absolute;
`;

const ContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
`;

/*
 * Desktop: bottom-left, 60% wide.
 * Mobile: sits above the button row + dot row, content pushed higher.
 */
const SlideContent = styled.div`
  position: absolute;
  left: 2rem;
  bottom: 1.5rem;
  z-index: 5;
  max-width: 60%;
  animation: slideUp 0.4s ease-in-out;

  @media (max-width: 1000px) {
    left: 1rem;
    bottom: 1.5rem;
  }

  @media (max-width: 500px) {
    left: 0;
    right: 0;
    /* buttons ~2.5rem + dots ~1.4rem + gaps ~0.75rem */
    bottom: calc(2.5rem + 1.4rem + 0.75rem);
    max-width: 100%;
    padding: 0 0.85rem;
  }
`;

const SlideTitle = styled.h2`
  color: var(--white, #fff);
  font-size: clamp(1.2rem, 3vw, 2.5rem);
  margin: auto;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (min-width: 500px) {
    white-space: nowrap;
    max-width: 100%;
  }

  @media (max-width: 500px) {
    font-size: 1rem;
    white-space: nowrap;
    margin: 0 0 0.2rem;
  }
`;

const SlideInfo = styled.div`
  display: flex;
  gap: 0.75rem;
  color: #ffffff;
  margin: auto;
  margin-top: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 1000px) {
    font-size: 0.8rem;
    gap: 0.5rem;
  }

  @media (max-width: 500px) {
    font-size: 0.68rem;
    gap: 0.4rem;
    margin: 0 0 0.25rem;
    opacity: 0.85;
  }
`;

const SlideInfoItem = styled.p`
  display: flex;
  gap: 0.25rem;
  align-items: center;
  margin: 0;
`;

const SlideDescription = styled.p`
  color: var(--white, #ccc);
  background: transparent;
  font-size: clamp(0.9rem, 1.5vw, 0.9rem);
  line-height: 1.4;
  max-width: 100%;
  /* Fixed height = 3 lines so every slide stays the same size */
  height: calc(1.4em * 3);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;

  @media (max-width: 1000px) {
    font-size: clamp(0.8rem, 1.2vw, 0.9rem);
    line-height: 1.4;
    height: calc(1.4em * 3);
  }

  @media (max-width: 500px) {
    max-width: 100%;
    font-size: 0.7rem;
    line-height: 1.3;
    height: calc(1.3em * 2);
    -webkit-line-clamp: 2;
    opacity: 0.85;
    margin: 0;
  }
`;

/*
 * Desktop: bottom-right.
 * Mobile: full-width row sitting ABOVE the pagination dots.
 *         Leave ~1.4rem at the very bottom for the dots.
 */
const PlayButtonWrapper = styled.div`
  position: absolute;
  right: 2rem;
  bottom: 1.5rem;
  z-index: 5;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: center;

  @media (max-width: 1000px) {
    right: 1.5rem;
    bottom: 1.5rem;
  }

  @media (max-width: 500px) {
    left: 0;
    right: 0;
    /* dots are ~1.4rem tall; sit just above them */
    bottom: 1.5rem;
    padding: 0 0.85rem;
    gap: 0.5rem;
    justify-content: stretch;
  }
`;

const PlayButton = styled.button`
  display: flex;
  gap: 0.5rem;
  background-color: var(--global-button-bg);
  color: var(--global-text);
  border: none;
  border-radius: 0.4rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: 0.2s ease;
  padding: 1.2rem 2rem;
  align-items: center;
  justify-content: center;

  &:hover,
  &:active,
  &:focus {
    background-color: var(--primary-accent-bg);
    transform: scale(1.05);
  }

  @media (max-width: 1000px) {
    padding: 1rem 2rem;
  }

  @media (max-width: 500px) {
    flex: 1;
    border-radius: 0.4rem;
    padding: 0.55rem 0.75rem;
    font-size: 0.78rem;
    gap: 0.35rem;
    span {
      display: inline;
    }
  }
`;

/*
 * Detail button: semi-transparent dark background so it stays readable
 * on both dark images AND light/white areas near slide edges.
 */
const DetailButton = styled.button`
  display: flex;
  gap: 0.5rem;
  background-color: rgba(20, 20, 20, 0.65);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: #ffffff;
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 0.4rem;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: 0.2s ease;
  padding: 1.2rem 2rem;
  align-items: center;
  justify-content: center;

  &:hover,
  &:active,
  &:focus {
    background-color: rgba(20, 20, 20, 0.85);
    border-color: rgba(255, 255, 255, 1);
    transform: scale(1.05);
  }

  @media (max-width: 1000px) {
    padding: 1rem 2rem;
  }

  @media (max-width: 500px) {
    flex: 1;
    border-radius: 0.4rem;
    padding: 0.55rem 0.75rem;
    font-size: 0.78rem;
    gap: 0.35rem;
    span {
      display: inline;
    }
  }
`;

const PlayIcon = styled(FaPlay)``;
const DetailIcon = styled(FaInfoCircle)``;

const PaginationStyle = styled.div`
  .swiper-pagination-bullet {
    background: var(--global-primary-bg, #007bff);
    opacity: 0.7;
    margin: 0 3px;
  }

  .swiper-pagination-bullet-active {
    background: var(--global-text);
    opacity: 1;
  }

  /* On mobile, reset dots to the natural bottom of the swiper */
  @media (max-width: 500px) {
    .swiper-pagination {
      bottom: 0.35rem !important;
    }
  }
`;

interface HomeCarouselProps {
  data: Anime[];
  loading: boolean;
  error?: string | null;
}

export const HomeCarousel: FC<HomeCarouselProps> = ({
  data = [],
  loading,
  error,
}) => {
  const navigate = useNavigate();
  const { settings } = useSettings();

  const handlePlayButtonClick = (id: string) => {
    navigate(`/watch/${id}`);
  };

  const handleDetailButtonClick = (id: string) => {
    navigate(`/info/${id}`);
  };

  const getTitleForCarousel = (titleObj: any): string => {
    const english = titleObj.english || '';
    const romaji = titleObj.romaji || '';
    const native = titleObj.native || '';

    if (settings.titleLanguage.includes('English')) {
      return english || romaji || '';
    } else if (settings.titleLanguage.includes('Native')) {
      return native || romaji || english || '';
    } else {
      return romaji || english || '';
    }
  };

  const truncateTitle = (title: string, maxLength: number = 40): string => {
    return title.length > maxLength
      ? `${title.substring(0, maxLength)}...`
      : title;
  };

  const validData = data.filter(
    (item) =>
      item.title &&
      item.title.english &&
      item.description &&
      item.cover !== item.image,
  );
  const hasCarouselItems = validData.length > 0;

  if (loading || error || !hasCarouselItems) {
    return <SkeletonSlide />;
  }

  return (
    <PaginationStyle>
      <StyledSwiperContainer
        spaceBetween={30}
        slidesPerView={1}
        speed={800}
        loop={validData.length >= 3}
        autoplay={{
          delay: 8000,
          disableOnInteraction: false,
        }}
        navigation={{
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        }}
        pagination={{
          el: '.swiper-pagination',
          clickable: true,
          dynamicBullets: true,
          type: 'bullets',
        }}
        freeMode={false}
        virtual={true}
        grabCursor={true}
        keyboard={true}
        centeredSlides={true}
      >
        {validData.map((anime) => {
          const { id, cover, title, description, rating, totalEpisodes, duration, type } = anime;
          return (
            <StyledSwiperSlide
              key={id}
              title={title.english || title.romaji}
            >
              <SlideImageWrapper>
                <SlideImage
                  src={cover}
                  alt={title.english || title.romaji + ' Banner Image'}
                  loading='eager'
                />
                <ContentWrapper>
                  <SlideContent>
                    <SlideTitle>{truncateTitle(getTitleForCarousel(title))}</SlideTitle>
                    <SlideInfo>
                      {type && <SlideInfoItem>{type}</SlideInfoItem>}
                      {totalEpisodes && (
                        <SlideInfoItem>
                          <TbCards />
                          {totalEpisodes}
                        </SlideInfoItem>
                      )}
                      {rating && (
                        <SlideInfoItem>
                          <FaStar />
                          {rating}
                        </SlideInfoItem>
                      )}
                      {duration && (
                        <SlideInfoItem>
                          <FaClock />
                          {duration}mins
                        </SlideInfoItem>
                      )}
                    </SlideInfo>
                    <SlideDescription
                      dangerouslySetInnerHTML={{ __html: description }}
                    />
                  </SlideContent>
                  <PlayButtonWrapper>
                    <DetailButton
                      onClick={() => handleDetailButtonClick(id)}
                      title={
                        'Details for ' + (title.english || title.romaji)
                      }
                    >
                      <DetailIcon />
                      <span>DETAILS</span>
                    </DetailButton>
                    <PlayButton
                      onClick={() => handlePlayButtonClick(id)}
                      title={
                        'Watch ' + (title.english || title.romaji) + ' Now'
                      }
                    >
                      <PlayIcon />
                      <span>WATCH NOW</span>
                    </PlayButton>
                  </PlayButtonWrapper>
                </ContentWrapper>
                <DarkOverlay />
              </SlideImageWrapper>
            </StyledSwiperSlide>
          );
        })}
        <div className='swiper-pagination'></div>
      </StyledSwiperContainer>
    </PaginationStyle>
  );
};
