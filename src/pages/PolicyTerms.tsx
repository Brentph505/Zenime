import styled, { css, keyframes } from 'styled-components';
import { useEffect, useState } from 'react';
import { FiMail } from 'react-icons/fi';

// Approximate rendered height of the site's fixed <Navbar />
// (1rem top/bottom padding + its content row). Adjust this one value
// if the real navbar's height ever changes — nothing else needs to move.
const SITE_NAVBAR_HEIGHT = '4.75rem';
const SITE_NAVBAR_OFFSET = '76px';

const PageWrap = styled.div`
  width: 100%;
  max-width: 100rem;
  margin: 0 auto;
  padding: 1rem clamp(1rem, 4vw, 3rem) 3.5rem;
  box-sizing: border-box;
`;

const Header = styled.header`
  border-bottom: 1px solid var(--global-border);
  padding-bottom: 1.5rem;
  margin-bottom: 1.75rem;
`;

const Title = styled.h1`
  margin: 0 0 0.5rem;
  color: var(--global-text);
  font-size: clamp(1.7rem, 3.2vw, 2.3rem);
  line-height: 1.15;
  letter-spacing: -0.02em;
`;

const Meta = styled.p`
  margin: 0 0 0.9rem;
  color: var(--global-text-muted);
  font-size: 0.82rem;
`;

const Intro = styled.p`
  margin: 0;
  max-width: 46rem;
  color: var(--global-text-muted);
  line-height: 1.65;
  font-size: 0.95rem;
`;

const HighlightsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 1rem;
  margin-bottom: 2.25rem;
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
`;

const AccentBar = styled.span<{ $from: string; $to: string; $vertical?: boolean }>`
  position: absolute;
  ${({ $vertical }) =>
    $vertical
      ? css`
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background-size: 100% 200%;
          background-image: linear-gradient(
            180deg,
            ${({ theme }) => ''}
          );
        `
      : css`
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background-size: 200% 100%;
        `}
  background-image: linear-gradient(
    ${({ $vertical }) => ($vertical ? '180deg' : '90deg')},
    ${({ $from }) => $from},
    ${({ $to }) => $to},
    ${({ $from }) => $from}
  );
  animation: ${gradientShift} 4s ease-in-out infinite alternate;
  border-radius: 999px;
`;

const HighlightCard = styled.div`
  position: relative;
  background: var(--global-secondary-bg);
  padding: 0.9rem 1rem 1rem;
  border-radius: 0.3rem;
  overflow: hidden;
`;

const HighlightLabel = styled.p`
  margin: 0 0 0.3rem;
  color: var(--global-text);
  font-weight: 700;
  font-size: 0.88rem;
`;

const HighlightText = styled.p`
  margin: 0;
  color: var(--global-text-muted);
  line-height: 1.5;
  font-size: 0.83rem;
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  align-items: start;

  @media (min-width: 860px) {
    grid-template-columns: 16rem 1fr;
  }

  @media (min-width: 1280px) {
    grid-template-columns: 18rem 1fr 16rem;
  }
`;

const Nav = styled.nav`
  display: flex;
  gap: 0.4rem 1rem;
  overflow-x: auto;
  position: sticky;
  top: ${SITE_NAVBAR_HEIGHT};
  z-index: 5;
  background: var(--global-bg, var(--global-secondary-bg));
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--global-border);
  margin-bottom: 0.5rem;

  @media (min-width: 860px) {
    top: ${SITE_NAVBAR_HEIGHT};
    flex-direction: column;
    overflow-x: visible;
    background: none;
    padding: 0;
    border-bottom: none;
    margin-bottom: 0;
  }
`;

const NavLink = styled.a<{ $active?: boolean; $from: string; $to: string }>`
  position: relative;
  flex: 0 0 auto;
  padding: 0.35rem 0 0.35rem 0.8rem;
  color: ${({ $active }) => ($active ? 'var(--global-text)' : 'var(--global-text-muted)')};
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  font-size: 0.9rem;
  text-decoration: none;

  &:hover {
    color: var(--global-text);
  }
`;

const Content = styled.div`
  min-width: 0;
