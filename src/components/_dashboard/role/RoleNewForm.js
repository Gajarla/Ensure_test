import * as Yup from 'yup';
import PropTypes from 'prop-types';
import { useEffect, useState, useCallback } from 'react';
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
  TextField
} from '@mui/material';
// utils
import { getCreateRole, getEditRole, setRolesList, setRoleConfig } from '../../../redux/slices/role';
import { getRolesList } from '../../../_apis_/role';
import { useDispatch, useSelector } from '../../../redux/store';
// routes
import { PATH_DASHBOARD } from '../../../routes/paths';

// ----------------------------------------------------------------------

const CONFIG = {
  projects: {
    view: true,
    create: false,
    edit: false,
    delete: false
  },
  projectModules: {
    view: true,
    create: false,
    edit: false,
    delete: false
  },
  releases: {
    view: true,
    create: false,
    edit: false,
    delete: false,
    clone: false,
    run: false
  },
  testRuns: {
    view: true,
    create: false,
    edit: false,
    delete: false
  }
};

// ----------------------------------------------------------------------

RoleNewForm.propTypes = {
  isEdit: PropTypes.bool,
  currentRole: PropTypes.object
};

export default function RoleNewForm({ isEdit, currentRole }) {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useDispatch();
  const { appendUrl } = useSelector((state) => state.user);
  const { rolesList, roleConfig } = useSelector((state) => state.role);
  const [message, setMessage] = useState('');
  const [roleId, setRoleId] = useState();
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

  const NewRoleSchema = Yup.object().shape({
    roleID: Yup.string().required('Role ID is required'),
    roleName: Yup.string().required('Role is required')
  });

  const createRole = async () => {
    const role = rolesList?.find(
      (role) =>
        role.roleID.toLowerCase() === values.roleID.toLowerCase() ||
        role.roleName.toLowerCase() === values.roleName.toLowerCase()
    );
    const data = { ...values, components: [roleConfig] };
    if (role && !isEdit) {
      setMessage(`Role with [${values.roleName}] already exists!!`);
      setOpen(true);
    } else if (!isEdit) await getCreateRole(dispatch, data);
    else if (isEdit) await getEditRole(dispatch, data, role?._id);
  };

  const getRoleId = useCallback(async () => {
    const count = 4;
    let length = rolesList?.length;

    if (rolesList?.length === 0) {
      const rList = await getRolesList();
      length = rList.length;
      setRolesList(dispatch, rList);
    }
    const rId = `R${parseInt(length + 1, 10)
      ?.toString()
      .padStart(count, 0)}`;
    setRoleId(() => rId);
  }, [dispatch, rolesList]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      roleID: currentRole?.roleID || roleId,
      roleName: currentRole?.roleName || ''
    },
    validationSchema: NewRoleSchema,
    onSubmit: async (values, { setSubmitting, resetForm, setErrors }) => {
      try {
        // await fakeRequest(500);
        await createRole();
        setSubmitting(false);
        const role = rolesList?.find((role) => role.roleName.toLowerCase() === values.roleName.toLowerCase());
        if (!role || isEdit) {
          resetForm();
          enqueueSnackbar(!isEdit ? 'Create success' : 'Update success', { variant: 'success' });
          navigateToLink(PATH_DASHBOARD.role.allRoles);
        }
      } catch (error) {
        setSubmitting(false);
        setErrors(error);
      }
    }
  });

  const { errors, values, touched, handleSubmit, isSubmitting, getFieldProps } = formik;

  useEffect(() => {
    getRoleId();
    setRoleConfig(
      dispatch,
      isEdit && currentRole?.components && currentRole?.components?.length !== 0 ? currentRole?.components[0] : CONFIG
    );
  }, [dispatch, getRoleId, isEdit, currentRole]);

  return (
    <FormikProvider value={formik}>
      <Form noValidate autoComplete="off" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={12}>
            <Card sx={{ p: 3 }}>
              <Stack spacing={3}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                  <TextField
                    fullWidth
                    label="Role Id"
                    id="outlined-read-only-input"
                    defaultValue=" "
                    disabled
                    {...getFieldProps('roleID')}
                    InputProps={{
                      readOnly: true
                    }}
                    // SelectProps={{ native: true }}
                    error={Boolean(touched.roleID && errors.roleID)}
                    helperText={touched.roleID && errors.roleID}
                  />
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                  <TextField
                    fullWidth
                    label="Role"
                    {...getFieldProps('roleName')}
                    error={Boolean(touched.roleName && errors.roleName)}
                    helperText={touched.roleName && errors.roleName}
                  />
                </Stack>

                {/* <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                  <Autocomplete
                    multiple
                    freeSolo
                    fullWidth
                    // size="small"
                    value={Object.keys(pageConfig)}
                    id="tags-outlined"
                    onChange={(e, value, situation, option) => {
                      const newConfig = { ...pageConfig };
                      if (situation === 'createOption') {
                        newConfig[option.option] = true;
                      } else if (situation === 'removeOption' && option.option.toLowerCase() !== 'view') {
                        delete newConfig[option.option];
                        setPageConfig((state) => value);
                      }
                      setPageConfig((state) => newConfig);
                    }}
                    options={Object.keys(pageConfig)}
                    getOptionLabel={(option) => option}
                    style={{ textTransform: 'capitalize' }}
                    filterSelectedOptions
                    renderOption={(props, option, { selected }) => (
                      <li {...props}>
                        <Checkbox icon={icon} checkedIcon={checkedIcon} style={{ marginRight: 8 }} checked={selected} />
                        {option}
                      </li>
                    )}
                    renderInput={(params) => <TextField {...params} label="Config" />}
                  />
                </Stack> */}

                {/* <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                  <Autocomplete
                    multiple
                    freeSolo
                    fullWidth
                    // size="small"
                    value={Object.keys(roleConfig)}
                    id="tags-outlined"
                    onChange={(e, value, situation, option) => {
                      const newConfig = { ...roleConfig };
                      if (situation === 'createOption') {
                        newConfig[option.option] = pageConfig;
                      } else if (situation === 'removeOption' && option.option.toLowerCase() !== 'projects') {
                        delete newConfig[option.option];
                        // setConfig(dispatch, value);
                      }
                      setRoleConfig(dispatch, newConfig);
                    }}
                    options={Object.keys(roleConfig)}
                    getOptionLabel={(option) => option}
                    style={{ textTransform: 'capitalize' }}
                    filterSelectedOptions
                    renderOption={(props, option, { selected }) => (
                      <li {...props}>
                        <Checkbox icon={icon} checkedIcon={checkedIcon} style={{ marginRight: 8 }} checked={selected} />
                        {option}
                      </li>
                    )}
                    renderInput={(params) => <TextField {...params} label="Components" />}
                  />
                </Stack> */}

                {/* <Stack>
                  <FormGroup aria-label="position" row>
                    {pageConfig &&
                      Object.keys(pageConfig)?.map((configItem) => (
                        <>
                          <FormControlLabel
                            control={
                              <Switch
                                defaultChecked={pageConfig[configItem]}
                                onClick={() => {
                                  handleConfigItemCheck(configItem);
                                }}
                              />
                            }
                            label={configItem}
                            style={{ textTransform: 'capitalize' }}
                            labelPlacement="end"
                          />
                        </>
                      ))}
                  </FormGroup>
                </Stack> */}

                {/* <Grid item xs={12} md={12}>
                  <Card>
                    {Object.keys(roleConfig)?.map((configItems, index) => (
                      <>
                        <Accordion key={configItems} style={{ width: '100%', height: '20%' }} defaultExpanded>
                          <AccordionSummary
                            expandIcon={<Icon icon={arrowIosDownwardFill} width={20} height={20} />}
                            style={{
                              background: 'linear-gradient(to right, #bdc3c7, #2c3e50)',
                              borderRadius: 4,
                              marginBottom: '15px'
                            }}
                          >
                            <Typography variant="subtitle1" style={{ textTransform: 'capitalize' }}>
                              {configItems}
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={{ xs: 4, sm: 2 }}
                              style={{ marginBottom: '15px' }}
                            >
                              <Autocomplete
                                multiple
                                freeSolo
                                fullWidth
                                // size="small"
                                value={Object.keys(roleConfig[configItems])}
                                id="tags-outlined"
                                onChange={(e, value, situation, option) => {
                                  // const newPageConfig = { ...pageConfig };
                                  const tempConfig = { ...roleConfig };
                                  const tempItems = { ...tempConfig[configItems] };
                                  // setRoleConfig(dispatch, newConfig);
                                  if (situation === 'createOption') {
                                    tempItems[option.option] = true;
                                    tempConfig[configItems] = tempItems;
                                    // newPageConfig[option.option] = true;
                                  } else if (situation === 'removeOption' && option.option.toLowerCase() !== 'view') {
                                    delete tempItems[option.option];
                                    tempConfig[configItems] = tempItems;
                                    // delete newPageConfig[option.option];
                                    // setPageConfig((state) => value);
                                  }
                                  setRoleConfig(dispatch, tempConfig);
                                  // setPageConfig((state) => newPageConfig);
                                }}
                                options={Object.keys(roleConfig[configItems])}
                                getOptionLabel={(option) => option}
                                style={{ textTransform: 'capitalize' }}
                                filterSelectedOptions
                                renderOption={(props, option, { selected }) => (
                                  <li {...props}>
                                    <Checkbox
                                      icon={icon}
                                      checkedIcon={checkedIcon}
                                      style={{ marginRight: 8 }}
                                      checked={selected}
                                    />
                                    {option}
                                  </li>
                                )}
                                renderInput={(params) => <TextField {...params} label="Config" />}
                              />
                            </Stack>
                            <Box sx={{ display: 'flex', flexDirection: 'row', ml: 3 }}>
                              <FormControlLabel
                                label="All"
                                control={
                                  <Checkbox
                                    checked={handleAllChecks(configItems, index)}
                                    onChange={() => handleChange(configItems, 'all')}
                                  />
                                }
                              />
                              {Object.keys(roleConfig[configItems]).map((items) => (
                                <FormControlLabel
                                  label={(configItems, items)}
                                  style={{ textTransform: 'capitalize' }}
                                  control={
                                    <Checkbox
                                      checked={handleChecks(configItems, items)}
                                      onChange={() => handleChange(configItems, items)}
                                    />
                                  }
                                />
                              ))}
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      </>
                    ))}
                  </Card>
                </Grid> */}

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                    {!isEdit ? 'Create Role' : 'Save Changes'}
                  </LoadingButton>
                </Box>
              </Stack>
              <Dialog
                open={open}
                onClose={handleClose}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
              >
                <DialogTitle id="alert-dialog-title">Role Info</DialogTitle>
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
