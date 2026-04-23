import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { TbCards } from 'react-icons/tb';
import { FaStar } from 'react-icons/fa';
import { Anime, StatusIndicator } from '../../index';

const Sidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: 0.2s ease-in-out;
  width: 100%;
  max-width: 100%;
  .Section-Title {
    margin: 0;
    padding: 0 0 0.5rem 0;
    color: var(--global-text);
    font-size: 1rem;
    font-weight: bold;
  }
  @media (max-width: 1000px) {
    max-width: 100%;
    gap: 0.4rem;
  }
  @media (max-width: 500px) {
    gap: 0.25rem;
  }
`;

const SidebarContainer = styled.div`
  padding: 0.5rem;
  background-color: var(--global-div-tr);
  border-radius: var(--global-border-radius);
  width: 100%;
  @media (max-width: 1000px) {
    padding: 0.3rem;
  }
  @media (max-width: 500px) {
    padding: 0.25rem;
  }
`;

const Card = styled.div`
  display: flex;
  background-color: var(--global-div);
  border-radius: var(--global-border-radius);
  align-items: center;
  overflow: hidden;
  gap: 0.4rem;
  cursor: pointer;
  margin-bottom: 0.35rem;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  animation: slideUp 0.5s ease-in-out;
  animation-fill-mode: backwards;
  transition:
    background-color 0s ease-in-out,
    margin-left 0.2s ease-in-out 0.1s;
  &:hover,
  &:active,
  &:focus {
    background-color: var(--global-div-tr);
    margin-left: 0.35rem;
    @media (max-width: 500px) {
      margin-left: unset;
    }
  }
  @media (max-width: 1000px) {
    gap: 0.3rem;
    margin-bottom: 0.25rem;
  }
`;

const AnimeImage = styled.img`
  width: 3.5rem;
  height: 5rem;
  object-fit: cover;
  border-radius: var(--global-border-radius);
  flex-shrink: 0;
  @media (max-width: 1000px) {
    width: 3rem;
    height: 4.5rem;
  }
`;

const Info = styled.div``;

const TitleWithDot = styled.div`
  display: flex;
  align-items: center;
  padding: 0.3rem;
  margin-top: 0;
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
  top: 0;
  margin-bottom: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.85rem;
  margin: 0;
  @media (max-width: 1000px) {
    font-size: 0.8rem;
    -webkit-line-clamp: 2;
  }
`;

const Details = styled.p`
  font-size: 0.7rem;
  margin: 0.2rem 0 0 0;
  color: rgba(102, 102, 102, 0.75);
  svg {
    margin-left: 0.2rem;
  }
  @media (max-width: 1000px) {
    font-size: 0.65rem;
    margin-top: 0.1rem;
  }
`;

export const AnimeDataList: React.FC<{ animeData: Anime }> = ({
  animeData,
}) => {
  const filteredRecommendations = animeData.recommendations.filter((rec) =>
    ['OVA', 'SPECIAL', 'TV', 'MOVIE', 'ONA', 'NOVEL'].includes(rec.type || ''),
  );

  const filteredRelations = animeData.relations.filter((rel) =>
    ['OVA', 'SPECIAL', 'TV', 'MOVIE', 'ONA', 'NOVEL', 'MANGA'].includes(
      rel.type || '',
    ),
  );

  return (
    <Sidebar>
      {filteredRelations.length > 0 && (
        <SidebarContainer>
          <>
            <p className='Section-Title'>RELATED</p>
            {filteredRelations
              .slice(0, window.innerWidth > 500 ? 5 : 3)
              .map((relation, index) => (
                <Link
                  to={`/watch/${relation.id}`}
                  key={relation.id}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                  title={`${relation.title.userPreferred}`}
                  aria-label={`Watch ${relation.title.userPreferred}`}
                >
                  <Card style={{ animationDelay: `${index * 0.1}s` }}>
                    <AnimeImage
                      src={relation.image}
                      alt={relation.title.userPreferred}
                      loading='lazy'
                    />
                    <Info>
                      <TitleWithDot>
                        <StatusIndicator status={relation.status} />
                        <Title>
                          {relation.title.english ??
                            relation.title.romaji ??
                            relation.title.userPreferred}
                        </Title>
                      </TitleWithDot>
                      <Details
                        aria-label={`Details about ${relation.title.userPreferred}`}
                      >
                        {/* Conditionally render each piece of detail only if it's not null or empty */}
                        {relation.type && `${relation.type} `}
                        {relation.episodes && (
                          <>
                            <TbCards aria-hidden='true' />{' '}
                            {`${relation.episodes} `}
                          </>
                        )}
                        {relation.rating && (
                          <>
                            <FaStar aria-hidden='true' />{' '}
                            {`${relation.rating} `}
                          </>
                        )}
                      </Details>
                    </Info>
                  </Card>
                </Link>
              ))}
          </>
        </SidebarContainer>
      )}
      {filteredRecommendations.length > 0 && (
        <SidebarContainer>
          <>
            <p className='Section-Title'>RECOMMENDED</p>
            {filteredRecommendations
              .slice(0, window.innerWidth > 500 ? 5 : 3)
              .map((recommendation, index) => (
                <Link
                  to={`/watch/${recommendation.id}`}
                  key={recommendation.id}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                  title={`Watch ${recommendation.title.userPreferred}`}
                >
                  <Card style={{ animationDelay: `${index * 0.1}s` }}>
                    <AnimeImage
                      src={recommendation.image}
                      alt={recommendation.title.userPreferred}
                      loading='lazy'
                    />
                    <Info>
                      <TitleWithDot>
                        <StatusIndicator status={recommendation.status} />
                        <Title>
                          {recommendation.title.english ??
                            recommendation.title.romaji ??
                            recommendation.title.userPreferred}
                        </Title>
                      </TitleWithDot>
                      <Details
                        aria-label={`Details about ${recommendation.title.userPreferred}`}
                      >
                        {/* Similar conditional rendering for recommendation details */}
                        {recommendation.type && `${recommendation.type} `}
                        {recommendation.episodes && (
                          <>
                            <TbCards aria-hidden='true' />{' '}
                            {`${recommendation.episodes} `}
                          </>
                        )}
                        {recommendation.rating && (
                          <>
                            <FaStar aria-hidden='true' />{' '}
                            {`${recommendation.rating} `}
                          </>
                        )}
                      </Details>
                    </Info>
                  </Card>
                </Link>
              ))}
          </>
        </SidebarContainer>
      )}
    </Sidebar>
  );
};
