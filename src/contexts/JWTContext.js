import { createContext, useEffect, useReducer, useCallback } from 'react';

// eslint-disable-next-line import/order
import PropTypes from 'prop-types';
// utils
import axios from 'axios';
// import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import url from '../URL';
import { isValidToken, setSession, setSessionObj, getSessionObj } from '../utils/jwt';
import { setCurrentUser, setUserEmail, setUserIsSSO, setUserGetTokens } from '../redux/slices/user';
import { setFetchRoledata } from '../redux/slices/role';
import { getIDBCurrentProject, setIDBCurrentUser } from '../main';
import { setCurrentProject } from '../redux/slices/project';
import { useDispatch, useSelector } from '../redux/store';
import { clearData, clearSSOData } from '../redux/slices/common';
import { PERSIST_STORE } from '../Constants';
import RenderComponent from '../RenderComponent';

// ----------------------------------------------------------------------

const initialState = {
  isAuthenticated: false,
  isInitialized: false,
  user: null
};

const handlers = {
  INITIALIZE: (state, action) => {
    const { isAuthenticated, user } = action.payload;
    return {
      ...state,
      isAuthenticated,
      isInitialized: true,
      user
    };
  },
  LOGIN: (state, action) => {
    const { user } = action.payload;

    return {
      ...state,
      isAuthenticated: true,
      user
    };
  },
  LOGOUT: (state) => ({
    ...state,
    isAuthenticated: false,
    user: null
  }),
  REGISTER: (state, action) => {
    const { user } = action.payload;

    return {
      ...state,
      isAuthenticated: true,
      user
    };
  }
};

const reducer = (state, action) => (handlers[action.type] ? handlers[action.type](state, action) : state);

const AuthContext = createContext({
  ...initialState,
  method: 'jwt',
  ssoLogin: () => Promise.resolve(),
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  register: () => Promise.resolve()
});

AuthProvider.propTypes = {
  children: PropTypes.node
};

function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const userDispatch = useDispatch();
  const { requestPassword, email, isSSO, appendUrl, getTokens } = useSelector((state) => state.user);

  const logout = useCallback(async () => {
    signout();
    clearSSOData(userDispatch);
    if (!isSSO) clearData(userDispatch);
    dispatch({ type: 'LOGOUT' });
  }, [userDispatch, isSSO]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const accessToken = window.localStorage.getItem('accessToken');
        const user = JSON.parse(getSessionObj(PERSIST_STORE.USER));

        if (user?.isSSO && !appendUrl) logout();

        const currentProject = JSON.parse(getSessionObj(PERSIST_STORE.PROJECT));
        if (currentProject) setCurrentProject(userDispatch, currentProject);
        else {
          setCurrentProject(userDispatch, null);
          setFetchRoledata(dispatch, true);
        }
        if (user) {
          setCurrentUser(userDispatch, user);
          setSessionObj(PERSIST_STORE.USER, JSON.stringify(user));
          setIDBCurrentUser(user);
          setFetchRoledata(dispatch, false);
        }
        if (user && accessToken && isValidToken(accessToken)) {
          setSession(accessToken);
          setCurrentUser(userDispatch, user);
          setIDBCurrentUser(user);
          setSessionObj(PERSIST_STORE.USER, JSON.stringify(user));
          setCurrentProject(userDispatch, currentProject);
          dispatch({
            type: 'INITIALIZE',
            payload: {
              isAuthenticated: true,
              user
            }
          });
        } else if (!appendUrl) {
          dispatch({
            type: 'INITIALIZE',
            payload: {
              isAuthenticated: false,
              user: null
            }
          });
        }
      } catch (err) {
        console.log('err', err);
        dispatch({
          type: 'INITIALIZE',
          payload: {
            isAuthenticated: false,
            user: null
          }
        });
      }
    };

    initialize();
  }, [userDispatch, requestPassword, email, appendUrl, logout]);

  const ssoLogin = async (email) => {
    // clearSSOData(userDispatch);

    if (!appendUrl) {
      const response = await axios.post(`${url.host}/api/auth/getUser?bypass=true`, {
        userName: email
      });
      const { token, user, loggedintime } = response.data;
      setSessionObj('loggedintime', loggedintime);
      setSession(token);
      setUserIsSSO(userDispatch, true);
      setUserEmail(userDispatch, email);
      setCurrentUser(userDispatch, user);
      setIDBCurrentUser(user);
      setSessionObj(PERSIST_STORE.USER, JSON.stringify(user));
      const currentProject =
        (await getIDBCurrentProject()) || JSON.parse(window.localStorage.getItem(PERSIST_STORE.PROJECT));

      if (currentProject) setCurrentProject(userDispatch, currentProject);
      else {
        setCurrentProject(userDispatch, null);
        setFetchRoledata(dispatch, true);
      }
      dispatch({
        type: 'LOGIN',
        payload: {
          user
        }
      });
    } else if (getTokens) {
      setUserGetTokens(userDispatch, false);
      const div = document.createElement('div');
      div.id = 'my-portal';
      document.body.appendChild(div);

      // ReactDOM.render(<RenderComponent />, document.getElementById('my-portal'));
      const container = document.getElementById('my-portal');
      const root = createRoot(container);
      root.render(<RenderComponent />);
    }
  };

  const login = async (email, password) => {
    clearData(userDispatch);
    const response = await axios.post(`${url.host}/api/auth/signin?bypass=true`, {
      email,
      password
    });
    const { token, user, loggedintime } = response.data;
    setSessionObj('loggedintime', loggedintime);
    setSession(token);
    setCurrentUser(userDispatch, user);
    setSessionObj(PERSIST_STORE.USER, JSON.stringify(user));
    dispatch({
      type: 'LOGIN',
      payload: {
        user
      }
    });
  };

  const register = async (email, password, firstName, lastName) => {
    const response = await axios.post('/api/account/register', {
      email,
      password,
      firstName,
      lastName
    });
    const { accessToken, user } = response.data;

    setSessionObj('accessToken', accessToken);
    dispatch({
      type: 'REGISTER',
      payload: {
        user
      }
    });
  };

  const resetPassword = () => {};

  const updateProfile = () => {};

  return (
    <AuthContext.Provider
      value={{
        ...state,
        method: 'jwt',
        ssoLogin,
        login,
        logout,
        register,
        resetPassword,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const config = {
  headers: {
    Authorization: `Bearer ${window.localStorage.getItem('accessToken')}`
  }
};

const accessToken = `Bearer ${window.localStorage.getItem('accessToken')}`;

const signout = async () => {
  const currentUser = JSON.parse(getSessionObj(PERSIST_STORE.USER));

  setSession(null);
  setSessionObj('loggedintime');

  await axios.post(`${url.host}/api/auth/signout?bypass=true`, {
    UserId: currentUser?._id,
    jwt: getSessionObj('accessToken'),
    logintime: getSessionObj('loggedintime'),
    refreshToken: getSessionObj('refreshToken'),
    ssosessionToken: getSessionObj('ssosessionToken')
  });
  setSessionObj('refreshToken');
  setSessionObj('ssosessionToken');
};

export { AuthContext, AuthProvider, accessToken, config, signout };
