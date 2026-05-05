import React, { useState } from 'react';
import styled from 'styled-components';
import {
  FaBell,
  FaDownload,
  FaShare,
  FaServer,
} from 'react-icons/fa';

// Props interface
interface MediaSourceProps {
  sourceType: string;
  setSourceType: (sourceType: string) => void;
  downloadLink: string;
  episodeId?: string;
  airingTime?: string;
  nextEpisodenumber?: string;
  availableServers?: string[];
  embeddedServerName?: string;
  /** Server keys that should display with the EM (iframe) badge */
  embeddedServerKeys?: Set<string>;
}

const UpdatedContainer = styled.div`
  justify-content: center;
  margin-top: 1rem;
  gap: 1rem;
  display: flex;
  @media (max-width: 1000px) {
    flex-direction: column;
  }
`;

const ServerContainer = styled.div`
  background-color: var(--global-div-tr);
  padding: 1rem;
  border-radius: var(--global-border-radius);
`;

const ServerTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-weight: bold;
  color: var(--global-text);
  font-size: 0.95rem;
`;

const ServerGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  width: 100%;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
  }
  
  @media (max-width: 500px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const ServerButton = styled.button`
  padding: 0.6rem;
  border: 2px solid transparent;
  font-weight: bold;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  background-color: var(--global-div);
  color: var(--global-text);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
  text-align: center;
  font-size: 0.85rem;
  white-space: normal;
  word-break: break-word;
  
  &:hover {
    background-color: var(--primary-accent);
    transform: scale(1.025);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &.active {
    background-color: var(--primary-accent);
    border-color: var(--primary-accent);
  }
`;

const ServerLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  
  .server-name {
    font-size: 0.85rem;
  }
  
  .em-badge {
    font-size: 0.6rem;
    color: #ff6b6b;
    font-weight: bold;
    text-transform: uppercase;
  }
`;

const LoadingServers = styled.div`
  font-size: 0.8rem;
  color: var(--global-text);
  opacity: 0.6;
  padding: 0.4rem 0;
`;

const DownloadLink = styled.a`
  display: inline-flex;
  align-items: center;
  margin-left: 0.5rem;
  padding: 0.5rem;
  gap: 0.25rem;
  font-size: 0.9rem;
  font-weight: bold;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  background-color: var(--global-div);
  color: var(--global-text);
  text-align: center;
  text-decoration: none;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease-in-out;

  svg {
    font-size: 0.85rem;
  }

  &:hover {
    background-color: var(--primary-accent);
    transform: scale(1.025);
  }
  &:active {
    transform: scale(0.975);
  }
`;

const ShareButton = styled.button`
  display: inline-flex;
  align-items: center;
  margin-left: 0.5rem;
  padding: 0.5rem;
  gap: 0.25rem;
  font-size: 0.9rem;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  background-color: var(--global-div);
  color: var(--global-text);
  text-decoration: none;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: var(--primary-accent);
  }
  
  svg {
    font-size: 0.85rem;
  }
`;

const EpisodeInfoColumn = styled.div`
  flex-grow: 1;
  display: block;
  background-color: var(--global-div-tr);
  border-radius: var(--global-border-radius);
  padding: 0.75rem;
  @media (max-width: 1000px) {
    display: block;
    margin-right: 0rem;
  }
  p {
    font-size: 0.9rem;
    margin: 0;
  }
  h4 {
    margin: 0rem;
    font-size: 1.15rem;
    margin-bottom: 1rem;
  }
  @media (max-width: 500px) {
    p {
      font-size: 0.8rem;
      margin: 0rem;
    }
    h4 {
      font-size: 1rem;
      margin-bottom: 0rem;
    }
  }
`;

export const MediaSource: React.FC<MediaSourceProps> = ({
  sourceType,
  setSourceType,
  downloadLink,
  episodeId,
  airingTime,
  nextEpisodenumber,
  availableServers = [],
  embeddedServerName = 'Embedded',
  embeddedServerKeys,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleShareClick = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  /**
   * Build the server button list from verified HLS servers only.
   */
  const buildServerButtons = () => {
    // Filter out the synthetic 'direct' pseudo-server — it's never shown as a
    // labelled button; the HLS player just uses it silently.
    // Also filter the plain 'embedded' string to avoid duplicating the Zen button.
    const filteredAvailableServers = availableServers.filter(
      (server) => server !== 'embedded' && server !== 'direct',
    );

    const buttons = filteredAvailableServers.map((server) => {
      // Mark as embedded (EM badge) if the server key is in embeddedServerKeys
      const isServerEmbedded = embeddedServerKeys
        ? embeddedServerKeys.has(server)
        : server.includes('embed') || server.includes('iframe');

      // Strip internal __EM marker for display
      const displayName = server.replace(/__EM$/, '');

      return {
        key: server,
        label: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        isEmbedded: isServerEmbedded,
      };
    });

    // Append Zen Sub / Zen Dub when the embedded player is configured.
    // This makes it a last-resort option instead of the primary source.
    if (embeddedServerName) {
      buttons.push({
        key: 'embedded',
        label: embeddedServerName,
        isEmbedded: true,
      });
    }

    return buttons;
  };

  const serverButtons = buildServerButtons();
  const isLoadingServers =
    availableServers.length === 0 && !embeddedServerName && !sourceType;

  return (
    <UpdatedContainer>
      <EpisodeInfoColumn>
        {episodeId ? (
          <>
            You're watching <strong>Episode {episodeId}</strong>
            <DownloadLink
              href={downloadLink}
              target='_blank'
              rel='noopener noreferrer'
            >
              <FaDownload />
            </DownloadLink>
            <ShareButton onClick={handleShareClick}>
              <FaShare />
            </ShareButton>
            {isCopied && <p>Copied to clipboard!</p>}
            <br />
            <br />
            <p>If the current server doesn't work, please try another.</p>
          </>
        ) : (
          'Loading episode information...'
        )}
        {airingTime && (
          <p>
            Episode <strong>{nextEpisodenumber}</strong> will air in{' '}
            <FaBell />
            <strong> {airingTime}</strong>.
          </p>
        )}
      </EpisodeInfoColumn>

      <ServerContainer>
        <ServerTitle>
          <FaServer /> Server
        </ServerTitle>

        {isLoadingServers ? (
          <LoadingServers>Checking available servers…</LoadingServers>
        ) : (
          <ServerGrid>
            {serverButtons.map((server) => (
              <ServerButton
                key={`server-${server.key}`}
                className={sourceType === server.key ? 'active' : ''}
                onClick={() => {
                  console.log('Selected server:', server.key);
                  setSourceType(server.key);
                }}
              >
                <ServerLabel>
                  <span className="server-name">{server.label}</span>
                  {server.isEmbedded && <span className="em-badge">EM</span>}
                </ServerLabel>
              </ServerButton>
            ))}
          </ServerGrid>
        )}
      </ServerContainer>
    </UpdatedContainer>
  );
};