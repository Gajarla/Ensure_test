import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useEffect } from 'react';
import PropTypes from 'prop-types';
// routes
import Router from './routes';
// theme
import ThemeConfig from './theme';
// hooks

// components
import RtlLayout from './components/RtlLayout';
import ScrollToTop from './components/ScrollToTop';
import LoadingScreen from './components/LoadingScreen';
import NotistackProvider from './components/NotistackProvider';
import ThemePrimaryColor from './components/ThemePrimaryColor';
import ThemeLocalization from './components/ThemeLocalization';
import ErrorBoundary from './components/ErrorBoundary';

// ----------------------------------------------------------------------

App.propTypes = {
  isInitialized: PropTypes.bool
};

export default function App({ isInitialized }) {
  // const { isInitialized } = useAuth();

  // window.onerror = function (message, source, lineno, colno, error) {
  //   console.error('Global error caught:', { message, source, lineno, colno, error });
  // };

  useEffect(() => {
    // window.onbeforeunload = signout();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeConfig>
        <ThemePrimaryColor>
          <ThemeLocalization>
            <RtlLayout>
              <NotistackProvider>
                {/* <Settings /> */}
                <ToastContainer />
                <ScrollToTop />
                {isInitialized ? <Router /> : <LoadingScreen />}
              </NotistackProvider>
            </RtlLayout>
          </ThemeLocalization>
        </ThemePrimaryColor>
      </ThemeConfig>
    </ErrorBoundary>
  );
}
