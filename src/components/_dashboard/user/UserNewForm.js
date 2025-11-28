import * as Yup from 'yup';
import PropTypes from 'prop-types';
import { useEffect, useCallback, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { Form, FormikProvider, useFormik } from 'formik';
// material
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography,
  FormHelperText,
  FormControlLabel
} from '@mui/material';
// utils
import { getCreateUser, getEditUser } from '../../../redux/slices/user';
import { fData } from '../../../utils/formatNumber';
import { useDispatch, useSelector } from '../../../redux/store';
// routes
import { PATH_DASHBOARD } from '../../../routes/paths';
//
import Label from '../../Label';
import { UploadAvatar } from '../../upload';

// ----------------------------------------------------------------------

UserNewForm.propTypes = {
  isEdit: PropTypes.bool,
  currentUser: PropTypes.object
};

export default function UserNewForm({ isEdit, currentUser }) {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useDispatch();
  const { userList, companiesList, appendUrl } = useSelector((state) => state.user);
  const { filteredRoleList } = useSelector((state) => state.role);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const navigateToLink = (url) => {
    navigate(getUrl(url));
  };

  const handleClose = () => {
    setOpen(false);
  };

  const NewUserSchema = Yup.object().shape({
    name: Yup.string().required('Name is required'),
    email: Yup.string().required('Email is required').email(),
    company: Yup.string().required('Company is required'),
    role: Yup.string().required('Role is required')
  });

  const checkSchemaValue = (key) => !!values?.[key];

  const createUser = async () => {
    const user = userList?.find((user) => user.email === values.email);
    if (user && !isEdit) {
      setMessage(`User with [${values.email}] already exists!!`);
      setOpen(true);
    } else {
      const { avatarUrl, company, email, name, role, status } = values;

      const index = name.lastIndexOf(' ');

      const formData = {
        firstName: index === -1 ? name : name.substring(0, index),
        lastName: index !== -1 ? name.substring(index + 1, name.length) : null,
        avatarUrl,
        company,
        email,
        role,
        status
      };
      if (!isEdit) await getCreateUser(dispatch, formData);
      else await getEditUser(dispatch, formData, user?._id);
    }
  };

  useEffect(() => {}, []);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: currentUser ? `${currentUser?.firstName} ${currentUser?.lastName}` : '',
      email: currentUser?.email || '',
      avatarUrl: currentUser?.avatarUrl || null,
      status: currentUser?.status || 'active',
      company: currentUser?.company?._id || '',
      role: currentUser?.role?._id || ''
    },
    validationSchema: NewUserSchema,
    onSubmit: async (values, { setSubmitting, resetForm, setErrors }) => {
      try {
        await createUser();
        setSubmitting(false);
        const user = userList?.find((user) => user.email.toLowerCase() === values.email.toLowerCase());
        if (!user || isEdit) {
          resetForm();
          enqueueSnackbar(!isEdit ? 'Create success' : 'Update success', { variant: 'success' });
          navigateToLink(PATH_DASHBOARD.user.allUsers);
        }
      } catch (error) {
        setSubmitting(false);
        setErrors(error);
      }
    }
  });

  const { errors, values, touched, handleSubmit, isSubmitting, setFieldValue, getFieldProps } = formik;

  const handleDrop = useCallback(
    (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        setFieldValue('avatarUrl', {
          ...file,
          preview: URL.createObjectURL(file)
        });
      }
    },
    [setFieldValue]
  );

  const filteredRolesList = filteredRoleList?.filter((role) => role.status === 1);

  return (
    <FormikProvider value={formik}>
      <Form noValidate autoComplete="off" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ py: 10, px: 3 }}>
              {isEdit && (
                <Label
                  color={values.status !== 'active' ? 'error' : 'success'}
                  sx={{ textTransform: 'uppercase', position: 'absolute', top: 24, right: 24 }}
                >
                  {values.status}
                </Label>
              )}

              <Box sx={{ mb: 5 }}>
                <UploadAvatar
                  accept="image/*"
                  file={values.avatarUrl}
                  maxSize={3145728}
                  onDrop={handleDrop}
                  error={Boolean(touched.avatarUrl && errors.avatarUrl)}
                  caption={
                    <Typography
                      variant="caption"
                      sx={{
                        mt: 2,
                        mx: 'auto',
                        display: 'block',
                        textAlign: 'center',
                        color: 'text.secondary'
                      }}
                    >
                      Allowed *.jpeg, *.jpg, *.png, *.gif
                      <br /> max size of {fData(3145728)}
                    </Typography>
                  }
                />
                <FormHelperText error sx={{ px: 2, textAlign: 'center' }}>
                  {touched.avatarUrl && errors.avatarUrl}
                </FormHelperText>
              </Box>

              {isEdit && (
                <FormControlLabel
                  labelPlacement="start"
                  control={
                    <Switch
                      onChange={(event) => setFieldValue('status', event.target.checked ? 'banned' : 'active')}
                      checked={values.status !== 'active'}
                    />
                  }
                  label={
                    <>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        Banned
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Apply disable account
                      </Typography>
                    </>
                  }
                  sx={{ mx: 0, mb: 3, width: 1, justifyContent: 'space-between' }}
                />
              )}
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card sx={{ p: 3 }}>
              <Stack spacing={3}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    {...getFieldProps('name')}
                    error={Boolean(touched.name && errors.name)}
                    helperText={touched.name && errors.name}
                  />
                  <TextField
                    fullWidth
                    label="Email Address"
                    {...getFieldProps('email')}
                    disabled={isEdit}
                    error={Boolean(touched.email && errors.email)}
                    helperText={touched.email && errors.email}
                  />
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                  <TextField
                    select
                    fullWidth
                    label="Company"
                    value={currentUser?.company?._id || ''}
                    {...getFieldProps('company')}
                    SelectProps={{ native: true }}
                    InputLabelProps={{ shrink: checkSchemaValue('company') }}
                    error={Boolean(touched.company && errors.company)}
                    helperText={touched.company && errors.company}
                  >
                    <option value="" />
                    {companiesList &&
                      companiesList.map((company) => (
                        <option value={company._id} key={company._id}>
                          {company.company}
                        </option>
                      ))}
                  </TextField>
                  <TextField
                    select
                    fullWidth
                    label="Role"
                    value={currentUser?.role?._id || ''}
                    {...getFieldProps('role')}
                    SelectProps={{ native: true }}
                    InputLabelProps={{ shrink: checkSchemaValue('role') }}
                    error={Boolean(touched.role && errors.role)}
                    helperText={touched.role && errors.role}
                  >
                    <option value="" />
                    {filteredRolesList &&
                      filteredRolesList?.map((role) => (
                        <option key={role._id} value={role._id}>
                          {role.roleName}
                        </option>
                      ))}
                  </TextField>
                </Stack>

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                    {!isEdit ? 'Create User' : 'Save Changes'}
                  </LoadingButton>
                </Box>
              </Stack>
              <Dialog
                open={open}
                onClose={handleClose}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
              >
                <DialogTitle id="alert-dialog-title">User Info</DialogTitle>
                <DialogContent>
                  <DialogContentText id="alert-dialog-description">
                    <br />
                    <br />
                    {message}
                    <br />
                    <br />
                    Please change
                  </DialogContentText>
                </DialogContent>
                <DialogActions>
                  <Button autoFocus onClick={handleClose}>
                    OK
                  </Button>
                </DialogActions>
              </Dialog>
            </Card>
          </Grid>
        </Grid>
      </Form>
    </FormikProvider>
  );
}
