import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { Relation } from '../../index';
import { useTitleWithSubtitle } from '../../hooks/useTitleWithSubtitle';

const SeasonCardContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 1rem;
  margin-bottom: 1rem;

  @media (min-width: 641px) {
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  }
`;

const SeasonCard = styled(Link)`
  background-size: cover;
  background-position: center;
  padding: 0.6rem;
  height: 5rem;

  @media (max-width: 640px) {
    height: 2.5rem;
    padding: 0.5rem;
  }

  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-radius: 0.3rem;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  cursor: pointer;
  text-decoration: none;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: var(--global-border-radius);
    z-index: 1;
  }

  transition: transform 0.2s ease-in-out;

  &:hover,
  &:active,
  &:focus {
    transform: translateY(-5px);
    @media (max-width: 640px) {
      transform: none;
    }
  }
`;

const Content = styled.div`
  position: relative;
  z-index: 2;
  width: 100%;
`;

const SeasonName = styled.div`
  font-size: 0.8rem;
  @media (max-width: 640px) {
    font-size: 0.65rem;
  }
  color: white;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RelationType = styled.div`
  font-size: 1.1rem;
  @media (max-width: 640px) {
    font-size: 0.75rem;
    margin-bottom: 0.15rem;
  }
  font-weight: bold;
  color: white;
  border-radius: var(--global-border-radius);
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
  margin-bottom: 0.5rem;
`;

interface SeasonCardItemProps {
  relation: Relation;
}

const SeasonCardItem: React.FC<SeasonCardItemProps> = ({ relation }) => {
  const { title: displayTitle, subtitle: displaySubtitle } = useTitleWithSubtitle(relation.title);

  return (
    <SeasonCard
      to={`/watch/${relation.id}`}
      title={`Watch ${displayTitle}`}
      aria-label={`Watch ${displayTitle}`}
      style={{ backgroundImage: `url(${relation.image})` }}
    >
      <img
        src={relation.image}
        alt={`${displayTitle} Cover`}
        style={{ display: 'none' }}
      />
      <Content>
        <RelationType>{relation.relationType}</RelationType>
        <SeasonName>{displayTitle}</SeasonName>
      </Content>
    </SeasonCard>
  );
};

export const Seasons: React.FC<{ relations: Relation[] }> = ({ relations }) => {
  const sortedRelations = [...relations].sort((a, b) => {
    if (a.relationType === 'PREQUEL' && b.relationType !== 'PREQUEL') return -1;
    if (a.relationType !== 'PREQUEL' && b.relationType === 'PREQUEL') return 1;
    return 0;
  });

  return (
    <SeasonCardContainer>
      {sortedRelations.map((relation) => (
        <SeasonCardItem key={relation.id} relation={relation} />
      ))}
    </SeasonCardContainer>
  );
};