import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { useEffect } from 'react';
import {
  Profile,
  Navbar,
  ThemeProvider,
  Footer,
  Home,
  Watch,
  Search,
  Page404,
  About,
  PolicyTerms,
  Read,
  ShortcutsPopup,
  ScrollToTop,
  usePreserveScrollOnReload,
  Callback,
  ApolloClientProvider,
  SettingsProvider,
  Info,
  Studio,
  History,
  useSettings,
} from './index';
import { MangaSyncActivator } from './components/MangaSyncActivator';
import { register } from 'swiper/element/bundle';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from './client/useAuth';
import ReactGA from 'react-ga4';

register();

// Wrapper component to show Watch or Info page based on settings
function WatchInfoPage() {
  const { settings } = useSettings();
  
  if (settings.watchOrInfo === 'Info') {
    return <Info />;
  }
  return <Watch />;
}

function App() {
  usePreserveScrollOnReload();
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  const deployPlatform = import.meta.env.VITE_DEPLOY_PLATFORM;

  useEffect(() => {
    if (measurementId) {
      ReactGA.initialize(measurementId);
    }
  }, [measurementId]);

  return (
    <ApolloClientProvider>
      <Router>
        <AuthProvider>
          <ThemeProvider>
            <SettingsProvider>
              <MangaSyncActivator />
              <Navbar />
              <ShortcutsPopup />
              <ScrollToTop />
              <TrackPageViews />
              <div style={{ minHeight: '35rem' }}>
                <Routes>
                  <Route path='/' element={<Home />} />
                  <Route path='/home' element={<Home />} />
                  <Route path='/search' element={<Search />} />
                  <Route path='/watch/:animeId' element={<WatchInfoPage />} />
                  <Route
                    path='/watch/:animeId/:animeTitle/:episodeNumber'
                    element={<WatchInfoPage />}
                  />
                  <Route path='/info/:animeId' element={<Info />} />
                  <Route path='/read/:animeId' element={<Read />} />
                  <Route path='/studio/:studioId' element={<Studio />} />
                  <Route path='/history' element={<History />} />
                  <Route path='/profile' element={<Profile />} />
                  <Route path='/about' element={<About />} />
                  <Route path='/pptos' element={<PolicyTerms />} />
                  <Route path='/callback' element={<Callback />} />
                  <Route path='*' element={<Page404 />} />
                </Routes>
              </div>
              <Footer />
            </SettingsProvider>
          </ThemeProvider>
        </AuthProvider>
      </Router>
      {deployPlatform === 'VERCEL' && <Analytics />}
    </ApolloClientProvider>
  );
}

function TrackPageViews() {
  const { pathname } = useLocation();

  useEffect(() => {
    ReactGA.send({ hitType: 'pageview', page: pathname });
  }, [pathname]);

  return null;
}

export default App;
