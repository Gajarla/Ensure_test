import * as Yup from 'yup';
import PropTypes from 'prop-types';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { Form, FormikProvider, useFormik } from 'formik';
import * as XLSX from 'xlsx';
// material
import { Icon } from '@iconify/react';
import editFill from '@iconify/icons-eva/edit-fill';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Card,
  CardHeader,
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogActions,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer
} from '@mui/material';
// utils
import { useState, useCallback, useEffect } from 'react';
import SampleTemplate from '../../../SampleTemplate.xlsx';
import Scrollbar from '../../Scrollbar';
// routes
import { PATH_DASHBOARD } from '../../../routes/paths';
import { UploadSingleFile } from '../../upload';
import { useDispatch, useSelector } from '../../../redux/store';
import { getTestCaseSteps } from '../../../_apis_/project';

import { getCreateModule, getParseTestCases, setJsonData, getValidations } from '../../../redux/slices/module';

import { getModuleList } from '../../../_apis_/module';
import { MODULE_VALIDATIONS } from '../../../Constants';

// ----------------------------------------------------------------------

ModuleNewForm.propTypes = {
  isEdit: PropTypes.bool,
  currentModule: PropTypes.object
};

let totalProps = [];
const MODULE_TYPES = [
  {
    value: 'manual',
    label: 'Manual'
  },
  {
    value: 'automated',
    label: 'Automated'
  }
  // {
  //   value: 'jsonBuilder',
  //   label: 'Create Scenario - Studio'
  // }
];

const FILE_TYPE = { JSON: 'JSON', TEST_DATA: 'TEST_DATA', MANUAL: 'MANUAL' };

const ACCEPT_JSON = { 'application/json': ['.json'] };

const ACCEPT_EXCEL = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/octet-stream': ['.xls', '.xlsx'] // fallback type some browsers use
};