`;

const Part = styled.section`
  margin-bottom: 2.25rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const PartHeading = styled.h2`
  position: relative;
  margin: 0 0 1rem;
  padding-bottom: 0.6rem;
  padding-left: 0.9rem;
  border-bottom: 1px solid var(--global-border);
  color: var(--global-text);
  font-size: 1.15rem;
  letter-spacing: -0.01em;
`;

const ClauseColumns = styled.div`
  @media (min-width: 1500px) {
    column-count: 2;
    column-gap: 3rem;
  }
`;

const Clause = styled.div`
  display: grid;
  grid-template-columns: 1.75rem 1fr;
  gap: 0.75rem;
  padding: 0.9rem 0;
  break-inside: avoid;

  & + & {
    border-top: 1px solid var(--global-border);
  }
`;

const ClauseNumber = styled.span<{ $accent: string }>`
  color: ${({ $accent }) => $accent};
  font-weight: 700;
  font-size: 0.85rem;
  padding-top: 0.1rem;
`;

const ClauseBody = styled.div``;

const ClauseTitle = styled.h3`
  margin: 0 0 0.3rem;
  color: var(--global-text);
  font-size: 0.95rem;
`;

const ClauseText = styled.p`
  margin: 0;
  color: var(--global-text-muted);
  line-height: 1.6;
  font-size: 0.9rem;
`;

const Aside = styled.aside`
  display: none;

  @media (min-width: 1280px) {
    display: block;
    position: sticky;
    top: calc(${SITE_NAVBAR_HEIGHT} + 0.5rem);
    border-left: 1px solid var(--global-border);
    padding-left: 1.5rem;
  }
`;

const AsideHeading = styled.h2`
  margin: 0 0 0.9rem;
  color: var(--global-text);
  font-size: 0.95rem;
`;

const LegendList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

const LegendItem = styled.li<{ $accent: string }>`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--global-text-muted);
  font-size: 0.85rem;

  &::before {
    content: '';
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: ${({ $accent }) => $accent};
    flex-shrink: 0;
  }
`;

const Callout = styled.div<{ $accent: string }>`
  position: relative;
  margin-top: 2.5rem;
  border: 1px solid ${({ $accent }) => `${$accent}4D`};
  background: ${({ $accent }) => `${$accent}14`};
  border-radius: 0.5rem;
  padding: 1.1rem 1.25rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  overflow: hidden;
`;

const CalloutText = styled.p`
  margin: 0;
  color: var(--global-text);
  font-size: 0.92rem;
`;

const ContactLink = styled.a`
  color: var(--primary-accent);
  font-weight: 700;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
`;

// Each accent is paired with a close neighbour on the same hue rather than
// a far color, so the animated gradient reads as a subtle shimmer, not a
// rainbow.
const PRIVACY_ACCENT = { from: '#7c6af6', to: '#a996ff' };
const TERMS_ACCENT = { from: '#4dc2ff', to: '#8fdcff' };
const GREEN_ACCENT = { from: '#5cc7a1', to: '#8fe0c2' };
const AMBER_ACCENT = { from: '#f2b84b', to: '#ffd479' };

const sections = [
  {
    id: 'privacy',
    part: 'Privacy Policy',
    accent: PRIVACY_ACCENT,
    clauses: [
      {
        title: 'Data we collect',
        text: 'We keep only the minimal account and preference data needed to run the app smoothly, and nothing more than that.',
      },
      {
        title: 'Local storage and history',
        text: 'Lightweight local storage and caching preserve your watch progress, history, and preferences on your own device.',
      },
      {
        title: 'Third-party services',
        text: 'Embedded videos and partner platforms follow their own privacy rules. We encourage you to review those policies on their sites.',
      },
      {
        title: 'Security',
        text: 'We work to keep data protected, though no service connected to the internet can guarantee complete security.',
      },
      {
        title: 'Changes to this policy',
        text: 'We may revise this policy over time. The current version is always the one posted on this page.',
      },
    ],
  },
  {
    id: 'terms',
    part: 'Terms of Service',
    accent: TERMS_ACCENT,
    clauses: [
      {
        title: 'Acceptance of terms',
        text: 'By accessing the site, you agree to these terms and to their governing your use of the platform.',
      },
      {
        title: 'Content',
        text: 'The site embeds media from third-party sources. We do not host or claim ownership of that original content.',
      },
      {
        title: 'Responsible use',
        text: 'You must not misuse the service or use it in a way that violates local laws or a partner platform\u2019s own policies.',
      },
      {
        title: 'Restrictions',
        text: 'We reserve the right to remove content or suspend access when a violation of these terms is identified.',
      },
      {
        title: 'Changes to these terms',
        text: 'Continued use of the site after an update means you accept whatever changes were made to these terms.',
      },
    ],
  },
];

