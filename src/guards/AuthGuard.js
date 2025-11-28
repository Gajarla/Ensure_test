import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
// hooks
// import useAuth from '../hooks/useAuth';
// pages
import Login from '../pages/authentication/Login';
import { getSessionObj } from '../utils/jwt';

// ----------------------------------------------------------------------

AuthGuard.propTypes = {
  children: PropTypes.node
};

export default function AuthGuard({ children }) {
  // const { isAuthenticated } = useAuth();
  const isAuthenticated = window.localStorage.getItem('loggedintime');
  const { pathname } = useLocation();
  const [requestedLocation, setRequestedLocation] = useState(null);
  const searchParams = new URLSearchParams(window.location.search);
  const paramUser = searchParams.get('user');

  if (!isAuthenticated && !paramUser && !getSessionObj('loggedintime')) {
    if (pathname !== requestedLocation) {
      setRequestedLocation(pathname);
    }
    return <Login />;
  }

  if (requestedLocation && pathname !== requestedLocation) {
    setRequestedLocation(null);
    return <Navigate to={requestedLocation} />;
  }

  return <>{children}</>;
}
