import * as Yup from 'yup';
import PropTypes from 'prop-types';
import { Form, FormikProvider, useFormik } from 'formik';
import { useEffect, useState } from 'react';
// material
import { TextField, Alert, Stack } from '@mui/material';
import { LoadingButton } from '@mui/lab';
// hooks
// import useAuth from '../../../hooks/useAuth';
import { callBackendService } from '../../../redux/slices/common';
import API from '../../../services';
import { HTTP_REQUEST } from '../../../Constants';
import useIsMountedRef from '../../../hooks/useIsMountedRef';
import { useDispatch, useSelector } from '../../../redux/store';
import { getUsers } from '../../../redux/slices/user';

// ----------------------------------------------------------------------

ForgotPasswordForm.propTypes = {
  onSent: PropTypes.func,
  onGetEmail: PropTypes.func
};

export default function ForgotPasswordForm({ onSent, onGetEmail }) {
  // const { resetPassword } = useAuth();
  const isMountedRef = useIsMountedRef();
  const dispatch = useDispatch();
  const { userList } = useSelector((state) => state.user);
  const [isLoading, setIsloading] = useState(false);
  const [disabled, setDisabled] = useState(true);

  const ResetPasswordSchema = Yup.object().shape({
    email: Yup.string().email('Email must be a valid email address').required('Email is required')
  });

  useEffect(() => {
    setIsloading(true);
    dispatch(getUsers());
    setIsloading(false);
  }, [dispatch]);

  const forgotPassword = async () => {
    const { email } = formik.values;
    const data = { Email: email };
    try {
      const response = await callBackendService(HTTP_REQUEST.POST, `${API.auth.forgotPassword}?bypass=true`, data);
      if (parseInt(response.status, 10) === 200) onSent(true);
      else onSent(false);
    } catch (err) {
      console.log('err', err);
    }
  };

  const handleEmailChange = (event) => {
    const { value } = event.target;
    setFieldValue('email', value);
    const userEmail = userList?.find((user) => user?.email === value);
    if (userEmail) setDisabled(false);
    else setDisabled(true);
  };

  const formik = useFormik({
    initialValues: {
      email: ''
    },
    validationSchema: ResetPasswordSchema,
    onSubmit: async (values, { setErrors, setSubmitting }) => {
      try {
        // await resetPassword(values.email);

        forgotPassword();
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

  const { errors, touched, isSubmitting, setFieldValue, handleSubmit, getFieldProps } = formik;

  return (
    <FormikProvider value={formik}>
      <Form autoComplete="off" noValidate onSubmit={handleSubmit}>
        <Stack spacing={3}>
          {errors.afterSubmit && <Alert severity="error">{errors.afterSubmit}</Alert>}

          <TextField
            fullWidth
            {...getFieldProps('email')}
            type="email"
            label="Email address"
            onChange={handleEmailChange}
            error={Boolean(touched.email && errors.email)}
            helperText={touched.email && errors.email}
          />

          <LoadingButton
            fullWidth
            size="large"
            type="submit"
            variant="contained"
            disabled={disabled}
            loading={isSubmitting}
          >
            Reset Password
          </LoadingButton>
        </Stack>
      </Form>
    </FormikProvider>
  );
}
