import * as Yup from 'yup';
import { useState, useRef, React } from 'react';
import { useSnackbar } from 'notistack';
import { Link as RouterLink } from 'react-router-dom';
import { useFormik, Form, FormikProvider } from 'formik';
import { Icon } from '@iconify/react';
import eyeFill from '@iconify/icons-eva/eye-fill';
import closeFill from '@iconify/icons-eva/close-fill';
import eyeOffFill from '@iconify/icons-eva/eye-off-fill';
// material
import { Link, Stack, Alert, Checkbox, TextField, IconButton, InputAdornment, FormControlLabel } from '@mui/material';
// import axios from 'axios';

import { LoadingButton } from '@mui/lab';
// import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';

import axios from '../../../utils/axiosInstance';
// routes
import { PATH_AUTH } from '../../../routes/paths';
// hooks
import useAuth from '../../../hooks/useAuth';
import useIsMountedRef from '../../../hooks/useIsMountedRef';
//
import { MIconButton } from '../../@material-extend';
import { useDispatch, useSelector } from '../../../redux/store';
import { setUserIsSSO, setUserEmail, setUserRequestPassword } from '../../../redux/slices/user';
import url from '../../../URL';
import RenderComponent from '../../../RenderComponent';
import { setLicenseStatus } from 'src/redux/slices/license';

// ----------------------------------------------------------------------

