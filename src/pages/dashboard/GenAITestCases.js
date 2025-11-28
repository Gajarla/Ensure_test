import PropTypes from 'prop-types';
import * as Yup from 'yup';
import { useSpring, animated } from 'react-spring';
import { useState, useEffect, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios';
// import * as XLSX from 'xlsx';
// import ExcelJS from 'exceljs';
// material
import {
  Button,
  ButtonGroup,
  Container,
  Card,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Box,
  Stack,
  TextField,
  Typography,
  CardContent
} from '@mui/material';
// redux
import { LoadingButton } from '@mui/lab';
import { Form, FormikProvider, useFormik } from 'formik';
import { useSelector, useDispatch } from '../../redux/store';
import { fData } from '../../utils/formatNumber';

// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import { callBackendService, exportToExcel, exportToMergeExcel } from '../../redux/slices/common';
import { HTTP_REQUEST, GEN_AI_INPUT } from '../../Constants';
import STATUS from '../../components/_dashboard/project/ProjectStatus';
import API from '../../services';
import { setProjectList, setFilteredProjectList } from '../../redux/slices/project';
import { getFilteredProjects } from '../../_apis_/project';
import { getCreateModule } from '../../redux/slices/module';
import { setRolesList } from '../../redux/slices/role';
import { PATH_DASHBOARD } from '../../routes/paths';
import { UploadSingleFile } from '../../components/upload';

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

export default function GenAITestCases() {
  const { themeStretch } = useSettings();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useDispatch();
  const { userList, currentUser, appendUrl } = useSelector((state) => state.user);
  const { currentProject, filterProjects } = useSelector((state) => state.project);
  const [download, setDownload] = useState(false);
  const [open, setOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [input, setInput] = useState(GEN_AI_INPUT?.text);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uplaodedFile, setUplaodedFile] = useState(null);
  const [base64IMG, setBase64IMG] = useState(null);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const navigateToLink = (url) => {
    navigate(getUrl(url));
  };

  const handleClickOpen = async () => {
    const projects = await getFilteredProjects(STATUS.UNARCHIVED, currentUser?.company?._id);
    setProjectList(dispatch, projects);
    setFilteredProjectList(dispatch, projects);
    setOpen(true);
    // setFieldValue('projectId', currentProject?._id);
  };

  const handleClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    setRolesList(dispatch, null);
  }, [dispatch]);

  // const regMatch =
  //   '/^((http|https)://)?(www.)?(?!.*(http|https|www.))[a-zA-Z0-9_-]+(.[a-zA-Z]+)+(/)?.([w?[a-zA-Z-_%/@?]+)*([^/w?[a-zA-Z0-9_-]+=w+(&[a-zA-Z0-9_]+=w+)*)?$/';

  const NewRoleConfiguratorSchema = Yup.object().shape({
    // url: Yup.string().matches(regMatch, 'Enter valid URL'),
    url: Yup.string().required('Url is required'),
    inputText: Yup.string().required('Text is required'),
    projectId: Yup.string().required('Project is required')
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      url: '192.168.1.69:8000',
      inputText: '',
      message: ``,
      projectId: currentProject?._id
    },
    validationSchema: NewRoleConfiguratorSchema,
    onSubmit: async (values, { setSubmitting, setErrors }) => {
      try {
        // await createConfig();
        setSubmitting(false);
        const user = userList?.find((user) => user?.email?.toLowerCase() === values?.email?.toLowerCase());
        if (!user) {
          // enqueueSnackbar('Generate success', { variant: 'success' });
          // navigate(PATH_DASHBOARD.user.allUsers);
        }
      } catch (error) {
        setSubmitting(false);
        setErrors(error);
      }
    }
  });

  const { errors, values, touched, handleSubmit, isSubmitting, setFieldValue, getFieldProps } = formik;

  const handleDropFile = useCallback(
    (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        setAvatarUrl({
          ...file,
          preview: URL.createObjectURL(file)
        });
        const fileName = file.name;
        setUploadedFileName(fileName);
        setUplaodedFile(URL.createObjectURL(file));
        const reader = new FileReader();

        reader.readAsDataURL(file);

        reader.onload = () => {
          setBase64IMG(reader.result);
          setFieldValue('inputText', reader.result);
        };
      }
    },
    [setFieldValue]
  );

  const handleReplaceFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png, image/jpg, image/jpeg';
    input.onchange = () => {
      const files = Array.from(input.files);
      handleDropFile(files, []);
    };
    input.click();
  };

  const onFileDelete = useCallback(() => {
    setFieldValue('inputText', '');
    setAvatarUrl('');
    setUplaodedFile(null);
    setUploadedFileName(null);
    setDownload(false);
    setFieldValue('message', '');
  }, [setFieldValue]);

  const handleInputChange = async () => {
    setInput((prevText) => (prevText === GEN_AI_INPUT?.text ? GEN_AI_INPUT.IMAGE : GEN_AI_INPUT?.text));
    setFieldValue('inputText', '');
    setAvatarUrl('');
    setUplaodedFile(null);
    setUploadedFileName(null);
    setDownload(false);
    setFieldValue('message', '');
  };

  const handleGenerateAITestCases = async () => {
    setFieldValue('message', 'Generating test cases. Please wait ...');
    setDownload(false);
    const url = 'http://192.168.0.42:8000';
    const inputText = values?.inputText;
    if (url && inputText) {
      let response = null;
      const data = { inputText: values?.inputText || base64IMG, url, input };
      try {
        response = await callBackendService(HTTP_REQUEST.POST, `${API.testRun.getGenAITestCases}`, data);
      } catch (error) {
        console.log('error', error);
      }
      if (response != null && (response?.data?.msg?.test_cases || response?.data?.msg)) {
        setFieldValue('message', JSON.stringify(response?.data?.msg?.test_cases || response?.data?.msg, null, 2));
        setDownload(true);
        enqueueSnackbar('Test Cases generation success', { variant: 'success' });
      } else if (response != null && response?.data?.msg?.error) {
        setFieldValue('message', response?.data?.msg?.error);
        setDownload(false);
        enqueueSnackbar(response?.data?.msg?.error, { variant: 'error' });
      } else {
        setFieldValue('message', 'Generating test cases failed !!');
        enqueueSnackbar('Test Cases generation Failed', { variant: 'error' });
      }
    } else {
      setFieldValue('message', 'Generating test cases failed !!');
      enqueueSnackbar('Test Cases generation Failed', { variant: 'error' });
    }
  };

  const downloadExcel = () => {
    try {
      let message = JSON.parse(values?.message);
      if (message?.testCases) {
        message = message?.testCases;
      }
      const messages = [];
      let merge = false;
      const mergeCells = [];
      message?.forEach((msg) => {
        if (msg?.steps?.length !== 0) {
          mergeCells.push(msg?.steps.length);
          msg?.steps.forEach((m, index) => {
            const newMsg = {};

            if (m?.step && m?.expected_result) {
              if (index === 0) {
                newMsg.testCaseTitle = msg?.title;
                newMsg.testCaseDescription = msg?.description;
              } else {
                newMsg.testCaseTitle = '';
                newMsg.testCaseDescription = '';
              }
              newMsg.StepNo = index + 1;
              newMsg.testStepDescription = m?.step;
              newMsg.Expected = m?.expected_result;
              messages.push(newMsg);
            } else if (m?.step_number) {
              if (index === 0) {
                newMsg.testCaseTitle = msg?.title;
                newMsg.testCaseDescription = msg?.description;
              } else {
                newMsg.testCaseTitle = '';
                newMsg.testCaseDescription = '';
              }
              newMsg.StepNo = m?.step_number;
              newMsg.testStepDescription = m?.description;
              newMsg.Expected = m?.expected_result;
              messages.push(newMsg);
            } else {
              const stepsObject = msg?.expected_results instanceof Object;
              if (stepsObject && msg?.expected_results.length !== msg?.steps.length) {
                merge = true;
                if (index === 0) {
                  newMsg.testCaseTitle = msg?.title;
                  newMsg.testCaseDescription = msg?.description;
                  if (msg?.expected_results instanceof Object) {
                    let mergeText = '';
                    msg?.expected_results?.forEach((text, index) => {
                      mergeText += `${index + 1}. ${text} \r\n`;
                    });
                    // newMsg.Expected = `${msg?.expected_results.join('\r\n')}`;
                    newMsg.Expected = mergeText;
                  } else newMsg.Expected = msg?.expected_results;
                } else {
                  newMsg.testCaseTitle = '';
                  newMsg.testCaseDescription = '';
                  newMsg.Expected = '';
                }
                newMsg.StepNo = index + 1;
                newMsg.testStepDescription = m;
                messages.push(newMsg);
              } else {
                merge = false;
                if (index === 0) {
                  newMsg.testCaseTitle = msg?.title;
                  newMsg.testCaseDescription = msg?.description;
                } else {
                  newMsg.testCaseTitle = '';
                  newMsg.testCaseDescription = '';
                }
                newMsg.StepNo = index + 1;
                newMsg.testStepDescription = m;

                if (msg?.expected_results) {
                  const stepsObject = msg?.expected_results instanceof Object;
                  if (stepsObject) newMsg.Expected = msg?.expected_results[index];
                  else newMsg.Expected = msg?.expected_results;
                } else if (msg?.expected_result) {
                  const stepsObject = msg?.expected_result instanceof Object;
                  if (stepsObject) newMsg.Expected = msg?.expected_result[index];
                  else newMsg.Expected = msg?.expected_result;
                } else newMsg.Expected = '';
                messages.push(newMsg);
              }
            }
          });
        } else {
          const newMsg = {};
          newMsg.testCaseTitle = msg?.title;
          newMsg.testCaseDescription = msg?.description;
          newMsg.StepNo = ``;
          newMsg.testStepDescription = ``;
          newMsg.Expected = msg?.expected_result;
          messages.push(newMsg);
        }
      });
      const data = [];
      const obj = {};
      obj.sname = 'Sheet1';
      obj.edata = messages;
      data.push(obj);
      if (!merge) exportToExcel(data, false, 'Test_Cases.xlsx', false);
      else exportToMergeExcel(data, false, mergeCells, 'Test_Cases.xlsx');
      // const worksheet = XLSX.utils.json_to_sheet(messages);
      // const workbook = XLSX.utils.book_new();
      // XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      // // let buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      // // XLSX.write(workbook, { bookType: "xlsx", type: "binary" });
      // XLSX.writeFile(workbook, 'Test_Cases.xlsx');
    } catch (error) {
      console.log('error', error);
    }
  };

  const getData = () => {
    let message = JSON.parse(values?.message);
    if (message?.testCases) {
      message = message?.testCases;
    }
    const messages = [];
    const padNumber = (n, l) => `${n}`.padStart(l, '0');

    message?.forEach((msg, index) => {
      const testCaseID = `GEN_AI_${padNumber(parseInt(index + 1, 10), 3)}`;
      if (msg?.steps?.length !== 0) {
        msg?.steps.forEach((m, index) => {
          const newMsg = {};

          if (m?.step && m?.expected_result) {
            if (index === 0) {
              newMsg.testCaseID = testCaseID;
              newMsg.dependsOn = '';
              newMsg.testCaseTitle = msg?.title;
              newMsg.testCaseDescription = msg?.description;
            } else {
              newMsg.testCaseID = '';
              newMsg.dependsOn = '';
              newMsg.testCaseTitle = '';
              newMsg.testCaseDescription = '';
            }
            newMsg.StepNo = index + 1;
            newMsg.testStepDescription = m?.step;
            newMsg.Expected = m?.expected_result;
            messages.push(newMsg);
          } else if (m?.step_number) {
            if (index === 0) {
              newMsg.testCaseID = testCaseID;
              newMsg.dependsOn = '';
              newMsg.testCaseTitle = msg?.title;
              newMsg.testCaseDescription = msg?.description;
            } else {
              newMsg.testCaseID = '';
              newMsg.dependsOn = '';
              newMsg.testCaseTitle = '';
              newMsg.testCaseDescription = '';
            }
            newMsg.StepNo = m?.step_number;
            newMsg.testStepDescription = m?.description;
            newMsg.Expected = m?.expected_result;
            messages.push(newMsg);
          } else {
            if (index === 0) {
              newMsg.testCaseID = testCaseID;
              newMsg.dependsOn = '';
              newMsg.testCaseTitle = msg?.title;
              newMsg.testCaseDescription = msg?.description;
            } else {
              newMsg.testCaseID = '';
              newMsg.dependsOn = '';
              newMsg.testCaseTitle = '';
              newMsg.testCaseDescription = '';
            }
            newMsg.StepNo = index + 1;
            newMsg.testStepDescription = m;
            if (msg?.expected_results) {
              const stepsObject = msg?.expected_results instanceof Object;
              if (stepsObject) newMsg.Expected = msg?.expected_results[index];
              else newMsg.Expected = msg?.expected_results;
            } else if (msg?.expected_result) {
              const stepsObject = msg?.expected_result instanceof Object;
              if (stepsObject) newMsg.Expected = msg?.expected_result[index];
              else newMsg.Expected = msg?.expected_result;
            } else newMsg.Expected = '';
            messages.push(newMsg);
            // }
          }
        });
      } else {
        const newMsg = {};
        newMsg.testCaseID = testCaseID;
        newMsg.dependsOn = '';
        newMsg.testCaseTitle = msg?.title;
        newMsg.testCaseDescription = msg?.description;
        newMsg.StepNo = ``;
        newMsg.testStepDescription = ``;
        newMsg.Expected = msg?.expected_result;
        messages.push(newMsg);
      }
    });

    return messages;
  };

  const downloadManualFile = () => {
    try {
      const data = [];
      const obj = {};
      obj.sname = 'Gen AI Test Cases';
      obj.edata = getData();
      data.push(obj);
      exportToExcel(data, false, 'Test_Cases.xlsx', true);
    } catch (error) {
      console.log('error', error);
    }
  };

  // const handleProjectNameChange = async (event) => {
  //   console.log('value', event);
  //   // setFieldValue('projectId', id);
  // };

  const handleCreateModuleClick = async () => {
    try {
      const data = getData();
      const formData = {};
      formData.projectID = values.projectId;
      formData.company = currentUser?.company?._id;
      formData.suiteName = 'GenAITestCases';
      formData.suiteDescription = 'Gen AI Test Cases';
      const testNodes = [];
      let testNode = {};
      let testSteps = [];
      data?.forEach((row, index) => {
        if (row.testCaseID) {
          testNode.testCaseSteps = testSteps;
          if (index !== 0) testNodes.push({ testNode });
          testNode = {};
          testSteps = [];
          testNode.testCaseID = row.testCaseID;
          testNode.testCaseTitle = row.testCaseTitle;
          testNode.dependsOn = 'manual';
          testNode.testCaseDescription = row.testCaseDescription;
          const manualStep = {};
          manualStep.testStepDescription = row.testStepDescription;
          manualStep.expected = row.Expected || '';
          testSteps.push(manualStep);
        } else {
          const manualStep = {};
          manualStep.testStepDescription = row.testStepDescription;
          manualStep.expected = row.Expected || '';
          testSteps.push(manualStep);
        }
      });
      testNode.testCaseSteps = testSteps;
      testNodes.push({ testNode });
      formData.testNodes = testNodes;
      formData.testPlaceholders = [];
      const response = await getCreateModule(dispatch, formData);
      if (!response?.errors) {
        enqueueSnackbar('Module created successfully', { variant: 'success' });
        if (values.projectId === currentProject?._id) navigateToLink(PATH_DASHBOARD.module.allModules);
      } else {
        enqueueSnackbar('Module creation failed', { variant: 'error' });
      }
    } catch (error) {
      console.log('error', error);
    }
  };

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading="Gen AI Test Cases"
          links={[{ name: 'Test Cases' }]}
          info="Get AI generated test cases"
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
              style={{ height: '700px' }}
            >
              {/* <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                <TextField
                  fullWidth
                  label="Url"
                  InputLabelProps={{ shrink: true }}
                  // value="192.168.1.69:8000"
                  {...getFieldProps('url')}
                  SelectProps={{ native: true }}
                  error={Boolean(touched.url && errors.url)}
                  helperText={touched.url && errors.url}
                />
              </Stack> */}

              <Stack direction="column">
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  style={{ width: '100%', display: 'ruby', textAlign: 'center' }}
                >
                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <ButtonGroup variant="contained" aria-label="Basic button group">
                      {Object.keys(GEN_AI_INPUT)?.map((key) => (
                        <Button
                          key={key}
                          variant={input?.toLowerCase() === key?.toLowerCase() ? 'contained' : 'outlined'}
                          onClick={handleInputChange}
                        >
                          {key?.toLowerCase()}
                        </Button>
                      ))}
                    </ButtonGroup>
                    {/* <LoadingButton
                      type="submit"
                      variant="contained"
                      loading={isSubmitting}
                      value={input === GEN_AI_INPUT?.text ? GEN_AI_INPUT.IMAGE : GEN_AI_INPUT?.text}
                      onClick={handleInputChange}
                      style={{ width: '80px' }}
                    >
                      {input === GEN_AI_INPUT?.text ? GEN_AI_INPUT.IMAGE : GEN_AI_INPUT?.text}
                    </LoadingButton> */}
                  </Box>
                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <LoadingButton
                      type="submit"
                      variant="contained"
                      loading={isSubmitting}
                      onClick={handleGenerateAITestCases}
                      disabled={!values.inputText}
                    >
                      Generate
                    </LoadingButton>
                  </Box>

                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <LoadingButton
                      type="submit"
                      variant="contained"
                      loading={isSubmitting}
                      disabled={!download}
                      onClick={downloadExcel}
                    >
                      Download
                    </LoadingButton>
                  </Box>

                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <LoadingButton
                      type="submit"
                      variant="contained"
                      loading={isSubmitting}
                      disabled={!download}
                      onClick={downloadManualFile}
                    >
                      Download Uploadable File
                    </LoadingButton>
                  </Box>

                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <LoadingButton
                      type="submit"
                      variant="contained"
                      loading={isSubmitting}
                      disabled={!download}
                      onClick={handleClickOpen}
                    >
                      Create Module
                    </LoadingButton>
                    <Dialog
                      open={open}
                      onClose={handleClose}
                      aria-labelledby="alert-dialog-title"
                      aria-describedby="alert-dialog-description"
                    >
                      <DialogTitle id="alert-dialog-title">Select Project to create Module</DialogTitle>
                      <DialogContent>
                        <DialogContentText id="alert-dialog-description">
                          <br />
                          <br />
                          <br />
                          <Stack>
                            <TextField
                              select
                              fullWidth
                              size="small"
                              label="Project"
                              value={values.projectId || currentProject?._id}
                              placeholder="Select Automation Project"
                              // id="projectId"
                              // onChange={handleProjectNameChange}
                              {...getFieldProps('projectId')}
                              SelectProps={{ native: true }}
                              error={Boolean(touched.projectId && errors.projectId)}
                              helperText={touched.projectId && errors.projectId}
                            >
                              <option value="" />
                              {filterProjects &&
                                filterProjects?.map((project) => (
                                  <option key={project._id} value={project._id}>
                                    {project.name}
                                  </option>
                                ))}
                            </TextField>
                          </Stack>

                          <br />
                        </DialogContentText>
                      </DialogContent>
                      <DialogActions>
                        <Button onClick={handleClose}>Disagree</Button>
                        <Button
                          onClick={() => {
                            handleClose();
                            handleCreateModuleClick();
                            // onDelete();
                          }}
                          autoFocus
                        >
                          Agree
                        </Button>
                      </DialogActions>
                    </Dialog>
                  </Box>
                </Stack>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 2 }}>
                <Stack style={{ paddingTop: '20px', width: '50%' }}>
                  {input === GEN_AI_INPUT?.text && (
                    <TextField
                      multiline
                      label="Input Text"
                      placeholder="Give your inputs ..."
                      {...getFieldProps('inputText')}
                      minRows={20}
                      maxRows={20}
                      style={{
                        height: '300px',
                        fontFamily: "'Public Sans', sans-serif",
                        fontSize: '0.7rem',
                        fontWeight: '400',
                        lineHeight: '1.5'
                      }}
                      SelectProps={{ native: true }}
                      error={Boolean(touched.inputText && errors.inputText)}
                      helperText={touched.inputText && errors.inputText}
                    />
                  )}

                  {input === GEN_AI_INPUT.IMAGE && (
                    <CardContent
                      style={{
                        boxSizing: 'border-box',
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        scrollbarWidth: 'none',
                        // resize: 'vertical',
                        color: '#1C2025',
                        border: '1px solid #DAE2ED',
                        boxShadow: '0px 2px 2px #F3F6F9',
                        overflowY: 'scroll',
                        height: '490px'
                      }}
                    >
                      <UploadSingleFile
                        file={avatarUrl}
                        accept="image/png, image/jpg, image/jpeg"
                        fileName={uploadedFileName}
                        onDrop={handleDropFile}
                        onReplace={handleReplaceFile}
                        onDelete={onFileDelete}
                      />
                      <Stack direction="row">
                        {/* <UploadAvatar accept="image/*" file={avatarUrl} onDrop={handleDropAvatar} /> */}
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
                          Allowed *.jpeg, *.jpg, *.png
                          <br /> max size of {fData(3145728)}
                        </Typography>
                      </Stack>
                      {uplaodedFile && (
                        <Stack>
                          <div>
                            <img style={{ paddingTop: '5%' }} alt="Uploaded file" src={uplaodedFile} />
                          </div>
                        </Stack>
                      )}
                    </CardContent>
                  )}
                </Stack>
                <Stack style={{ paddingTop: '25%' }}>
                  {/* <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <LoadingButton
                      type="submit"
                      variant="contained"
                      loading={isSubmitting}
                      onClick={handleGenerateAITestCases}
                    >
                      Generate
                    </LoadingButton>
                  </Box> */}

                  {/* {download && (
                    <>
                      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                        <LoadingButton type="submit" variant="contained" loading={isSubmitting} onClick={downloadExcel}>
                          Download
                        </LoadingButton>
                      </Box>
                      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                        <LoadingButton type="submit" variant="contained" loading={isSubmitting} onClick={downloadExcel}>
                          Download Uploadable File
                        </LoadingButton>
                      </Box>
                    </>
                  )} */}
                </Stack>
                <Stack style={{ paddingTop: '20px', width: '50%' }}>
                  {/* <TextField
                    multiline
                    disabled
                    name="message"
                    {...getFieldProps('message')}
                    placeholder="AI generated Test Cases ..."
                    minRows={20}
                    maxRows={50}
                    style={{ height: '300px', overflowY: 'scroll', scrollbarWidth: 'none' }}
                  /> */}
                  <div
                    // minRows={3}
                    // maxRows={8}
                    style={{
                      boxSizing: 'border-box',
                      width: '100%',
                      fontFamily: "'Public Sans', sans-serif",
                      fontSize: '0.9rem',
                      fontWeight: '400',
                      lineHeight: '1.5',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      scrollbarWidth: 'none',
                      wordWrap: 'unset',
                      // resize: 'vertical',
                      color: '#1C2025',
                      background: '#fff',
                      border: '1px solid #DAE2ED',
                      boxShadow: '0px 2px 2px #F3F6F9',
                      overflowY: 'scroll',
                      height: '490px'
                    }}
                  >
                    <pre>{values?.message}</pre>
                  </div>
                </Stack>
              </Stack>
            </Card>
          </Form>
        </FormikProvider>
      </Container>
    </Page>
  );
}