const highlights = [
  {
    accent: PRIVACY_ACCENT,
    label: 'Minimal data',
    text: 'Only the account and preference data needed to run your experience.',
  },
  {
    accent: TERMS_ACCENT,
    label: 'On-device history',
    text: 'Watch progress and history stay in your own browser storage.',
  },
  {
    accent: GREEN_ACCENT,
    label: 'Third-party sources',
    text: 'Embedded players follow their own separate privacy rules.',
  },
  {
    accent: AMBER_ACCENT,
    label: 'Living document',
    text: 'Terms update over time. This page always shows the current version.',
  },
];

let clauseCounter = 0;
const numberedSections = sections.map((section) => ({
  ...section,
  clauses: section.clauses.map((clause) => ({
    ...clause,
    number: ++clauseCounter,
  })),
}));

function PolicyTerms() {
  const [activeId, setActiveId] = useState(numberedSections[0].id);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Policy & Terms | Zenime';

    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    const targets = numberedSections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: `-${SITE_NAVBAR_OFFSET} 0px -70% 0px` }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <PageWrap>
      <Header>
        <Title>Privacy Policy & Terms of Service</Title>
        <Meta>Last updated: this page reflects our current practices at any given time.</Meta>
        <Intro>
          This page explains what data we handle, how the service may be used, and
          what to expect while using Zenime.
        </Intro>
      </Header>

      <HighlightsRow>
        {highlights.map((item) => (
          <HighlightCard key={item.label}>
            <AccentBar $from={item.accent.from} $to={item.accent.to} />
            <HighlightLabel>{item.label}</HighlightLabel>
            <HighlightText>{item.text}</HighlightText>
          </HighlightCard>
        ))}
      </HighlightsRow>

      <Layout>
        <Nav aria-label="Sections">
          {numberedSections.map((section) => (
            <NavLink
              key={section.id}
              href={`#${section.id}`}
              $active={activeId === section.id}
              $from={section.accent.from}
              $to={section.accent.to}
            >
              {activeId === section.id && (
                <AccentBar $vertical $from={section.accent.from} $to={section.accent.to} />
              )}
              {section.part}
            </NavLink>
          ))}
        </Nav>

        <Content>
          {numberedSections.map((section) => (
            <Part key={section.id} id={section.id}>
              <PartHeading>
                <AccentBar $vertical $from={section.accent.from} $to={section.accent.to} />
                {section.part}
              </PartHeading>
              <ClauseColumns>
                {section.clauses.map((clause) => (
                  <Clause key={clause.number}>
                    <ClauseNumber $accent={section.accent.from}>{clause.number}.</ClauseNumber>
                    <ClauseBody>
                      <ClauseTitle>{clause.title}</ClauseTitle>
                      <ClauseText>{clause.text}</ClauseText>
                    </ClauseBody>
                  </Clause>
                ))}
              </ClauseColumns>
            </Part>
          ))}

          <Callout $accent={GREEN_ACCENT.from}>
            <AccentBar $from={GREEN_ACCENT.from} $to={GREEN_ACCENT.to} />
            <CalloutText>Questions or concerns about any of this?</CalloutText>
            <ContactLink href="mailto:miruro@proton.me">
              <FiMail />
              miruro@proton.me
            </ContactLink>
          </Callout>
        </Content>

        <Aside>
          <AsideHeading>Sections</AsideHeading>
          <LegendList>
            {numberedSections.map((section) => (
              <LegendItem key={section.id} $accent={section.accent.from}>
                {section.part}
              </LegendItem>
            ))}
          </LegendList>
        </Aside>
      </Layout>
    </PageWrap>
  );
}

export default PolicyTerms;