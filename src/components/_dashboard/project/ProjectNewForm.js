import * as Yup from 'yup';
import PropTypes from 'prop-types';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { Form, FormikProvider, useFormik, setNestedObjectValues } from 'formik';
import { Icon } from '@iconify/react';
// material
import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  DialogContentText,
  Grid,
  Stack,
  Switch,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
  FormControlLabel
} from '@mui/material';
import arrowIosDownwardFill from '@iconify/icons-eva/arrow-ios-downward-fill';
import axios from 'axios';
import { useEffect, useCallback, useState, useRef } from 'react';
import API from '../../../services';
import { getSessionObj } from '../../../utils/jwt';
// utils
import { useDispatch, useSelector } from '../../../redux/store';
// routes
import { PATH_DASHBOARD } from '../../../routes/paths';

//
import {
  getCreateProject,
  getEditProject,
  getFilteredProjectList,
  getTemaplatesByCompanyId
} from '../../../redux/slices/project';
import STATUS from './ProjectStatus';
import { UploadSingleFile, UploadMultiFile } from '../../upload';
import { ACCEPT_JSON, ACCEPT_JSON_XML } from '../../../Constants';

// ----------------------------------------------------------------------

ProjectNewForm.propTypes = {
  isEdit: PropTypes.bool,
  currentUser: PropTypes.object,
  currentProject: PropTypes.object,
  userList: PropTypes.object
};

