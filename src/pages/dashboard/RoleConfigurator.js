import { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { useSpring, animated } from 'react-spring';
import { Icon } from '@iconify/react';
import { useSnackbar } from 'notistack';
// material
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Container,
  Card,
  Checkbox,
  Collapse,
  Box,
  FormControlLabel,
  Typography,
  Stack,
  TextField
} from '@mui/material';
// redux
import { LoadingButton } from '@mui/lab';
import arrowIosDownwardFill from '@iconify/icons-eva/arrow-ios-downward-fill';
import { Form, FormikProvider, useFormik } from 'formik';
import { useDispatch, useSelector } from '../../redux/store';
import { getUserList } from '../../redux/slices/user';
import {
  setRoleConfig,
  setClientsRoleConfigList,
  getCreateRoleConfig,
  setCurrentRole,
  setRolesList,
  setFilteredRolesList
} from '../../redux/slices/role';
import { getRolesList, getClientsRoleConfigList } from '../../_apis_/role';

// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';

// ----------------------------------------------------------------------

TransitionComponent.propTypes = {
  in: PropTypes.bool
};

function TransitionComponent(props) {
  const style = useSpring({
    from: {
      opacity: 0,
      transform: 'translate3d(20px,0,0)'
    },
    to: {
      opacity: props.in ? 1 : 0,
      transform: `translate3d(${props.in ? 0 : 20}px,0,0)`
    }
  });
  return (
    <animated.div style={style}>
      <Collapse {...props} />
    </animated.div>
  );
}

// ----------------------------------------------------------------------