export default function ModuleNewForm({ isEdit, currentModule }) {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useDispatch();
  const { currentUser, appendUrl } = useSelector((state) => state.user);
  const { currentProject } = useSelector((state) => state.project);
  const { jsonData, moduleList, validations } = useSelector((state) => state.module);
  const [openUploadTestData, setOpenUploadTestData] = useState(false);
  const [executionFile, setExecutionFile] = useState(null);
  const [executionFileName, setExecutionFileName] = useState('');
  const [testDataFile, setTestDataFile] = useState(null);
  const [testDataFileName, setTestDataFileName] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [extractedTestData, setExtractedTestData] = useState();
  const [automationStatus, setAutomationStatus] = useState(true);
  const [json, setJson] = useState();
  const [moduleType, setModuleType] = useState('automated');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [testDataToEdit, setTestDataToEdit] = useState({});
  const [updatedTestData, setUpdatedTestData] = useState();
  const [errorMessage, setErrorMessage] = useState();
  const [errorDetail, setErrorDetail] = useState();
  const [isInValid, setIsInValid] = useState(true);
  const [errorPopup, setErrorPopup] = useState(false);

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

  const NewModuleSchema = Yup.object().shape({
    // name: Yup.string().required('Project Name is required')
  });

  const handleChangeModuleType = (event) => {
    setModuleType(event.target.value);
    setJsonData(dispatch, null);
    setExecutionFile(null);
    setExecutionFileName(null);
    setTestDataFile(null);
    setTestDataFileName(null);
    setMessage('');
    setMessages([]);
    if (event.target.value === 'jsonBuilder') {
      openJsonBuilderApp();
    }
  };

  const openJsonBuilderApp = async () => {
    try {
      const token = localStorage.getItem('accessToken');

      const filteredUser = { ...currentUser };
      delete filteredUser.avatarUrl;
      delete filteredUser.createdAt;
      delete filteredUser.defecttrack;
      delete filteredUser.projectsRoles;
      delete filteredUser.createdBy;
      delete filteredUser.isSSO;
      delete filteredUser.updatedAt;
      delete filteredUser.updatedBy;

      const encodedUser = encodeURIComponent(btoa(JSON.stringify(filteredUser)));
      const protocolURL = `testensure://open?user=${encodedUser}&userId=${currentUser._id}&projectId=${currentProject?._id}&token=${token}`;
      const fallbackDownloadURL = `${process.env.REACT_APP_API_BASE_URL}/api/releases/v1/download/${currentUser?._id}/TestEnsure%20Studio.zip?bypass=true`;

      console.log('🔗 Trying to open app with URL:', protocolURL);
      console.log('⬇️ Fallback download URL:', fallbackDownloadURL);

      // Step 1: Try to open the app
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = protocolURL;
      document.body.appendChild(iframe);

      // Step 2: After delay, ask user if it worked
      setTimeout(() => {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }

        const confirmed = window.confirm(
          'Did the TestEnsure JSON Builder app open successfully? Click "Cancel" to download it.'
        );
        if (!confirmed) {
          // Trigger fallback download
          const a = document.createElement('a');
          a.href = fallbackDownloadURL;
          a.download = '';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          console.log('✅ User confirmed the app opened. No download needed.');
        }
      }, 5000); // Give the app 3 seconds to open
    } catch (error) {
      console.error('💥 Error while trying to open app or download file:', error);
    }
  };

  const extractDataFromJson = useCallback(
    (json) => {
      let testCasesCount = 0;
      let testStepsCount = 0;
      let testCaseTags = [];
      if (json && 'testCases' in json) {
        const { testCases } = json;
        if (Array.isArray(testCases)) {
          testCasesCount = testCases.length;
          testCases.forEach((testCase) => {
            const testNode = testCase.testNode ? testCase.testNode : testCase;
            if ('testCaseSteps' in testNode) {
              const { testCaseSteps, tags } = testNode;
              if (tags) testCaseTags.push(...tags);
              if (testCaseSteps && Array.isArray(testCaseSteps)) {
                testStepsCount += testCaseSteps.length;
              }
            }
            testNode.automationStatus = true;
          });
        }
      }
      testCaseTags = [...new Set(testCaseTags)];
      if (json) {
        json.testCasesCount = testCasesCount;
        json.testStepsCount = testStepsCount;
        setJsonData(dispatch, json);
      }
    },
    [dispatch]
  );

  const onExecutionFileDelete = useCallback(() => {
    setMessage('');
    setMessages([]);
    setExecutionFile(null);
    setExecutionFileName(null);
    setAutomationStatus(true);
    setJsonData(dispatch, null);
    setErrorPopup(false);
    setIsInValid(true);
    totalProps = [];
  }, [dispatch]);

  function detectCircularReferences(obj) {
    function hasCycle(key, seen) {
      if (!obj[key]) return false; // No reference, end of chain
      if (seen.has(key)) return true; // Cycle detected
      seen.add(key); // Mark current key as visited
      return hasCycle(obj[key], seen); // Recursively check the next key
    }

    const circularKeys = new Set();

    Object.keys(obj).forEach((key) => {
      const visited = new Set();
      if (hasCycle(key, visited)) {
        circularKeys.add(key);
      }
    });

    return Array.from(circularKeys);
  }

  function getOrdinalNumber(n) {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  }

  const handleDropSingleFile = useCallback(
    async (acceptedFiles, rejectedFiles) => {
      try {
        if (rejectedFiles.length === 0) {
          const messages = [];
          setMessage('');
          setMessages(messages);
          const file = acceptedFiles[0];
          if (file) {
            setExecutionFile({ ...file, preview: URL.createObjectURL(file) });
            const fileName = file.name;
            setExecutionFileName(fileName);
            if (fileName.includes('.json') || fileName.includes('.xls') || fileName.includes('.xlsx')) {
              const reader = new FileReader();
              reader.readAsText(file);
              reader.onload = async (e) => {
                if (fileName.includes('.json')) {
                  setAutomationStatus(true);
                  const text = e.target.result;

                  if (!text) {
                    setErrorMessage('Empty File Uploaded');
                    setErrorDetail('Please upload valid Execution file');
                    setIsInValid(true);
                    setErrorPopup(true);
                    setExecutionFile(null);
                    setExecutionFileName(null);
                    setAutomationStatus(true);
                    setJsonData(dispatch, null);
                  } else if (!text.includes('dependsOn')) {
                    setErrorMessage('You have uploaded Invalid JSON. Please try uploading valid JSON');
                    setErrorDetail('Please upload valid Execution file');
                    setIsInValid(true);
                    setErrorPopup(true);
                    setExecutionFile(null);
                    setExecutionFileName(null);
                    setAutomationStatus(true);
                    setJsonData(dispatch, null);
                  } else {
                    try {
                      // setTotalProps([]);

                      totalProps = [];
                      setExtractedTestData(null);
                      setTestDataFile(null);
                      setTestDataFileName(null);
                      let json = JSON.parse(text);
                      const { suiteName } = json;
                      let methodsFound = true;
                      let suiteNameFound = false;

                      const { generatedSuiteNames } = currentProject;

                      const { testCases } = json;
                      const testCaseIds = [];
                      const dependsOnIds = [];
                      const obj = {};

                      const moduleValidations = validations?.ModuleValidate;

                      const { testNodeProps, validNavActions, validValidateActions } =
                        moduleValidations?.executionDataRules;

                      testCases?.forEach((testCase, index) => {
                        const { testNode } = testCase;
                        const { testCaseID, dependsOn, testCaseSteps } = testNode;
                        if (testCaseID) testCaseIds.push(testCaseID);
                        if (dependsOn) dependsOnIds.push(dependsOn);
                        obj[testCaseID] = dependsOn;
                        const missing = [];
                        let unknownActions = [];
                        testNodeProps?.forEach((testNodeProp) => {
                          if (
                            !testNode[testNodeProp] &&
                            !(testNodeProp === 'dependsOn' && testNode[testNodeProp] === '' && index === 0)
                          ) {
                            missing.push(testNodeProp);
                          }

                          testCaseSteps?.forEach((testCaseStep) => {
                            const action = Object.keys(testCaseStep)[0];
                            if (action !== MODULE_VALIDATIONS.VALIDATE && !validNavActions.includes(action)) {
                              unknownActions.push(action);
                            } else if (action === MODULE_VALIDATIONS.VALIDATE) {
                              const validateAction = Object.keys(testCaseStep[action][0])[0];
                              if (!validValidateActions.includes(validateAction)) unknownActions.push(validateAction);
                            }
                          });
                        });
                        if (missing?.length !== 0) {
                          if (testCaseID) messages.push(`${missing} missing in test case - [${testCaseID}]`);
                          else messages.push(`${missing} missing in ${getOrdinalNumber(index + 1)} test case `);
                        }
                        unknownActions = [...new Set(unknownActions)];
                        if (unknownActions?.length !== 0) {
                          if (testCaseID)
                            messages.push(`Unknown ${unknownActions} action in test case - [${testCaseID}]`);
                          else
                            messages.push(
                              `Unknown ${unknownActions} action in ${getOrdinalNumber(index + 1)} test case `
                            );
                        }
                      });

                      const testCaseCycles = detectCircularReferences(obj);

                      const difference = dependsOnIds.filter((x) => !testCaseIds.includes(x));
                      const index = difference.indexOf('');
                      if (index > -1) difference.splice(index, 1);

                      if (difference?.length > 0) messages.push(`Unknown test case ids in dependsOn [${difference}]`);
                      if (testCaseCycles?.length > 0)
                        messages.push(`Issue with test cases dependencies [${testCaseCycles}]`);

                      if (generatedSuiteNames && generatedSuiteNames.length !== 0) {
                        currentProject?.generatedSuiteNames?.forEach((sName) => {
                          if (suiteName.includes(sName)) {
                            suiteNameFound = true;
                          }
                        });
                      } else suiteNameFound = true;

                      if (!suiteNameFound) messages.push(`Suite [${suiteName}] is not applicable for current project`);

                      if (text.includes('"module"')) {
                        // let { testCaseSteps } = currentProject;

                        // if (
                        //   !testCaseSteps ||
                        //   (Object.keys(testCaseSteps)?.length === 1 && Object.keys(testCaseSteps)?.includes('_id'))
                        // )
                        const testCaseSteps = await getTestCaseSteps(currentUser?.company?._id, currentProject?._id);

                        if (testCaseSteps?.length === 0) {
                          messages.push('No methods found for Project');
                          methodsFound = false;
                        } else if (testCaseSteps) {
                          const keys = testCaseSteps?.map((testCaseStep) => testCaseStep.name);
                          const { testCases } = json;
                          const methods = [];
                          testCases?.forEach((testCase) => {
                            const testSteps = testCase.testNode?.testCaseSteps;
                            testSteps?.forEach((testStep) => {
                              if (Object.keys(testStep).includes('module')) {
                                const key = Object.keys(testStep.module);
                                if (!keys.includes(testStep?.module[key[0]]?.methodName)) {
                                  methods.push(`${testStep?.module[key[0]]?.methodName}`);
                                  methodsFound = false;
                                } else {
                                  const methodName = testStep?.module[key[0]]?.methodName;
                                  const methodJson = testCaseSteps?.filter(
                                    (testCaseStep) => testCaseStep.name === methodName
                                  );
                                  if (methodJson && JSON.stringify(methodJson[0])?.includes('$')) {
                                    setOpenUploadTestData(true);
                                  }
                                }
                              }
                            });
                            if (methods?.length === 1)
                              messages.push(`[${methods.toString()}] method is not found for Project`);
                            else if (methods?.length >= 1)
                              messages.push(`[${methods.toString()}] methods are not found for Project`);
                          });
                        }
                      }
                      setExecutionFileName(json.suiteName);

                      const modules = moduleList;
                      const module =
                        moduleList?.find((module) => module.suiteName === json.suiteName) ||
                        modules?.find((module) => module.suiteName === json.suiteName);

                      // if (isValid) {
                      setJson(json);
                      if (typeof json === 'object' && 'result' in json) {
                        json = json.result;
                        setJson(json);
                      }

                      extractDataFromJson(json);

                      if (text.includes('$') && methodsFound && suiteNameFound) {
                        setOpenUploadTestData(true);
                      } else if (!text.includes('$')) {
                        setIsInValid(false);
                      } else {
                        setOpenUploadTestData(false);
                      }

                      if (module && !isEdit) {
                        setOpen(true);
                        setOpenUploadTestData(false);
                      } else if (!module && isEdit) {
                        messages.push("Suite name doesn't match");
                        setOpenUploadTestData(false);
                      }
                      if (messages?.length > 0) {
                        setOpen(false);
                        setOpenUploadTestData(false);
                      }
                      setMessages([...new Set(messages)]);
                      // }
                    } catch (err) {
                      onExecutionFileDelete();
                      console.log('err', err);
                      setMessage('You have uploaded Invalid JSON. Please try uploading valid JSON');
                    }
                  }
                } else if (fileName.includes('.xls') || fileName.includes('.xlsx')) {
                  const reader = new FileReader();
                  reader.readAsText(acceptedFiles[0]);
                  reader.onload = async () => {
                    const f = await file.arrayBuffer();
                    const wb = XLSX.read(f, { type: 'array' }); // specify type as 'array' when reading ArrayBuffer
                    const ws = wb.Sheets[wb.SheetNames[0]]; // get the first worksheet
                    const manualUploadFile = XLSX.utils.sheet_to_json(ws);
                    setExecutionFileName(manualUploadFile[0]['Suite Name']);
                    const suitName = manualUploadFile[0]['Suite Name'];
                    const module = moduleList.find((module) => module.suiteName === suitName);

                    if (module && !isEdit) setOpen(true);
                  };

                  /* logic for replace manual module conformation starts */

                  setAutomationStatus(false);
                  const formData = new FormData();
                  formData.append('file', file);
                  const error = await getParseTestCases(dispatch, formData);
                  if (error) {
                    setMessage('The file could not be processed. Please download the template and try again');
                    setMessages([]);
                    setExecutionFile(null);
                    setExecutionFileName(null);
                    setAutomationStatus(true);
                    setJsonData(dispatch, null);
                    setErrorPopup(false);
                    setIsInValid(true);
                    totalProps = [];
                  } else setIsInValid(false);
                }
              };
            } else {
              // setOpenMessage(true);
              setMessage('Module type should be JSON or Excel');
            }
          }
        } else {
          const file = rejectedFiles[0].file.path;
          if (file.includes('xlsx')) setMessage('For Automated execution JSON file is expected');
          else setMessage('For Manual execution Excel file is expected');
        }
      } catch (err) {
        console.log('err', err);
      }
    },
    [dispatch, currentProject, extractDataFromJson, isEdit, moduleList, onExecutionFileDelete, validations]
  );

  const navigateToEditModule = () => {
    const module = moduleList?.find((module) => module.suiteName === executionFileName);
    navigateToLink(PATH_DASHBOARD.module.editById(module?._id));
    setOpenUploadTestData(true);
  };

  const onTestDataFileDelete = () => {
    setMessage('');
    setMessages([]);
    setTestDataFile(null);
    setTestDataFileName(null);
    setExtractedTestData(null);
    setErrorPopup(false);
    setIsInValid(true);
    totalProps = [];
  };

  const isSingleRow = (testData) => {
    if (testData[0]) {
      return Object.keys(testData[0])[0] === 'key';
    }
    return null;
  };

  const prepareTestData = (testData) => {
    const testCases = [];
    const testCase = {};
    testData.forEach((member) => {
      const key = member?.key;
      const value = member?.value;
      testCase[key] = value;
    });
    testCases.push(testCase);
    return testCases;
  };
  const handleDropTestData = useCallback((acceptedFiles, rejectedFiles) => {
    try {
      let isValid;
      if (rejectedFiles.length === 0) {
        const file = acceptedFiles[0];
        if (file) {
          setTestDataFile({ ...file, preview: URL.createObjectURL(file) });
          const fileName = file.name;
          console.log('fileName', fileName);
          setTestDataFileName(fileName);
          if (fileName.includes('.xls') || fileName.includes('.xlsx')) {
            const reader = new FileReader();
            reader.readAsText(acceptedFiles[0]);
            reader.onload = async () => {
              const f = await file.arrayBuffer();
              const wb = XLSX.read(f, { type: 'array' });
              const ws = wb.Sheets[wb.SheetNames[0]]; // get the first worksheet
              const testData = XLSX.utils.sheet_to_json(ws);
              if (!testData || testData?.length === 0) {
                setErrorMessage('Empty File Uploaded');
                setErrorDetail('Please upload valid Test data file');
                setIsInValid(true);
                setErrorPopup(true);
              } else {
                isValid = true;
                setIsInValid(false);
              }
              if (isValid) {
                const isSingle = isSingleRow(testData);
                if (isSingle) {
                  const updatedTestData = prepareTestData(testData);
                  setExtractedTestData({ fileName, data: updatedTestData });
                } else {
                  setExtractedTestData({ fileName, data: testData });
                }
              }
            };
          } else {
            setMessage('Test Data File type should be JSON or Excel');
          }
        } else {
          setTestDataFileName(null);
        }
      } else {
        setMessage('For Test Data upload Excel File is expected');
      }
    } catch (err) {
      console.log('err', err);
    }
  }, []);

  const handleReplaceFile = (type, fileType) => {
    setMessage('');
    setMessages([]);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type;
    if (fileType === FILE_TYPE.JSON) input.accept = 'application/json';
    if (fileType === FILE_TYPE.TEST_DATA || fileType === FILE_TYPE.MANUAL)
      input.accept =
        '.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel';
    input.onchange = () => {
      const files = Array.from(input.files);
      if (fileType === FILE_TYPE.JSON || fileType === FILE_TYPE.MANUAL) handleDropSingleFile(files, []);
      if (fileType === FILE_TYPE.TEST_DATA)
        handleDropTestData(
          files,
          []
        ); /* if (type === 'application/json') { handleDropSuiteJson(files); } else { handleDropTestCase(files); } */
    };
    input.click();
  };

  const createModule = async () => {
    const testData = [];
    if (automationStatus) {
      extractedTestData?.data?.map((testCaseData) => {
        testData.push(testCaseData);
        return null;
      });
    }
    const formData = {
      projectID: currentProject._id,
      suiteName: automationStatus ? json?.suiteName : jsonData.suiteName,
      businessProcess: automationStatus ? json?.businessProcess : jsonData.businessProcess,
      suiteDescription: automationStatus ? json?.suiteDescription : jsonData.suiteDescription,
      testNodes: automationStatus ? json?.testCases : jsonData.testCases,
      testPlaceholders: automationStatus ? testData : [],
      createdBy: currentUser?._id,
      automationStatus,
      email: currentUser.email,
      company: currentUser.company._id
    };

    const module = moduleList.find((module) => module.suiteName === formData.suiteName);
    let response = null;
    if (!module) response = await getCreateModule(dispatch, formData);
    // else getUpdateModule(dispatch, formData, module._id);
    else response = await getCreateModule(dispatch, formData);
    if (!response?.errors) {
      enqueueSnackbar(!isEdit ? 'Module created successfully' : 'Module changes saved', { variant: 'success' });
      navigateToLink(PATH_DASHBOARD.module.allModules);
    } else {
      const errors = response?.errors;
      const msgs = [];
      errors?.forEach((error) => {
        const values = error.split('.');

        const { testCases } = jsonData;

        try {
          let msg = '';
          if (error.includes('.'))
            msg = `${values[4]} validation failed for [${testCases[values[1]]?.testNode?.testCaseID}]`;
          else msg = `${error} validation failed`;
          msgs.push(msg);
        } catch (err) {
          console.log('err', err);
        }
      });
      setMessages(msgs);
      enqueueSnackbar('Module creation failed due to validations', { variant: 'error' });
    }
  };

  const handleEditClose = () => {
    setEdit(false);
  };

  const handleEdit = (testData, index) => {
    setTestDataToEdit({ testData, index });
  };

  const saveTestData = (e) => {
    e.preventDefault();
    const $extractedTestData = [...extractedTestData?.data];
    $extractedTestData[updatedTestData?.index] = updatedTestData?.testData;
    setExtractedTestData({ ...extractedTestData, data: $extractedTestData });
  };

  const handleEditTestData = async (e) => {
    const { name, value } = e.target;
    const $testData = { ...testDataToEdit?.testData };
    $testData[name] = value;
    setUpdatedTestData({ index: testDataToEdit?.index, testData: $testData });
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: currentModule?.name || '',
      description: currentModule?.description || '',
      status: currentModule?.status || false,
      globalValue: currentModule?.globalValue || false,
      users: currentModule?.users || []
    },
    validationSchema: NewModuleSchema,
    onSubmit: async (values, { setSubmitting, setErrors }) => {
      try {
        createModule();
        // getModuleList()
        setSubmitting(false);
      } catch (error) {
        console.error(error);
        setSubmitting(false);
        setErrors(error);
      }
    }
  });

  const { handleSubmit, isSubmitting } = formik;

  const processStep = useCallback((stepSource) => {
    if (stepSource) {
      let step;
      if (typeof stepSource === 'string') {
        step = stepSource;
      } else if (Object(stepSource) && !(stepSource === null)) {
        [step] = Object.values(stepSource);
      } else {
        step = stepSource;
      }
      if (step) {
        if (Array.isArray(step)) {
          step.forEach((prop) => {
            if (prop) {
              processStep(prop);
            }
          });
        } else if (typeof step === 'string') {
          if (step.startsWith('$')) {
            totalProps.push(step);
          }
        } else if (Object(step) && !(step === null)) {
          const stepValues = Object.values(step).filter((step) => step);

          stepValues.forEach((stepValue) => {
            if (stepValue) {
              processStep(stepValue);
            }
          });
        }
      }
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setJsonData(dispatch, null);
      setExtractedTestData(null);
      getValidations(dispatch);
    };
    initialize();
  }, [dispatch]);

  return (
    <>
      <FormikProvider value={formik}>
        <Form noValidate autoComplete="off" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={12}>
              <Card sx={{ p: 3 }}>
                <Stack spacing={3}>
                  <Stack direction="row" alignItems="center">
                    <Typography variant="subtitle1" sx={{ mt: 0.5 }}>
                      Please select the type of module you wish to import :
                    </Typography>
                    <TextField
                      select
                      size="small"
                      value={moduleType}
                      onChange={handleChangeModuleType}
                      SelectProps={{ native: true }}
                      FormHelperTextProps={{
                        sx: {
                          textAlign: 'right',
                          margin: 0,
                          mt: 1
                        }
                      }}
                      sx={{ p: '0 24px' }}
                    >
                      {MODULE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </TextField>
                  </Stack>
                  <Typography variant="subtitle2" sx={{ color: 'text.error' }}>
                    {messages?.length === 0 && message}
                    {messages?.length > 0 && messages?.map((msg) => <p key={msg}>{msg}</p>)}
                  </Typography>
                  {moduleType === 'manual' && (
                    <Stack spacing={2} sx={{ width: 1 }}>
                      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                        Import Manual Module
                      </Typography>
                      <Stack direction="row" sx={{ width: 1, mt: '5px !important' }}>
                        <Typography variant="subtitle2" sx={{ color: 'text?.primary' }}>
                          If you want to import your test cases in a spreadsheet :
                        </Typography>
                        <Typography variant="subtitle2" sx={{ color: 'text?.primary', paddingLeft: 1 }}>
                          <a href={SampleTemplate} download="Sample-Template" target="_blank" rel="noreferrer">
                            Download this Template
                          </a>
                        </Typography>
                      </Stack>
                      <Stack spacing={2}>
                        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                          Test Cases File
                        </Typography>
                      </Stack>
                      <Grid item xs={12} md={4}>
                        <UploadSingleFile
                          file={executionFile}
                          fileName={executionFileName}
                          accept={ACCEPT_EXCEL}
                          onDrop={handleDropSingleFile}
                          onReplace={(event) => handleReplaceFile(event, FILE_TYPE.MANUAL)}
                          onDelete={onExecutionFileDelete}
                        />
                      </Grid>
                    </Stack>
                  )}
                  {moduleType === 'automated' && (
                    <Stack spacing={2} sx={{ width: 1 }}>
                      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                        Import Automated Module
                      </Typography>
                      <Grid container spacing={1}>
                        <Grid item xs={12} md={4}>
                          <Stack spacing={2}>
                            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                              Execution File
                            </Typography>
                          </Stack>
                          <UploadSingleFile
                            file={executionFile}
                            accept={ACCEPT_JSON}
                            fileName={executionFileName}
                            onDrop={handleDropSingleFile}
                            onReplace={(event) => handleReplaceFile(event, FILE_TYPE.JSON)}
                            onDelete={onExecutionFileDelete}
                          />
                        </Grid>
                        {jsonData && openUploadTestData && (
                          <Grid item xs={12} md={4}>
                            <Stack spacing={2}>
                              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                                Test Data File
                              </Typography>
                            </Stack>
                            <UploadSingleFile
                              file={testDataFile}
                              accept={ACCEPT_EXCEL}
                              fileName={testDataFileName}
                              onDrop={handleDropTestData}
                              onReplace={(event) => handleReplaceFile(event, FILE_TYPE.TEST_DATA)}
                              onDelete={onTestDataFileDelete}
                            />
                          </Grid>
                        )}
                      </Grid>
                    </Stack>
                  )}
                </Stack>
              </Card>
            </Grid>
            {jsonData && jsonData?.testCases?.length > 0 && (
              <Grid item xs={12} md={12}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={extractedTestData ? 6 : 12}>
                    <Card style={{ boxShadow: '0 0 10px #919eab' }}>
                      <CardHeader title="Test Cases Preview" sx={{ mb: 2 }} />
                      <Scrollbar>
                        <TableContainer sx={{ minWidth: 480, maxHeight: 300 }}>
                          <Table stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell>TestCase Id</TableCell>
                                <TableCell>Title</TableCell>
                                <TableCell>Automated ?</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {jsonData?.testCases.map((testcase) => (
                                <TableRow key={testcase.testNode?.testCaseID || testcase.testCaseID}>
                                  <TableCell>
                                    <Typography variant="subtitle2">
                                      {testcase.testNode?.testCaseID || testcase.testCaseID}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>{testcase.testNode?.testCaseTitle || testcase.testCaseTitle}</TableCell>
                                  <TableCell>{moduleType === 'automated' ? 'Yes' : 'No'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Scrollbar>
                    </Card>
                  </Grid>
                  {extractedTestData && (
                    <Grid item xs={12} md={6}>
                      <Card style={{ boxShadow: '0 0 10px #919eab' }}>
                        <CardHeader title="Test Data Preview" sx={{ mb: 2 }} />
                        <Scrollbar>
                          {extractedTestData?.data?.length === 1 && (
                            <TableContainer sx={{ minWidth: 480, maxHeight: 300 }}>
                              <Table>
                                <TableBody>
                                  {Object.keys(extractedTestData?.data[0])?.map((key) => (
                                    <TableRow key={key}>
                                      <TableCell style={{ padding: '5px 20px' }}>
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center'
                                          }}
                                        >
                                          <div
                                            style={{
                                              width: '50%',
                                              fontSize: '16px',
                                              fontWeight: '600',
                                              textTransform: 'capitalize',
                                              wordBreak: 'break-word', // ✅ Wrap long key names
                                              whiteSpace: 'normal', // ✅ Allow multi-line
                                              overflowWrap: 'anywhere' // ✅ Best for breaking long keys with no spaces
                                            }}
                                          >
                                            {key}
                                          </div>
                                          <div>
                                            <TextField
                                              required
                                              type={key === 'password' ? 'password' : 'text'}
                                              sx={{
                                                width: '100%',
                                                '& .MuiOutlinedInput-root': {
                                                  '& > fieldset': {
                                                    border: 'none'
                                                  }
                                                }
                                              }}
                                              id={key}
                                              defaultValue={extractedTestData?.data[0][key]}
                                            />
                                          </div>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          )}
                          {extractedTestData?.data?.length > 1 && (
                            <TableContainer sx={{ minWidth: 480, maxHeight: 300 }}>
                              <Table stickyHeader>
                                <TableHead>
                                  <TableRow>
                                    {Object.keys(extractedTestData?.data[0]).map((key) => (
                                      <TableCell key={key}>{key}</TableCell>
                                    ))}
                                    {/*  <TableCell>Edit</TableCell> */}
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {extractedTestData?.data.map((testData, index) => (
                                    <TableRow key={index}>
                                      {Object.keys(testData).map((key) => (
                                        <TableCell key={key}>
                                          {key === 'password' ? (
                                            <TextField
                                              required
                                              type={key === 'password' ? 'password' : 'text'}
                                              id={key}
                                              defaultValue={testData[key]}
                                              style={{ height: '2rem' }}
                                              inputProps={{ readOnly: true }}
                                              sx={{
                                                '& fieldset': { border: 'none' }
                                              }}
                                            />
                                          ) : (
                                            testData[key]
                                          )}
                                        </TableCell>
                                      ))}
                                      {/* <TableCell>
                                        <Icon
                                          icon={editFill}
                                          width={24}
                                          height={24}
                                          onClick={() => {
                                            setEdit(!edit);
                                            handleEdit(testData, index);
                                          }}
                                          cursor="pointer"
                                        />
                                      </TableCell> */}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          )}
                        </Scrollbar>
                      </Card>
                    </Grid>
                  )}
                </Grid>
              </Grid>
            )}
          </Grid>
          {moduleType !== 'jsonBuilder' && (
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting} disabled={isInValid}>
                {!isEdit ? 'Save Module' : 'Save Changes'}
              </LoadingButton>
            </Box>
          )}

          <Dialog open={open} onClose={handleClose}>
            <DialogTitle id="simple-dialog-title">Module Info</DialogTitle>
            <DialogContent>
              <DialogContentText id="alert-dialog-slide-description">
                <br />
                <br />
                Module Name with <b>[{executionFileName}]</b> already exists!! The Module data will be replaced!!
                <br />
                <br />
                Do you want to continue?
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  handleClose();
                  onExecutionFileDelete();
                }}
              >
                Disagree
              </Button>
              <Button
                onClick={() => {
                  handleClose();
                  navigateToEditModule();
                }}
                autoFocus
              >
                Agree
              </Button>
            </DialogActions>
          </Dialog>
        </Form>
      </FormikProvider>

      {testDataToEdit?.testData && (
        <Dialog open={edit} onClose={handleEditClose}>
          <DialogTitle id="edit-testdata-row">Edit Test Data</DialogTitle>
          <DialogContent>
            <DialogContentText id="edit-testdata-row-description" />
            <form id="save-test-data" onSubmit={(e) => saveTestData(e)}>
              <TableContainer sx={{ minWidth: 480, maxHeight: 300 }}>
                <Table>
                  <TableBody>
                    {Object.keys(testDataToEdit?.testData)?.map((key) => (
                      <TableRow key={key}>
                        <TableCell style={{ padding: '5px 20px' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <div
                              style={{
                                width: '50%',
                                fontSize: '16px',
                                fontWeight: '600',
                                textTransform: 'capitalize'
                              }}
                            >
                              {key}
                            </div>
                            <div>
                              <TextField
                                required
                                type={key === 'password' ? 'password' : 'text'}
                                sx={{
                                  width: '100%',
                                  '& .MuiOutlinedInput-root': {
                                    '& > fieldset': {
                                      border: 'none'
                                    }
                                  }
                                }}
                                id={key}
                                defaultValue={testDataToEdit?.testData[key]}
                                onChange={handleEditTestData}
                                name={key}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </form>
          </DialogContent>
          <DialogActions>
            <Button form="save-test-data" variant="contained" type="submit" onClick={handleEditClose}>
              save
            </Button>
            <Button variant="contained" onClick={handleEditClose}>
              cancel
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <Dialog
        open={errorPopup}
        onClose={() => setErrorPopup(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{errorMessage}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            <br />
            {errorDetail}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setErrorPopup(false);
            }}
          >
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
