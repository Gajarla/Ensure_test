import * as Yup from 'yup';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { Form, FormikProvider, useFormik } from 'formik';
import eyeFill from '@iconify/icons-eva/eye-fill';
import eyeOffFill from '@iconify/icons-eva/eye-off-fill';
// material
import { TextField, Alert, Stack, InputAdornment, IconButton } from '@mui/material';
import { LoadingButton } from '@mui/lab';
// hooks
import { callBackendService } from '../../../redux/slices/common';
import API from '../../../services';
import { HTTP_REQUEST } from '../../../Constants';
import useAuth from '../../../hooks/useAuth';
import useIsMountedRef from '../../../hooks/useIsMountedRef';

// ----------------------------------------------------------------------

ResetPasswordForm.propTypes = {
  onSent: PropTypes.func,
  onGetEmail: PropTypes.func
};

export default function ResetPasswordForm({ onSent, onGetEmail }) {
  // const { resetPassword } = useAuth();
  const { resetToken, userId } = useParams();
  const [showPassword, setShowPassword] = useState(false);
  const isMountedRef = useIsMountedRef();
  const [disabled, setDisabled] = useState(true);
  const { logout } = useAuth();

  const ResetPasswordSchema = Yup.object().shape({
    newPassword: Yup.string().required('Enter New Password'),
    passwordConfirmation: Yup.string().oneOf(
      [Yup.ref('newPassword'), null],
      `Confrmation password doesn't match with new password`
    )
  });

  const resetPassword = async () => {
    const { newPassword } = formik.values;
    const data = { Token: resetToken, password: newPassword, userId };
    try {
      const response = await callBackendService(HTTP_REQUEST.POST, `${API.auth.resetPassword}?bypass=true`, data);
      if (parseInt(response.status, 10) === 200) onSent(true);
      else onSent(false);
    } catch (err) {
      console.log('err', err);
    }
  };

  const formik = useFormik({
    initialValues: {
      email: ''
    },
    validationSchema: ResetPasswordSchema,
    onSubmit: async (values, { setErrors, setSubmitting }) => {
      try {
        resetPassword();
        if (isMountedRef.current) {
          onSent();
          onGetEmail(formik.values.email);
          setSubmitting(false);
        }
      } catch (error) {
        if (isMountedRef.current) {
          setErrors({ afterSubmit: error.message });
          setSubmitting(false);
        }
      }
    }
  });

  const { errors, touched, isSubmitting, values, setFieldValue, handleSubmit, getFieldProps } = formik;

  const handleShowPassword = () => {
    setShowPassword((show) => !show);
  };

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    }
  }, [logout]);

  const handlePasswordChnage = (event) => {
    const { value } = event.target;
    const { passwordConfirmation } = values;
    setFieldValue('newPassword', value);
    if (passwordConfirmation === value) setDisabled(false);
    else setDisabled(true);
  };

  const handlePasswordConfirmationChnage = (event) => {
    const { value } = event.target;
    const { newPassword } = values;
    setFieldValue('passwordConfirmation', value);
    if (newPassword === value) setDisabled(false);
    else setDisabled(true);
  };

  useEffect(() => {
    handleLogout();
  }, [handleLogout]);

  return (
    <FormikProvider value={formik}>
      <Form autoComplete="off" noValidate onSubmit={handleSubmit}>
        <Stack spacing={3}>
          {errors.afterSubmit && <Alert severity="error">{errors.afterSubmit}</Alert>}

          <TextField
            fullWidth
            {...getFieldProps('newPassword')}
            type={showPassword ? 'text' : 'password'}
            label="New Password"
            onChange={handlePasswordChnage}
            value={values?.newPassword || ''}
            error={Boolean(touched.newPassword && errors.newPassword)}
            helperText={touched.newPassword && errors.newPassword}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleShowPassword} edge="end">
                    <Icon icon={showPassword ? eyeFill : eyeOffFill} />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          <TextField
            fullWidth
            {...getFieldProps('passwordConfirmation')}
            type="password"
            label="Confirm Password"
            value={values?.passwordConfirmation || ''}
            onChange={handlePasswordConfirmationChnage}
            error={Boolean(touched.passwordConfirmation && errors.passwordConfirmation)}
            helperText={touched.passwordConfirmation && errors.passwordConfirmation}
          />

          <LoadingButton
            fullWidth
            size="large"
            type="submit"
            variant="contained"
            loading={isSubmitting}
            disabled={disabled}
          >
            Reset Password
          </LoadingButton>
        </Stack>
      </Form>
    </FormikProvider>
  );
}