export default function RoleConfiguration() {
  const { themeStretch } = useSettings();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { userList, appendUrl } = useSelector((state) => state.user);
  const { rolesList, filteredRoleList, clientsRoleConfigList, error } = useSelector((state) => state.role);
  const { roleConfig, defaultRoleConfig, currentRole } = useSelector((state) => state.role);
  const { licenseExpired } = useSelector((state) => state.license);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const navigateToLink = (url) => {
    navigate(getUrl(url));
  };

  const handleChange = (configItems, items) => {
    const tempConfig = { ...roleConfig };
    if (roleConfig && configItems && items && items === 'all') {
      const checked = handleAllChecks(configItems, '');
      const tempItems = { ...tempConfig[configItems] };
      Object.keys(tempItems)?.forEach((items) => {
        tempItems[items] = !checked;
      });
      tempConfig[configItems] = tempItems;
      setRoleConfig(dispatch, tempConfig);
    } else if (roleConfig && configItems && items && items !== 'all') {
      const tempItems = { ...tempConfig[configItems] };
      tempItems[items] = !roleConfig[configItems][items];
      const tItems = { ...tempItems };
      delete tItems.view;
      const count = Object.values(tItems).reduce((a, item) => a + item, 0);
      if (count !== 0) tempItems.view = true;
      tempConfig[configItems] = tempItems;
      setRoleConfig(dispatch, tempConfig);
    }
  };

  const handleChecks = (configItems, items) => {
    let checked = false;
    if (roleConfig && configItems && items) {
      checked = roleConfig[configItems][items];
    }
    return checked;
  };

  const handleAllChecks = (configItems) => {
    let checked = false;
    let count = 0;
    if (configItems) {
      Object.keys(roleConfig[configItems]).forEach((items) => {
        if (items && roleConfig[configItems][items]) count += 1;
        if (parseInt(Object.keys(roleConfig[configItems])?.length, 10) === parseInt(count, 10)) checked = true;
      });
      return checked;
    }
    return null;
  };

  const createConfig = async () => {
    getCreateRoleConfig(dispatch, values);
    if (!error) enqueueSnackbar('Update success', { variant: 'success' });
    else enqueueSnackbar(error, { variant: 'error' });
  };

  const handleRoleChange = async (event) => {
    const roleId = event?.target?.value || values.role || filteredRoleList[0]?._id;
    const role = rolesList?.filter((role) => role._id === roleId)[0];
    setCurrentRole(dispatch, role);
    getRoleConfigList(rolesList, roleId);
    const roleConfig = clientsRoleConfigList?.find((clientRoleConfig) => clientRoleConfig.rid === roleId);
    if (roleConfig) setRoleConfig(dispatch, roleConfig?.components[0]);
    else setRoleConfig(dispatch, defaultRoleConfig?.components[0]);
  };

  const NewRoleConfiguratorSchema = Yup.object().shape({
    role: Yup.string().required('Role is required')
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      role: currentRole?._id,
      components: roleConfig && [roleConfig]
    },
    validationSchema: NewRoleConfiguratorSchema,
    onSubmit: async (values, { setSubmitting, setErrors }) => {
      try {
        await createConfig();
        setSubmitting(false);
        const user = userList?.find((user) => user.email.toLowerCase() === values.email.toLowerCase());
        if (!user) {
          enqueueSnackbar('Create success', { variant: 'success' });
          navigateToLink(PATH_DASHBOARD.user.allUsers);
        }
      } catch (error) {
        setSubmitting(false);
        setErrors(error);
      }
    }
  });

  const { errors, values, touched, handleSubmit, isSubmitting, setFieldValue, getFieldProps } = formik;

  const getRoleConfigList = useCallback(
    async (rolesList, roleId, setRole) => {
      const clientsRoleConfigList = await getClientsRoleConfigList();
      setClientsRoleConfigList(dispatch, clientsRoleConfigList);
      const filteredRolesList = rolesList?.filter((role) => !['R0001', 'R0002'].includes(role.roleID));
      setFilteredRolesList(dispatch, filteredRolesList);
      if (filteredRolesList?.length > 0 && setRole) {
        setFieldValue('role', filteredRolesList[0]._id);
        setCurrentRole(dispatch, filteredRolesList[0]);
      }
      if (clientsRoleConfigList?.length > 0) {
        let rConfig = clientsRoleConfigList?.find((roleConfig) => roleConfig?.rid === filteredRolesList[0]?._id);
        if (roleId) {
          setFieldValue('role', roleId);
          rConfig = clientsRoleConfigList?.find((roleConfig) => roleConfig?.rid === roleId);
        }
        if (rConfig?.components) setRoleConfig(dispatch, rConfig?.components[0]);
      }
    },
    [dispatch, setFieldValue]
  );

  const getDisabled = (configItems, items) => {
    const releasesDisabled = Object.values(roleConfig.releases).every((val) => val === false || val === 'false');
    const testRunsDisabled = Object.values(roleConfig.testRuns).every((val) => val === false || val === 'false');
    const disabled =
      (configItems === 'projects' && items === 'view') ||
      (configItems === 'releaseTestCases' && releasesDisabled) ||
      (configItems === 'testRunsTestCases' && testRunsDisabled);
    return disabled;
  };

  useEffect(() => {
    dispatch(getUserList());
    const fetchData = async () => {
      const rolesList = await getRolesList();
      setRolesList(dispatch, rolesList);
      await getRoleConfigList(rolesList, null, true);
    };
    if (!rolesList) fetchData();
  }, [dispatch, getRoleConfigList, rolesList]);

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading="Role Configurator"
          links={[{ name: 'Configurator' }]}
          info="Test modules allow you to organize test cases inside a project just like you would organize documents using folders and sub-folders."
        />
        <FormikProvider value={formik}>
          <Form noValidate autoComplete="off" onSubmit={handleSubmit}>
            <Card
              alignItems="center"
              sx={{
                p: 3,
                width: '100%',
                alignItems: 'center',
                boxShadow: (theme) => theme.customShadows.z8
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                <TextField
                  select
                  fullWidth
                  label="Role"
                  InputLabelProps={{ shrink: true }}
                  value={currentRole?._id || ''}
                  {...getFieldProps('role')}
                  onChange={handleRoleChange}
                  SelectProps={{ native: true }}
                  error={Boolean(touched.role && errors.role)}
                  helperText={touched.role && errors.role}
                >
                  <option key="" value="" />
                  {filteredRoleList &&
                    filteredRoleList?.map((role) => (
                      <option key={role?._id} value={role?._id}>
                        {role?.roleName}
                      </option>
                    ))}
                </TextField>
              </Stack>
              {roleConfig &&
                Object.keys(roleConfig)?.map((configItems, index) => (
                  <>
                    <Accordion
                      key={configItems}
                      style={{ width: '100%' }}
                      defaultExpanded
                      classes={{
                        root: {
                          height: '15px'
                        }
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<Icon icon={arrowIosDownwardFill} width={20} height={20} />}
                        style={{
                          background: '#ebf8ef',
                          borderRadius: 4,
                          marginBottom: '5px'
                        }}
                      >
                        <Typography variant="subtitle1" style={{ textTransform: 'capitalize' }}>
                          {configItems}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'row', ml: 3 }}>
                          <FormControlLabel
                            label="All"
                            control={
                              <Checkbox
                                disabled={configItems === 'projects' || getDisabled(configItems, null)}
                                checked={handleAllChecks(configItems, index)}
                                onChange={() => handleChange(configItems, 'all')}
                              />
                            }
                          />
                          {roleConfig &&
                            Object.keys(roleConfig[configItems])?.map((items) => (
                              <>
                                <FormControlLabel
                                  label={(configItems, items)}
                                  style={{ textTransform: 'capitalize' }}
                                  disabled={getDisabled(configItems, items)}
                                  control={
                                    <Checkbox
                                      checked={handleChecks(configItems, items)}
                                      onChange={() => handleChange(configItems, items)}
                                    />
                                  }
                                />
                              </>
                            ))}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  </>
                ))}
              {!licenseExpired && (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                    Save Changes
                  </LoadingButton>
                </Box>
              )}
            </Card>
          </Form>
        </FormikProvider>
      </Container>
    </Page>
  );
}
