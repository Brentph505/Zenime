import styled from 'styled-components';

/**
 * MangaGrid
 *
 * Shared portrait-poster grid for manga cards (History, Bookmarks, etc.).
 * Extracted from the `MangaGridContainer` that was duplicated inside
 * `pages/History.tsx` so every manga card view uses identical column rules.
 *
 * Columns scale up with viewport width:
 *  3 → 7 across the standard breakpoints.
 */
export const MangaGrid = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, 1fr);

  @media (min-width: 700px) {
    grid-template-columns: repeat(4, 1fr);
  }

  @media (min-width: 1000px) {
    grid-template-columns: repeat(5, 1fr);
  }

  @media (min-width: 1200px) {
    grid-template-columns: repeat(7, 1fr);
  }
`;

export default MangaGrid;
