import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { TbCards } from 'react-icons/tb';
import { FaStar } from 'react-icons/fa';
import { Anime, StatusIndicator } from '../../index';
import { useTitleWithSubtitle } from '../../hooks/useTitleWithSubtitle';
import type { Relation, Recommendation } from '../../hooks/animeInterface';

const isNonWatchableType = (type?: string) =>
  type === 'MANGA' ||
  type === 'NOVEL' ||
  type === 'ONE_SHOT' ||
  type === 'LIGHT_NOVEL';

const Sidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: 0.2s ease-in-out;
  width: 100%;
  max-width: 100%;
  @media (max-width: 1000px) {
    max-width: 100%;
    gap: 0.4rem;
  }
  @media (max-width: 500px) {
    gap: 0.25rem;
  }
`;

const SectionTitle = styled.p`
  margin: 0 0 0.4rem 0;
  padding: 0;
  color: var(--global-text);
  font-size: 1rem;
  font-weight: bold;
`;

const SidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem;
  background-color: var(--global-div-tr);
  border-radius: var(--global-border-radius);
  width: 100%;
  @media (max-width: 1000px) {
    padding: 0.3rem;
    gap: 0.25rem;
  }
  @media (max-width: 500px) {
    padding: 0.25rem;
  }
`;

const Card = styled.div<{ $backgroundImage: string }>`
  display: flex;
  position: relative;
  border-radius: var(--global-border-radius);
  align-items: center;
  overflow: hidden;
  gap: 0.4rem;
  cursor: pointer;
  animation: slideUp 0.5s ease-in-out;
  animation-fill-mode: backwards;
  transition:
    margin-left 0.2s ease-in-out 0.1s,
    box-shadow 0.2s ease-in-out,
    transform 0.2s ease-in-out;

  background: linear-gradient(90deg, rgba(235, 237, 240, 0.96) 0%, rgba(235, 237, 240, 0.88) 60%, rgba(235, 237, 240, 0.55) 100%), url(${({ $backgroundImage }) => $backgroundImage}) center/cover no-repeat;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);

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

    @media (max-width: 500px) {
      margin-left: unset;
      transform: unset;
    }
  }

  @media (max-width: 1000px) {
    gap: 0.3rem;
  }
`;

const AnimeImage = styled.img`
  width: 3.5rem;
  height: 5rem;
  object-fit: cover;
  border-radius: var(--global-border-radius);
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  @media (max-width: 1000px) {
    width: 3rem;
    height: 4.5rem;
  }
`;

const Info = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 0.5rem;
`;

const TitleWithDot = styled.div`
  display: flex;
  align-items: center;
  padding: 0.3rem;
  gap: 0.3rem;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background 0.2s ease;
  @media (max-width: 1000px) {
    padding: 0.25rem;
    gap: 0.25rem;
  }
`;

const Title = styled.p`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.85rem;
  margin: 0;
  font-weight: 600;
  color: var(--global-text);

  @media (max-width: 1000px) {
    font-size: 0.8rem;
  }
`;

const Details = styled.p`
  font-size: 0.7rem;
  margin: 0.2rem 0 0 0.3rem;
  color: var(--global-text);
  opacity: 0.75;

  svg {
    margin-left: 0.2rem;
  }
  @media (max-width: 1000px) {
    font-size: 0.65rem;
    margin-top: 0.1rem;
  }
`;

interface RelatedItemProps {
  relation: Relation;
  index: number;
  isNonWatchable: boolean;
}

const RelatedItemCard: React.FC<RelatedItemProps> = ({ relation, index, isNonWatchable }) => {
  const { title: displayTitle } = useTitleWithSubtitle(relation.title);
  const target = isNonWatchable ? `/info/${relation.id}` : `/watch/${relation.id}`;
  const action = isNonWatchable ? 'Info' : 'Watch';

  return (
    <Link
      key={relation.id}
      to={target}
      style={{ textDecoration: 'none', color: 'inherit' }}
      title={displayTitle}
      aria-label={`${action} ${displayTitle}`}
    >
      <Card
        $backgroundImage={relation.image}
        style={{ animationDelay: `${index * 0.1}s` }}
      >
        <AnimeImage
          src={relation.image}
          alt={displayTitle}
          loading="lazy"
        />
        <Info>
          <TitleWithDot>
            <StatusIndicator status={relation.status} />
            <Title>
              {displayTitle}
            </Title>
          </TitleWithDot>
          <Details aria-label={`Details about ${displayTitle}`}>
            {relation.type && `${relation.type} `}
            {relation.episodes && (
              <>
                <TbCards aria-hidden="true" /> {`${relation.episodes} `}
              </>
            )}
            {relation.rating && (
              <>
                <FaStar aria-hidden="true" /> {`${relation.rating} `}
              </>
            )}
          </Details>
        </Info>
      </Card>
    </Link>
  );
};

interface RecommendationItemProps {
  recommendation: Recommendation;
  index: number;
}

const RecommendationItemCard: React.FC<RecommendationItemProps> = ({ recommendation, index }) => {
  const { title: displayTitle } = useTitleWithSubtitle(recommendation.title);

  return (
    <Link
      key={recommendation.id}
      to={`/watch/${recommendation.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
      title={displayTitle}
      aria-label={`Watch ${displayTitle}`}
    >
      <Card
        $backgroundImage={recommendation.image}
        style={{ animationDelay: `${index * 0.1}s` }}
      >
        <AnimeImage
          src={recommendation.image}
          alt={displayTitle}
          loading="lazy"
        />
        <Info>
          <TitleWithDot>
            <StatusIndicator status={recommendation.status} />
            <Title>
              {displayTitle}
            </Title>
          </TitleWithDot>
          <Details aria-label={`Details about ${displayTitle}`}>
            {recommendation.type && `${recommendation.type} `}
            {recommendation.episodes && (
              <>
                <TbCards aria-hidden="true" /> {`${recommendation.episodes} `}
              </>
            )}
            {recommendation.rating && (
              <>
                <FaStar aria-hidden="true" /> {`${recommendation.rating} `}
              </>
            )}
          </Details>
        </Info>
      </Card>
    </Link>
  );
};

export const AnimeDataList: React.FC<{ animeData: Anime }> = ({ animeData }) => {
  const filteredRecommendations = animeData.recommendations.filter((rec) =>
    ['OVA', 'SPECIAL', 'TV', 'MOVIE', 'ONA', 'NOVEL'].includes(rec.type || ''),
  );

  const filteredRelations = animeData.relations.filter((rel) =>
    ['OVA', 'SPECIAL', 'TV', 'MOVIE', 'ONA', 'NOVEL', 'MANGA'].includes(rel.type || ''),
  );

  const limit = window.innerWidth > 500 ? 5 : 3;

  return (
    <Sidebar>
      {filteredRelations.length > 0 && (
        <>
          <SectionTitle>RELATED</SectionTitle>
          <SidebarContainer>
            {filteredRelations.slice(0, limit).map((relation, index) => (
              <RelatedItemCard
                key={relation.id}
                relation={relation}
                index={index}
                isNonWatchable={isNonWatchableType(relation.type)}
              />
            ))}
          </SidebarContainer>
        </>
      )}

      {filteredRecommendations.length > 0 && (
        <>
          <SectionTitle>RECOMMENDED</SectionTitle>
          <SidebarContainer>
            {filteredRecommendations.slice(0, limit).map((recommendation, index) => (
              <RecommendationItemCard
                key={recommendation.id}
                recommendation={recommendation}
                index={index}
              />
            ))}
          </SidebarContainer>
        </>
      )}
    </Sidebar>
  );
};