export default function LoginForm() {
  const { login } = useAuth();
  const isMountedRef = useIsMountedRef();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const { isSSO, requestPassword } = useSelector((state) => state.user);
  let licenseResponseRef = useRef(null);

  const LoginSchema = Yup.object().shape({
    user_email: Yup.string().email('Email must be a valid email address').required('Email is required'),
    password: Yup.string().when([], {
      is: () => requestPassword,
      then: () => Yup.string().required('Password is required'),
      otherwise: () => Yup.string()
    })
  });

  const verifySSO = async (email) => {
    try {
      const response = await axios.post(`${url.host}/api/auth/verify?bypass=true`, {
        email
      });
      const { data } = response.data;

      if (data?.isSSO) {
        setUserIsSSO(dispatch, true);
        setUserRequestPassword(dispatch, false);
        const div = document.createElement('div');
        div.id = 'my-portal';
        document.body.appendChild(div);

        // ReactDOM.render(<RenderComponent />, document.getElementById('my-portal'));
        const container = document.getElementById('my-portal');
        const root = createRoot(container);
        root.render(<RenderComponent />);
      }
      if (!data?.isSSO) {
        setUserIsSSO(dispatch, false);
        setUserRequestPassword(dispatch, true);
      }
    } catch (err) {
      enqueueSnackbar('Invalid User', {
        variant: 'error',
        action: (key) => (
          <MIconButton size="small" onClick={() => closeSnackbar(key)}>
            <Icon icon={closeFill} />
          </MIconButton>
        )
      });
    }
  };

  const formik = useFormik({
    initialValues: {
      user_email: '',
      password: '',
      remember: true
    },
    validationSchema: LoginSchema,
    onSubmit: async (values, { setErrors, setSubmitting, resetForm }) => {
      try {
        const licenseResponse = await licenseValidityCheck();
        // Checking with Object.keys(obj).length === 0 condition
        // as the code shall execute even when licensing is not applicable
        // if (
        //   Object.keys(licenseResponse).length === 0
        // ||
        // (licenseResponse?.data?.status == 200 && !licenseResponse?.data?.licenseExpired)
        // ) {
        if (licenseResponse?.data?.status === 403) {
          dispatch(
            setLicenseStatus({
              licenseExpired: true
            })
          );
        } else {
          dispatch(
            setLicenseStatus({
              licenseExpired: false
            })
          );
        }
        if (!requestPassword) {
          await verifySSO(values.user_email);
          if (isSSO)
            enqueueSnackbar('LoggingIn ...', {
              variant: 'success',
              action: (key) => (
                <MIconButton size="small" onClick={() => closeSnackbar(key)}>
                  <Icon icon={closeFill} />
                </MIconButton>
              )
            });
        } else if (requestPassword) {
          await login(values.user_email, values.password);
          enqueueSnackbar('Login success', {
            variant: 'success',
            action: (key) => (
              <MIconButton size="small" onClick={() => closeSnackbar(key)}>
                <Icon icon={closeFill} />
              </MIconButton>
            )
          });
        }

        if (isMountedRef.current) {
          setSubmitting(false);
        }
        // }
      } catch (error) {
        console.error('err', error.message);
        resetForm();
        if (isMountedRef.current) {
          setSubmitting(false);
          setErrors({ afterSubmit: error.response.data.message });
        }
      }
    }
  });

  const { errors, touched, values, isSubmitting, handleSubmit, setFieldValue, getFieldProps } = formik;

  const handleEmailChange = (event) => {
    const { value } = event.target;
    if (!requestPassword) {
      setUserIsSSO(dispatch, false);
      setFieldValue('user_email', value);
      setUserEmail(dispatch, value);
      setUserRequestPassword(dispatch, false);
    }
  };

  const handleEmailClick = (event) => {
    const { value } = event.target;
    setUserIsSSO(dispatch, false);
    setFieldValue('user_email', value);
    setUserEmail(dispatch, value);
    setUserRequestPassword(dispatch, false);
  };

  const handleShowPassword = () => {
    setShowPassword((show) => !show);
  };

  // The below function checks for license validity
  // and shows snackbar messages accordingly on the login form itself

  const licenseValidityCheck = async () => {
    // If cached and not 401 → return cached result
    if (
      licenseResponseRef.current &&
      licenseResponseRef.current?.data?.status !== 401 &&
      licenseResponseRef.current?.data?.status !== 403
    ) {
      return licenseResponseRef.current;
    }
    try {
      if (process.env.REACT_APP_SLICENSE_APPLICABLE === 'true') {
        const response = await axios.post(`${url.host}/api/auth/validateSLicense?bypass=true`, {});

        // If license expired → don't cache
        // The below are used to show snackbar messages on login form
        // if (response?.data?.status === 401) {
        //   enqueueSnackbar(
        //     `License Expired on ${response.data.expiryDate}. Please contact TestEnsure Support Team for renewal of license.`,
        //     {
        //       variant: 'error',
        //       action: (key) => (
        //         <MIconButton size="small" onClick={() => closeSnackbar(key)}>
        //           <Icon icon={closeFill} />
        //         </MIconButton>
        //       )
        //     }
        //   );
        //   return response; // ⚠ return but don't cache
        // }
        // if (response?.data?.status === 403) {
        //   let message;
        //   if (response.data.errorMessage.toLowerCase().includes('expired')) message = response.data.errorMessage;
        //   else {
        //     // multi-line message
        //     const rawMessage = `Action Required: ${response.data.errorMessage}\nNote: This is managed by S-Licensing and not the current application.`;

        //     // Convert \n to JSX and wrap in a single container <div>
        //     message = (
        //       <div>
        //         {rawMessage.split('\n').map((line, index) => (
        //           <span key={index}>
        //             {line}
        //             <br />
        //           </span>
        //         ))}
        //       </div>
        //     );
        //   }
        //   enqueueSnackbar(message, {
        //     variant: 'error',
        //     action: (key) => (
        //       <MIconButton size="small" onClick={() => closeSnackbar(key)}>
        //         <Icon icon={closeFill} />
        //       </MIconButton>
        //     )
        //   });
        //   return response; // ⚠ return but don't cache
        // }
        // Otherwise cache valid response
        licenseResponseRef.current = response;
        return response;
      } else {
        licenseResponseRef.current = {}; // cache empty if not applicable
        return licenseResponseRef.current;
      }
    } catch (error) {
      console.error('License check error:', error.message);
      throw error;
    }
  };

  return (
    <FormikProvider value={formik}>
      <Form autoComplete="off" noValidate onSubmit={handleSubmit}>
        <Stack spacing={3}>
          {errors.afterSubmit && <Alert severity="error">{errors.afterSubmit}</Alert>}

          <TextField
            fullWidth
            autoComplete="username"
            type="email"
            label="Email address"
            {...getFieldProps('user_email')}
            // onClick={handleEmailClick}
            onClick={handleEmailClick}
            onChange={handleEmailChange}
            error={Boolean(touched.user_email && errors.user_email)}
            helperText={touched.user_email && errors.user_email}
          />

          {requestPassword && (
            <TextField
              fullWidth
              autoComplete="current-password"
              type={showPassword ? 'text' : 'password'}
              label="Password"
              {...getFieldProps('password')}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleShowPassword} edge="end">
                      <Icon icon={showPassword ? eyeFill : eyeOffFill} />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              error={Boolean(touched.password && errors.password)}
              helperText={touched.password && errors.password}
            />
          )}
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ my: 2 }}>
          <FormControlLabel
            control={<Checkbox {...getFieldProps('remember')} checked={values.remember} />}
            label="Remember me"
          />

          <Link component={RouterLink} variant="subtitle2" to={PATH_AUTH.forgotPassword}>
            Forgot password?
          </Link>
        </Stack>

        <LoadingButton fullWidth size="large" type="submit" variant="contained" loading={isSubmitting}>
          {isSSO ? 'Login' : 'Next'}
        </LoadingButton>
      </Form>
    </FormikProvider>
  );
}
