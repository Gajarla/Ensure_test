import { useDescope } from '@descope/react-sdk';
import { useEffect, useState } from 'react';
// import axios from 'axios';
import PropTypes from 'prop-types';
import axios from './utils/axiosInstance';
import { useDispatch } from './redux/store';
import API from './services';
// import { clearData } from './redux/slices/common';
import { setUserIsSSO, setUserRequestPassword, setCurrentUser } from './redux/slices/user';
import { setSessionObj } from './utils/jwt';
import url from './URL';

const Render = ({ setMsg }) => {
  const sdk = useDescope();
  const dispatch = useDispatch();
  const [fetch, setFetch] = useState(0);
  const searchParams = new URLSearchParams(window.location.search);
  const tenantNameIdOrEmail = searchParams.get('email') || 'ikapturessou1@sailotech.com';
  const redirectURL = `${window.location.href}dashboard/details/home?user=${window.btoa(tenantNameIdOrEmail)}`;
  const loginOptions = {
    stepup: false,
    mfa: false,
    customClaims: {},
    templateOptions: {}
  };
  const code = searchParams.get('code');

  // eslint-disable-next-line
  useEffect(() => {
    console.log(redirectURL);
    if (code) {
      if (fetch === 0) {
        setFetch(fetch + 1);
        try {
          sdk.saml
            .exchange(code)
            .then((resp) => {
              if (resp.ok) {
                setMsg(resp.data);
                window.localStorage.setItem('refreshToken', resp.data.refreshJwt);
                window.localStorage.setItem('ssosessionToken', resp.data.sessionJwt);
                axios
                  .post(`${API.sso.validation}?bypass=true`, {
                    refreshToken: resp.data.refreshJwt,
                    ssosessionToken: resp.data.sessionJwt,
                    userId: resp.data.user.userId,
                    userName: resp.data.user.name
                  })
                  .then(async (r) => {
                    if (r.status === 200) {
                      setMsg({
                        backend: r.data,
                        descope: resp.data
                        // userLoggedIn: true
                      });
                      const { loggedintime } = r.data;
                      // clearData(dispatch);
                      setUserIsSSO(dispatch, true);
                      setUserRequestPassword(dispatch, false);
                      setSessionObj('loggedintime', loggedintime);
                      const response = await axios.post(`${url.host}/api/auth/getUser?bypass=true`, {
                        userName: resp.data.user.name
                      });
                      const { user } = response.data;
                      console.log('user', user);
                      setUserIsSSO(dispatch, true);
                      setCurrentUser(dispatch, user);
                      // setSession(token);
                      // setCurrentUser(dispatch, user);
                      // redirectURL = `${window.location.href}?user=${resp.data.user.name}`;
                    }
                  })
                  .catch((err) => {
                    console.log(err);
                  });
              }
            })
            .catch((err) => {
              console.error(err);
            });
        } catch (err) {
          console.log('err', err);
        }
      }
    } else {
      console.log('redirectURL', redirectURL);
      try {
        sdk.saml
          .start(tenantNameIdOrEmail, redirectURL, loginOptions)
          .then((resp) => {
            if (resp.ok) {
              const { url } = resp.data;
              console.log(`Successfully started sso auth. URL: ${url}`);
              window.location.href = url;
            }
            throw new Error(resp);
          })
          .catch((err) => {
            console.error(err);
          });
      } catch (err) {
        console.log('err', err);
      }
    }
  });

  return <></>;
};

Render.propTypes = {
  setMsg: PropTypes.func
};

export default Render;
