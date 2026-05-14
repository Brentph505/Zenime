// apolloClient.ts
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  ApolloProvider,
  makeVar,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import axios from 'axios';
import { buildAuthUrl, fetchUserData, UserData } from '../index';
import { ReactNode, useEffect } from 'react';

// Reactive variables for user authentication state
const isLoggedInVar = makeVar<boolean>(false);
const userDataVar = makeVar<UserData | null>(null);

const httpLink = createHttpLink({
  uri: 'https://graphql.anilist.co', // Update to your GraphQL server URL
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) =>
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
      ),
    );
  }

  if (networkError) console.error(`[Network error]: ${networkError}`);
});

const client = new ApolloClient({
  link: errorLink.concat(authLink.concat(httpLink)),
  cache: new InMemoryCache(),
});

// Functions for handling authentication
function login() {
  const PLATFORM = import.meta.env.VITE_DEPLOY_PLATFORM;
  const csrfEndpoint = PLATFORM === 'VERCEL' ? '/api/get-csrf-token' : '/.netlify/functions/get-csrf-token';
  axios
    .get(csrfEndpoint)
    .then((response) => {
      const csrfToken = response.data.csrfToken;
      const authUrl = buildAuthUrl(csrfToken);
      window.location.href = authUrl;
    })
    .catch((error) => {
      console.error('Error fetching CSRF token or building auth URL:', error);
    });
}

function clearAuthState() {
  isLoggedInVar(false);
  userDataVar(null);
}

function logout() {
  localStorage.removeItem('accessToken');
  clearAuthState();
  window.dispatchEvent(new CustomEvent('authUpdate'));
  window.location.href = '/profile'; // Adjust as necessary
}

function handleAuthUpdate() {
  const token = localStorage.getItem('accessToken');
  if (token) {
    fetchUserData(token)
      .then((data) => {
        userDataVar(data);
        isLoggedInVar(true);
      })
      .catch((err) => {
        console.error('Failed to fetch user data:', err);
        localStorage.removeItem('accessToken');
        clearAuthState();
      });
  } else {
    clearAuthState();
  }
}

export const ApolloClientProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    window.addEventListener('authUpdate', handleAuthUpdate);
    handleAuthUpdate();
    return () => {
      window.removeEventListener('authUpdate', handleAuthUpdate);
    };
  }, []);

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
};

export {
  client as defaultApolloClient,
  login,
  logout,
  isLoggedInVar,
  userDataVar,
};