export default function ProjectNewForm({ isEdit, currentUser, currentProject, userList }) {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useDispatch();
  const [team, setTeam] = useState([]);
  const [emailNotifications, setEmailNotifications] = useState([]);
  const [testStepsFile, setTestStepsFile] = useState(null);
  const [apiRequestFiles, setApiRequestFiles] = useState({});
  const [testStepsFileName, setTestStepsFileName] = useState('');
  const [testSteps, setTestSteps] = useState({});
  const [suiteNames, setSuiteNames] = useState([]);
  const { appendUrl } = useSelector((state) => state.user);
  const { projectList, companyStatusProjectList, templatesList } = useSelector((state) => state.project);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState({});
  const [creds, setCreds] = useState([]);
  const [apiFiles, setApiFiles] = useState([]);
  const [requestFiles, setRequestFiles] = useState([]);
  // const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [teamAutocompleteOpen, setTeamAutocompleteOpen] = useState(false);
  const prevTeamRef = useRef([]);
  const prevEmailNotificationsRef = useRef([]);

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

  const NewProjectSchema = Yup.object().shape({
    name: Yup.string().required('Project Name is required'),
    template: Yup.string().required('Automation Name is required'),
    validateCredential: Yup.boolean(),

    apiCredentialName: Yup.string().when('validateCredential', {
      is: true,
      then: (schema) =>
        schema
          .min(3, 'API Credential Name should be more than 3 characters')
          .required('API Credential Name is required')
          .matches(/^\S*$/, 'API Credential Name cannot contain spaces'),
      otherwise: (schema) => schema.notRequired()
    }),

    accessTokenUrl: Yup.string().when('validateCredential', {
      is: true,
      then: (schema) => schema.required('Access Token Url is required'),
      otherwise: (schema) => schema.notRequired()
    }),

    clientID: Yup.string().when('validateCredential', {
      is: true,
      then: (schema) => schema.required('Client ID is required'),
      otherwise: (schema) => schema.notRequired()
    }),

    clientSecret: Yup.string().when('validateCredential', {
      is: true,
      then: (schema) => schema.required('Client Secret is required'),
      otherwise: (schema) => schema.notRequired()
    }),

    apiUserName: Yup.string().when('validateCredential', {
      is: true,
      then: (schema) => schema.required('API Username is required'),
      otherwise: (schema) => schema.notRequired()
    }),

    apiPassword: Yup.string().when('validateCredential', {
      is: true,
      then: (schema) => schema.required('API Password is required'),
      otherwise: (schema) => schema.notRequired()
    }),

    apiCookie: Yup.string().when('validateCredential', {
      is: true,
      then: (schema) => schema.required('API Cookie is required'),
      otherwise: (schema) => schema.notRequired()
    }),

    validateAddAPIRequest: Yup.boolean(), // ✅ corrected typo

    apiRequestName: Yup.string().when('validateAddAPIRequest', {
      is: true,
      then: (schema) => schema.required('API Request Name is required'),
      otherwise: (schema) => schema.notRequired()
    }),

    credentials: Yup.string().when('validateAddAPIRequest', {
      is: true,
      then: (schema) => schema.required('Credentials is required'),
      otherwise: (schema) => schema.notRequired()
    }),

    requestType: Yup.string().when('validateAddAPIRequest', {
      is: true,
      then: (schema) => schema.required('Request Type is required'),
      otherwise: (schema) => schema.notRequired()
    })
  });

  const checkSchemaValue = (key) => !!values?.[key];

  const handleDropSingleFile = useCallback((acceptedFiles, rejectedFiles) => {
    try {
      if (rejectedFiles.length === 0) {
        const file = acceptedFiles[0];
        if (file) {
          setTestStepsFile({ ...file, preview: URL.createObjectURL(file) });
          const fileName = file.name;
          setTestStepsFileName(fileName);
          if (fileName.includes('.json')) {
            const reader = new FileReader();
            reader.readAsText(file);
            reader.onload = async (e) => {
              const text = e.target.result;
              if (text.includes('suiteName') && !text.includes('suiteNames')) {
                setMessage('You have uploaded Project module. Please verify and upload default JSON!!');
                onTestStepsFileDelete();
              } else {
                try {
                  setMessage('');
                  const json = JSON.parse(text);
                  if (json?.testCaseSteps) setTestSteps(json?.testCaseSteps);
                  if (json?.suiteNames) setSuiteNames(json?.suiteNames);
                } catch (err) {
                  setMessage(
                    'There is some issue with uploaded default json. Please verify and upload valid default JSON!!'
                  );
                  onTestStepsFileDelete();
                }
              }
            };
          }
        } else {
          setMessage('Please upload json file');
          setTestSteps({});
          setSuiteNames([]);
        }
      } else {
        setMessage('There is some issue with uploaded default json. Please verify and upload valid default JSON!!');
      }
    } catch (err) {
      console.log('err', err);
    }
  }, []);

  const handleDropMultiFile = useCallback(
    (acceptedFiles, rejectedFiles) => {
      try {
        if (rejectedFiles.length === 0) {
          const apiRequestFiles = {};
          acceptedFiles.forEach((element) => {
            const file = element;
            if (file) {
              setApiRequestFiles({ ...file, preview: URL.createObjectURL(file) });
              const fileName = file.name;
              const fileType = file.type;
              if (fileName.includes('.xml') || fileName.includes('.json')) {
                const reader = new FileReader();
                reader.readAsText(file);
                reader.onload = async (e) => {
                  const text = e.target.result;
                  apiFiles.push({ name: fileName, body: text, fileType });
                  apiRequestFiles[fileName.replace('.xml', '').replace('.json', '')] = text;
                  if (text.includes('<?xml') || text.includes('{')) {
                    // onTestStepsFileDelete();
                  } else {
                    try {
                      setMessage('');
                      const json = JSON.parse(text);
                      apiFiles.push({ name: fileName, body: json });
                    } catch (err) {
                      // onTestStepsFileDelete();
                    }
                  }
                };
              }

              setApiRequestFiles(apiRequestFiles);
            } else {
              setMessage('Please upload json or xml file');
            }
          });
        } else {
          setMessage('Issue with uploaded file');
        }
      } catch (err) {
        console.log('err', err);
      }
    },
    [apiFiles]
  );

  const handleAddRequestFile = () => {
    if (Object.keys(errors).length === 0) {
      const requestFile = {
        apiRequestName: values.apiRequestName,
        credentials: values.credentials,
        requestType: values.requestType,
        apiFiles
      };
      requestFiles.push(requestFile);
      setRequestFiles(requestFiles);
      setFieldValue('apiRequestName', '');
      setFieldValue('credentials', '');
      setFieldValue('requestType', '');
      setApiFiles([]);
    } else {
      formik.setTouched(setNestedObjectValues(errors, true));
    }
  };

  const onTestStepsFileDelete = () => {
    setTestStepsFile(null);
    setTestStepsFileName(null);
    setTestSteps({});
    setSuiteNames([]);
  };

  const handleReplaceFile = (type) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type;
    input.onchange = () => {
      Array.from(input.files);
    };
    input.click();
  };

  const handleValidateCredential = () => {
    setFieldValue('validateCredential', !formik.values.validateCredential);
  };

  const handleValidateAddAPIRequest = () => {
    setFieldValue('validateAddAPIRequest', !formik.values.validateAddAPIRequest);
  };

  const handleAddCredentials = () => {
    if (Object.keys(errors).length === 0) {
      const apiCreds = {
        apiCredentialName: values.apiCredentialName,
        accessTokenUrl: values.accessTokenUrl,
        clientID: values.clientID,
        clientSecret: values.clientSecret,
        apiUserName: values.apiUserName,
        apiPassword: values.apiPassword,
        apiCookie: values.apiCookie
      };
      const isCredentialExist = creds.some((cred) => cred.apiCredentialName === apiCreds.apiCredentialName);
      if (isCredentialExist) {
        // Show a message or handle the case when the credential already exists
        formik.setFieldError('apiCredentialName', 'This API Credential Name already exists.');
      } else {
        setCredentials(apiCreds);
        creds.push(apiCreds);
        setFieldValue('apiCredentialName', '');
        setFieldValue('accessTokenUrl', '');
        setFieldValue('clientID', '');
        setFieldValue('clientSecret', '');
        setFieldValue('apiUserName', '');
        setFieldValue('apiPassword', '');
        setFieldValue('apiCookie', '');
      }
    } else {
      formik.setTouched(setNestedObjectValues(errors, true));
    }
  };

  const createProject = async () => {
    // Cross checking the new Project name with the existing active project names in a company
    let projectFound = await axios({
      method: 'post',
      url: `${API.projects.checkProjectNameExists}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      },
      data: {
        projectName: values.name,
        company: currentUser.company._id
      }
    });
    projectFound = projectFound?.data;
    if (projectFound && !isEdit) {
      setOpen(true);
    } else {
      const ids = [currentUser._id];
      const emailNotificationsIds = [];
      values.team.map((selectedUser) => {
        const user = userList?.find(
          (user) =>
            user.firstName === selectedUser.split(' ')[0] &&
            user.lastName === selectedUser.split(' ')[1] &&
            user._id !== currentUser._id
        );

        if (user !== undefined) ids.push(user?._id);

        return () => {};
      });

      try {
        if (Array.isArray(values?.emailNotifications)) {
          values?.emailNotifications?.map((selectedUser) => {
            const user = userList?.find(
              (user) =>
                user.firstName === selectedUser.split(' ')[0] &&
                user.lastName === selectedUser.split(' ')[1] &&
                user._id !== currentUser._id
            );

            if (user !== undefined) emailNotificationsIds.push(user?._id);

            return () => {};
          });
        }
        if (!values?.emailNotifications?.includes(currentUser?._id)) {
          emailNotificationsIds.push(currentUser?._id);
        }
      } catch (error) {
        console.log('error', error);
      }

      const formData = {
        name: values.name,
        description: values.description,
        status: values.status ? STATUS.CLOSED : STATUS.ACTIVE,
        company: currentUser.company,
        team: ids,
        emailNotifications: emailNotificationsIds,
        modules: [],
        apiCreds: creds,
        apiRequestFiles,
        requestFiles,
        createdBy: currentUser._id,
        email: currentUser.email,
        templateID: values.template,
        testCaseSteps:
          isEdit &&
          testSteps &&
          Object.keys(testSteps)?.length === 0 &&
          Object.keys(currentProject?.testCaseSteps)?.length > 0
            ? currentProject?.testCaseSteps
            : testSteps,
        suiteNames:
          isEdit && suiteNames?.length === 0 && currentProject?.suiteNames?.length > 0
            ? currentProject?.suiteNames
            : suiteNames
      };

      if (!isEdit) {
        getCreateProject(dispatch, formData);
      } else {
        getEditProject(dispatch, formData, currentProject._id);
      }
      filterUnArchivedProjects();
    }
  };

  const filterUnArchivedProjects = () => {
    dispatch(getFilteredProjectList(STATUS.UNARCHIVED, currentUser?.company?._id));
  };

  const getTemaplatesList = useCallback(() => {
    dispatch(getTemaplatesByCompanyId());
  }, [dispatch]);

  function handleTagsChange() {}

  useEffect(() => {
    const team = [];

    if (currentProject !== undefined) {
      currentProject?.team?.map((userId) => {
        const user = userList?.find((user) => user._id === userId);
        const name = `${user?.firstName} ${user?.lastName}`;
        if (user && name) {
          team.push(name);
          setTeam(team);
          // Setting whole team of the project in useRef variable using useEffect method
          prevTeamRef.current = team;
        }
        return () => {};
      });
      const emailNotifications = [];
      currentProject?.emailNotifications?.map((userId) => {
        const user = userList?.find((user) => user._id === userId);
        const name = `${user?.firstName} ${user?.lastName}`;
        if (user && name) {
          emailNotifications.push(name);
          // setEmailNotifications(emailNotifications);
          setFieldValue('emailNotifications', emailNotifications);
          // Setting whole team of the project in useRef variable using useEffect method
          prevEmailNotificationsRef.current = emailNotifications;
        }
        return () => {};
      });
      if (currentProject?.apiCreds) setCreds(currentProject?.apiCreds);
      if (currentProject?.requestFiles) setRequestFiles(currentProject?.requestFiles);
    }
    setSuiteNames([]);
    setTestSteps([]);
    getTemaplatesList();
  }, [dispatch, currentProject, getTemaplatesList, userList]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: currentProject?.name || '',
      description: currentProject?.description || '',
      status: currentProject?.status === 'CLOSED' ? true : false || false,
      globalValue: currentProject?.globalValue || false,
      team: (team?.length > 0 && team) || [`${currentUser.firstName} ${currentUser.lastName}`],
      emailNotifications: [],
      template: currentProject?.templateID || '',
      apiCreds: currentProject?.apiCreds || '',
      apiCredentialName: '',
      accessTokenUrl: '',
      clientID: '',
      clientSecret: '',
      apiUserName: '',
      apiPassword: '',
      apiCookie: '',
      apiRequestName: '',
      credentials: '',
      requestType: ''
    },
    validationSchema: NewProjectSchema,
    validateOnChange: true,
    onSubmit: async (values, { setSubmitting, resetForm, setErrors }) => {
      try {
        // await fakeRequest(500);
        await createProject();
        setSubmitting(false);
        const project = projectList?.find((project) => project.name.toLowerCase() === values.name.toLowerCase());
        if (!project || isEdit) {
          resetForm();
          enqueueSnackbar(!isEdit ? 'Project created successfully' : 'Project changes saved', { variant: 'success' });
          navigateToLink(PATH_DASHBOARD.project.allProjects);
        }
      } catch (error) {
        setSubmitting(false);
        setErrors(error);
      }
    }
  });

  const { values, errors, touched, handleSubmit, isSubmitting, setFieldValue, getFieldProps } = formik;

  return (
    <FormikProvider value={formik}>
      <Form noValidate autoComplete="off" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={12}>
            <Card sx={{ p: 3 }}>
              <Stack spacing={3}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                  <TextField
                    size="small"
                    fullWidth
                    disabled={isEdit}
                    label="Project Name"
                    {...getFieldProps('name')}
                    error={Boolean(touched.name && errors.name)}
                    helperText={touched.name && errors.name}
                  />
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                  <TextField
                    size="small"
                    fullWidth
                    multiline
                    rows={4}
                    label="Description"
                    {...getFieldProps('description')}
                    error={Boolean(touched.description && errors.description)}
                    helperText={touched.description && errors.description}
                  />
                </Stack>
                <Stack>
                  <FormControlLabel
                    labelPlacement="start"
                    control={<Switch {...getFieldProps('status')} checked={values.status} />}
                    label={
                      <>
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                          Project Status
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Enabling this will close the Project and no actions can be performed.
                        </Typography>
                      </>
                    }
                    sx={{ mx: 0, width: 1, justifyContent: 'space-between' }}
                  />
                </Stack>
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                  Access Permissions
                </Typography>
                <Stack>
                  <TextField style={{ opacity: 0, height: 0, position: 'absolute' }} />
                  <TextField style={{ opacity: 0, height: 0, position: 'absolute' }} tabIndex={0} />

                  <Autocomplete
                    multiple
                    open={teamAutocompleteOpen}
                    // onOpen={() => setTeamAutocompleteOpen(true)}
                    onClose={() => setTeamAutocompleteOpen(false)}
                    value={values?.team || []}
                    onChange={(event, newValue) => {
                      if (isEdit) {
                        // If "clear all" was clicked (newValue is empty)
                        if (newValue.length === 0) {
                          // Find creator's name from userList
                          const projectCreatedUser = userList.find((user) => user._id === currentProject.createdBy);
                          if (projectCreatedUser) {
                            const projectCreatorName = `${projectCreatedUser.firstName} ${projectCreatedUser.lastName}`;
                            // Prevent clearing the creator
                            setFieldValue('team', [projectCreatorName]);
                            prevTeamRef.current = [projectCreatorName];
                            enqueueSnackbar("Project creator can't be removed from the team.", {
                              variant: 'warning'
                            });
                            return;
                          }
                        }
                        // If the project created user is about to be deleted manually
                        const removedUserNames = prevTeamRef.current.filter((user) => !newValue.includes(user));
                        if (removedUserNames.length > 0) {
                          const removedUserName = removedUserNames[0];
                          // Find user in userList based on name
                          const removedUser = userList.find(
                            (user) => `${user.firstName} ${user.lastName}` === removedUserName
                          );
                          // If the removed user's _id matches project creator's id
                          if (removedUser && removedUser._id === currentProject.createdBy) {
                            enqueueSnackbar("Project creator can't be removed from the team.", {
                              variant: 'warning'
                            });
                            return; // don't allow update
                          }
                        }
                        prevTeamRef.current = newValue; // Update previous value ref
                      }
                      setFieldValue('team', newValue);
                    }}
                    options={userList && userList?.map((option) => `${option?.firstName} ${option?.lastName}`)}
                    openOnFocus={false}
                    autoHighlight={false}
                    // renderUsers={(value, getUserProps) =>
                    //   userList &&
                    //   userList?.map((user, index) => (
                    //     <Chip
                    //       key={user?._id}
                    //       value={user?._id}
                    //       size="small"
                    //       label={`${user?.firstName} ${user?.lastName}`}
                    //       {...getUserProps({ index })}
                    //     />
                    //   ))
                    // }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Users"
                        onClick={() => setTeamAutocompleteOpen((prev) => !prev)}
                      />
                    )}
                  />
                </Stack>
                <Stack spacing={2} sx={{ width: 1 }}>
                  <Stack spacing={1} alignItems="flex-start">
                    <FormControlLabel
                      control={<Switch {...getFieldProps('globalValue')} checked={values.globalValue} />}
                      label={
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                          Automatically add users with their default role to this project
                        </Typography>
                      }
                      sx={{ mx: 0 }}
                    />
                  </Stack>

                  <Stack>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Automation"
                      value={values.template || ''}
                      InputLabelProps={{ shrink: checkSchemaValue('template') }}
                      placeholder="Select Automation Project"
                      id="template"
                      {...getFieldProps('template')}
                      SelectProps={{ native: true }}
                      error={Boolean(touched.template && errors.template)}
                      helperText={touched.template && errors.template}
                    >
                      <option value="" />
                      {templatesList &&
                        templatesList?.map((template) => (
                          <option key={template._id} value={template._id}>
                            {template.name}
                          </option>
                        ))}
                    </TextField>
                  </Stack>

                  <Accordion
                    key="methods"
                    style={{ width: '100%' }}
                    // defaultExpanded
                    classes={{
                      root: {
                        height: '15px'
                      }
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<Icon icon={arrowIosDownwardFill} width={20} height={20} />}
                      style={{
                        background: 'linear-gradient(to right, #bdc3c7, #2c3e50)',
                        borderRadius: 4,
                        marginBottom: '5px'
                      }}
                    >
                      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                        Add API Details
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={3}>
                        {creds && Object.keys(creds)?.length > 0 && (
                          <Stack>
                            <Typography>Credentials</Typography>
                            {creds?.map((cred) => (
                              <Card key={cred} sx={{ p: 3 }}>
                                {Object.keys(cred)?.map((credential) => (
                                  <Stack key={cred} direction="row" spacing={2}>
                                    <Stack
                                      style={{
                                        width: '15%',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                      }}
                                    >
                                      {credential}
                                    </Stack>
                                    <Stack style={{ width: '5%' }}>:</Stack>
                                    <Stack
                                      style={{
                                        width: '80%',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                      }}
                                    >
                                      {credential === 'apiCredentialName'
                                        ? cred[credential]
                                        : '*'.repeat(cred[credential].length)}
                                    </Stack>
                                  </Stack>
                                ))}
                              </Card>
                            ))}
                          </Stack>
                        )}

                        <Accordion
                          key="apiCreds"
                          style={{ width: '100%' }}
                          // defaultExpanded
                          classes={{
                            root: {
                              height: '15px'
                            }
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<Icon icon={arrowIosDownwardFill} width={20} height={20} />}
                            style={{
                              background: 'linear-gradient(to right, #bdc3c7, #2c3e50)',
                              borderRadius: 4,
                              marginBottom: '5px'
                            }}
                            onClick={handleValidateCredential}
                          >
                            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                              Add Credentials
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack spacing={3}>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  label="API Credential Name"
                                  {...getFieldProps('apiCredentialName')}
                                  error={Boolean(touched.apiCredentialName && errors.apiCredentialName)}
                                  helperText={touched.apiCredentialName && errors.apiCredentialName}
                                />
                              </Stack>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  label="Access Token Url"
                                  type="Password"
                                  {...getFieldProps('accessTokenUrl')}
                                  error={Boolean(touched.accessTokenUrl && errors.accessTokenUrl)}
                                  helperText={touched.accessTokenUrl && errors.accessTokenUrl}
                                />
                              </Stack>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  label="Client ID"
                                  type="Password"
                                  {...getFieldProps('clientID')}
                                  error={Boolean(touched.clientID && errors.clientID)}
                                  helperText={touched.clientID && errors.clientID}
                                />
                              </Stack>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  label="Client Secret"
                                  type="Password"
                                  {...getFieldProps('clientSecret')}
                                  error={Boolean(touched.clientSecret && errors.clientSecret)}
                                  helperText={touched.clientSecret && errors.clientSecret}
                                />
                              </Stack>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  label="Username"
                                  type="Password"
                                  {...getFieldProps('apiUserName')}
                                  error={Boolean(touched.apiUserName && errors.apiUserName)}
                                  helperText={touched.apiUserName && errors.apiUserName}
                                />
                              </Stack>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  label="Password"
                                  type="Password"
                                  {...getFieldProps('apiPassword')}
                                  error={Boolean(touched.apiPassword && errors.apiPassword)}
                                  helperText={touched.apiPassword && errors.apiPassword}
                                />
                              </Stack>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  label="Cookie"
                                  type="Password"
                                  {...getFieldProps('apiCookie')}
                                  error={Boolean(touched.apiCookie && errors.apiCookie)}
                                  helperText={touched.apiCookie && errors.apiCookie}
                                />
                              </Stack>
                              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                <LoadingButton
                                  type="button"
                                  variant="contained"
                                  loading={isSubmitting}
                                  onClick={handleAddCredentials}
                                >
                                  Add Credentials
                                </LoadingButton>
                              </Box>
                            </Stack>
                          </AccordionDetails>
                        </Accordion>

                        {requestFiles?.length > 0 && (
                          <>
                            <Typography>API Requests </Typography>
                            <Card sx={{ p: 3 }}>
                              {requestFiles?.map((requestFile) => (
                                <>
                                  <Stack direction="row" spacing={3}>
                                    <Stack>API Request Name : {requestFile?.apiRequestName}</Stack>
                                    <Stack>
                                      Request File Name : {requestFile?.apiFiles?.map((file) => file.name).join(' ,')}
                                    </Stack>
                                    <Stack>Request Type : {requestFile?.requestType}</Stack>
                                  </Stack>
                                </>
                              ))}
                            </Card>
                          </>
                        )}

                        <Accordion
                          key="methods"
                          style={{ width: '100%' }}
                          // defaultExpanded
                          classes={{
                            root: {
                              height: '15px'
                            }
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<Icon icon={arrowIosDownwardFill} width={20} height={20} />}
                            style={{
                              background: 'linear-gradient(to right, #bdc3c7, #2c3e50)',
                              borderRadius: 4,
                              marginBottom: '5px'
                            }}
                            onClick={handleValidateAddAPIRequest}
                          >
                            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                              Add API Request
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack spacing={3}>
                              <Stack>
                                <TextField
                                  size="small"
                                  fullWidth
                                  SelectProps={{ native: true }}
                                  label="API Request Name"
                                  {...getFieldProps('apiRequestName')}
                                  error={Boolean(touched.apiRequestName && errors.apiRequestName)}
                                  helperText={touched.apiRequestName && errors.apiRequestName}
                                />
                              </Stack>
                              <Stack>
                                <TextField
                                  size="small"
                                  fullWidth
                                  select
                                  SelectProps={{ native: true }}
                                  label="Credentials"
                                  {...getFieldProps('credentials')}
                                  error={Boolean(touched.credentials && errors.credentials)}
                                  helperText={touched.credentials && errors.credentials}
                                >
                                  <option value="" />
                                  {creds &&
                                    creds?.map((cred) => (
                                      <option key={cred.apiCredentialName} value={cred.apiCredentialName}>
                                        {cred.apiCredentialName}
                                      </option>
                                    ))}
                                </TextField>
                              </Stack>

                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  select
                                  SelectProps={{ native: true }}
                                  label="Request Type"
                                  {...getFieldProps('requestType')}
                                  error={Boolean(touched.requestType && errors.requestType)}
                                  helperText={touched.requestType && errors.requestType}
                                >
                                  <option value="" />
                                  <option>GET</option>
                                  <option>POST</option>
                                  <option>PUT</option>
                                  <option>DELETE</option>
                                </TextField>
                              </Stack>

                              <Stack spacing={2}>
                                <Typography variant="subtitle2" sx={{ color: 'text.error' }}>
                                  {message}
                                </Typography>
                                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                                  API Request Files
                                </Typography>
                                <UploadMultiFile
                                  file={apiRequestFiles}
                                  accept={ACCEPT_JSON_XML}
                                  showPreview
                                  onDrop={handleDropMultiFile}
                                  onReplace={handleReplaceFile}
                                  onDelete={onTestStepsFileDelete}
                                  name="API Request File"
                                />
                              </Stack>
                              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                <LoadingButton
                                  type="button"
                                  variant="contained"
                                  loading={isSubmitting}
                                  onClick={handleAddRequestFile}
                                >
                                  Add API Request
                                </LoadingButton>
                              </Box>
                            </Stack>
                          </AccordionDetails>
                        </Accordion>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                  <Stack spacing={2}>
                    <Typography variant="subtitle2" sx={{ color: 'text.error' }}>
                      {message}
                    </Typography>
                    <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                      Execution File
                    </Typography>
                    <UploadSingleFile
                      file={testStepsFile}
                      accept={ACCEPT_JSON}
                      fileName={testStepsFileName}
                      onDrop={handleDropSingleFile}
                      onReplace={handleReplaceFile}
                      onDelete={onTestStepsFileDelete}
                      name="Execution File"
                    />
                  </Stack>
                  <Stack>
                    {((suiteNames && suiteNames?.length > 0) || currentProject?.suiteNames?.length > 0) && (
                      <>
                        {suiteNames && suiteNames?.length > 0 && (
                          <Accordion
                            key="methods"
                            style={{ width: '100%' }}
                            // defaultExpanded
                            classes={{
                              root: {
                                height: '15px'
                              }
                            }}
                          >
                            <AccordionSummary
                              expandIcon={<Icon icon={arrowIosDownwardFill} width={20} height={20} />}
                              style={{
                                background: 'linear-gradient(to right, #bdc3c7, #2c3e50)',
                                borderRadius: 4,
                                marginBottom: '5px'
                              }}
                            >
                              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                                Suite Names
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                              <List dense sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
                                {suiteNames &&
                                  suiteNames?.length > 0 &&
                                  suiteNames?.map((suiteName) => {
                                    const labelId = `checkbox-list-secondary-label-${suiteName}`;
                                    return (
                                      <ListItem key={suiteName} disablePadding>
                                        <ListItemButton>
                                          <ListItemText id={labelId} primary={suiteName} />
                                        </ListItemButton>
                                      </ListItem>
                                    );
                                  })}
                              </List>
                            </AccordionDetails>
                          </Accordion>
                        )}

                        {currentProject?.suiteNames?.length > 0 && (
                          <Accordion
                            key="methods"
                            style={{ width: '100%' }}
                            // defaultExpanded
                            classes={{
                              root: {
                                height: '15px'
                              }
                            }}
                          >
                            <AccordionSummary
                              expandIcon={<Icon icon={arrowIosDownwardFill} width={20} height={20} />}
                              style={{
                                background: 'linear-gradient(to right, #bdc3c7, #2c3e50)',
                                borderRadius: 4,
                                marginBottom: '5px'
                              }}
                            >
                              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                                Available Suite Names
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                              <List dense sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
                                {currentProject?.suiteNames?.length > 0 &&
                                  currentProject?.suiteNames?.map((suiteName) => {
                                    const labelId = `checkbox-list-secondary-label-${suiteName}`;
                                    return (
                                      <>
                                        <ListItem key={suiteName} disablePadding>
                                          <ListItemButton>
                                            <ListItemText id={labelId} primary={suiteName} />
                                          </ListItemButton>
                                        </ListItem>
                                      </>
                                    );
                                  })}
                              </List>
                            </AccordionDetails>
                          </Accordion>
                        )}
                      </>
                    )}
                  </Stack>
                  <Stack>
                    {((testSteps && Object.keys(testSteps) && Object.keys(testSteps)?.length > 0) ||
                      (currentProject?.testCaseSteps &&
                        Object.keys(currentProject?.testCaseSteps) &&
                        Object.keys(currentProject?.testCaseSteps)?.length > 1)) && (
                      <>
                        {Object.keys(testSteps)?.length > 1 && (
                          <Accordion
                            key="methods"
                            style={{ width: '100%' }}
                            // defaultExpanded
                            classes={{
                              root: {
                                height: '15px'
                              }
                            }}
                          >
                            <AccordionSummary
                              expandIcon={<Icon icon={arrowIosDownwardFill} width={20} height={20} />}
                              style={{
                                background: 'linear-gradient(to right, #bdc3c7, #2c3e50)',
                                borderRadius: 4,
                                marginBottom: '5px'
                              }}
                            >
                              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                                Test Steps
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                              <List dense sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
                                {Object.keys(testSteps)?.length > 1 &&
                                  Object.keys(testSteps)?.map((testStep) => {
                                    const labelId = `checkbox-list-secondary-label-${testStep}`;
                                    return (
                                      <ListItem key={testStep} disablePadding>
                                        <ListItemButton>
                                          <ListItemText id={labelId} primary={testStep} />
                                        </ListItemButton>
                                      </ListItem>
                                    );
                                  })}
                              </List>
                            </AccordionDetails>
                          </Accordion>
                        )}

                        {currentProject &&
                          currentProject?.testCaseSteps &&
                          Object.keys(currentProject?.testCaseSteps)?.length > 1 && (
                            <Accordion
                              key="methods"
                              style={{ width: '100%' }}
                              // defaultExpanded
                              classes={{
                                root: {
                                  height: '15px'
                                }
                              }}
                            >
                              <AccordionSummary
                                expandIcon={<Icon icon={arrowIosDownwardFill} width={20} height={20} />}
                                style={{
                                  background: 'linear-gradient(to right, #bdc3c7, #2c3e50)',
                                  borderRadius: 4,
                                  marginBottom: '5px'
                                }}
                              >
                                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                                  Available Test Steps
                                </Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <List dense sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
                                  {currentProject?.testCaseSteps &&
                                    Object.keys(currentProject?.testCaseSteps)?.length > 1 &&
                                    Object.keys(currentProject?.testCaseSteps)?.map((testCaseStep) => {
                                      const labelId = `checkbox-list-secondary-label-${testCaseStep}`;
                                      return (
                                        <>
                                          {testCaseStep?.toString() !== '_id' && (
                                            <ListItem key={testCaseStep} disablePadding>
                                              <ListItemButton>
                                                <ListItemText id={labelId} primary={testCaseStep} />
                                              </ListItemButton>
                                            </ListItem>
                                          )}
                                        </>
                                      );
                                    })}
                                </List>
                              </AccordionDetails>
                            </Accordion>
                          )}
                      </>
                    )}
                  </Stack>
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                    Issue Email Notifications
                  </Typography>
                  <Stack onBlur={handleTagsChange}>
                    <Autocomplete
                      multiple
                      value={values?.emailNotifications || []}
                      onChange={(event, newValue) => {
                        if (isEdit) {
                          // If "clear all" was clicked (newValue is empty)
                          if (newValue.length === 0) {
                            // Find creator's name from userList
                            const projectCreatedUser = userList.find((user) => user._id === currentProject.createdBy);
                            if (projectCreatedUser) {
                              const projectCreatorName = `${projectCreatedUser.firstName} ${projectCreatedUser.lastName}`;
                              // Prevent clearing the creator
                              setFieldValue('emailNotifications', [projectCreatorName]);
                              prevEmailNotificationsRef.current = [projectCreatorName];
                              enqueueSnackbar("Project creator can't be removed from the team.", {
                                variant: 'warning'
                              });
                              return;
                            }
                          }
                          // If the project created user is about to be deleted manually
                          const removedUserNames = prevTeamRef.current.filter((user) => !newValue.includes(user));
                          if (removedUserNames.length > 0) {
                            const removedUserName = removedUserNames[0];
                            // Find user in userList based on name
                            const removedUser = userList.find(
                              (user) => `${user.firstName} ${user.lastName}` === removedUserName
                            );
                            // If the removed user's _id matches project creator's id
                            if (removedUser && removedUser._id === currentProject.createdBy) {
                              enqueueSnackbar("Project creator can't be removed from the team.", {
                                variant: 'warning'
                              });
                              return; // don't allow update
                            }
                          }
                          prevEmailNotificationsRef.current = newValue; // Update previous value ref
                        }
                        setFieldValue('emailNotifications', newValue);
                      }}
                      options={userList && userList?.map((option) => `${option?.firstName} ${option?.lastName}`)}
                      openOnFocus={false}
                      autoHighlight={false}
                      // renderUsers={(value, getUserProps) =>
                      //   userList &&
                      //   userList?.map((user, index) => (
                      //     <Chip
                      //       key={user?._id}
                      //       value={user?._id}
                      //       size="small"
                      //       label={`${user?.firstName} ${user?.lastName}`}
                      //       {...getUserProps({ index })}
                      //     />
                      //   ))
                      // }
                      renderInput={(params) => <TextField {...params} label="Select Users" />}
                    />
                  </Stack>
                </Stack>
                <Stack spacing={2} sx={{ width: 1 }}>
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                    Advanced Settings
                  </Typography>
                  <Stack spacing={1} alignItems="flex-start">
                    <TextField
                      size="small"
                      fullWidth
                      label="Jira Reference URL"
                      variant="outlined"
                      placeholder="E.g. https://abc.atlassian.com/browse/{id}"
                      helperText="Links generated for test result issues will be based on this template."
                    />
                  </Stack>
                  <Stack spacing={1} alignItems="flex-start">
                    <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                      Requirement Document
                    </Typography>

                    <input type="file" id="myFile" name="filename" />
                  </Stack>
                </Stack>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                    {!isEdit ? 'Create Project' : 'Save Changes'}
                  </LoadingButton>
                </Box>
              </Stack>
              <Dialog
                open={open}
                onClose={handleClose}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
              >
                <DialogTitle id="alert-dialog-title">Project Info</DialogTitle>
                <DialogContent>
                  <DialogContentText id="alert-dialog-description">
                    <br />
                    <br />
                    Project Name with <b>[{values.name}]</b> already exists in the company!!
                    <br />
                    <br />
                    Please change Project Name
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
