import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  IconButton,
  Paper,
  Box,
  Typography,
  CircularProgress
} from '@mui/material';
// import axios from 'axios';

import { AddCircle, CancelRounded } from '@mui/icons-material';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useCallback } from 'react';
import Slider from 'react-slick';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useLocation } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import { EditorState, convertToRaw, convertFromRaw } from 'draft-js';
import axios from '../../../utils/axiosInstance';
import { useDispatch, useSelector } from '../../../redux/store';
import {
  getRowsSuccess,
  getTestCaseEvidences,
  getTestStepDetails,
  getTestCaseDetails,
  getTestStepEvidencesFetched
} from '../../../redux/slices/testRun';
import { setCurrentGraphTestCounts, setGraphTestCases, getModuleDataSuccess } from '../../../redux/slices/release';
import { DraftEditor } from '../../editor';
import { UploadMultiFile } from '../../upload';
import TestStepsScreenShotsUpload from './TestStepsScreenShotUpload';
import API from '../../../services';
import { getSessionObj } from '../../../utils/jwt';
import { getIDBCurrentUser } from '../../../main';
import { refreshTestCases } from '../../../redux/slices/common';
import { STATUS_CODES as STATUS } from '../../../Constants';

const STATUS_CODES = STATUS;

const LabelStyle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.palette?.text.secondary,
  marginBottom: theme.spacing(1)
}));

const settings = {
  dots: false,
  autoplay: false,
  infinite: true,
  speed: 500,
  slidesToShow: 1,
  slidesToScroll: 1,
  appendDots: (dots) => <ul>{dots}</ul>,
  nextArrow: <SampleNextArrow />,
  prevArrow: <SamplePrevArrow />
};

SampleNextArrow.propTypes = {
  style: PropTypes.object,
  onClick: PropTypes.object,
  className: PropTypes.object
};

function SampleNextArrow(props) {
  const { className, style, onClick } = props;
  return (
    /* eslint-disable */
    <div className={className} style={{ ...style, display: 'block', background: 'grey' }} onClick={onClick} />
    /* eslint-enable */
  );
}

SamplePrevArrow.propTypes = {
  style: PropTypes.object,
  onClick: PropTypes.object,
  className: PropTypes.object
};

function SamplePrevArrow(props) {
  const { className, style, onClick } = props;
  /* eslint-disable */
  return <div className={className} style={{ ...style, display: 'block', background: 'grey' }} onClick={onClick} />;
  /* eslint-enable */
}

TestCaseScreenShotsUpload.propTypes = {
  testCase: PropTypes.object,
  testRunId: PropTypes.string,
  getTestCaseResults: PropTypes.func,
  open: PropTypes.bool,
  setOpen: PropTypes.func
};

export default function TestCaseScreenShotsUpload({ testCase, testRunId, getTestCaseResults, open, setOpen }) {
  const dispatch = useDispatch();
  const moduleId = testCase?.moduleId;
  const [edited, setEdited] = useState(false);
  const { pathname } = useLocation();
  const currentFunction = useSelector((state) => state.testRun.currentFunction);
  const isModule = pathname.includes('module') || currentFunction.includes('module');
  const [caseEvidencesFetched, setCaseEvidencesFetched] = useState(false);
  const evidencesFetched = useSelector((state) => state.testRun.testCaseEvidencesFetched);
  const testCaseResults = useSelector((state) => state.testRun.testCaseEvidences);
  const testStepDetails = useSelector((state) => state.testRun.testStepDetails);
  // const updatedTestCases = useSelector((state) => state.testRun?.updatedTestCases);
  const testCaseDetails = useSelector((state) => state.testRun.testCaseDetails);
  const testStepResults = useSelector((state) => state.testRun.testStepEvidences);
  const [testResultsToDelete, setTestResultsToDelete] = useState([]);
  const [openUpload, setOpenUpload] = useState(false);
  const [screenShotsErrors, setScreenShotsErrors] = useState({});
  const [testCaseScreenshots, setTestCaseScreenshots] = useState([]);
  const [testCaseStatus, setTestCaseStatus] = useState();
  const [testStepsToDelete, setTestStepsToDelete] = useState({});
  const [testStepScreenShots, setTestStepScreenShots] = useState({});
  const [draftSimple, setDraftSimple] = useState(EditorState.createEmpty());
  const [testStepStatus, setTestStepStatus] = useState({});
  const rows = useSelector((state) => state.testRun.rows);
  const graphTestCasesCounts = useSelector((state) => state.release.graphTestCasesCounts);
  const moduleData = useSelector((state) => state.release.moduleData);
  const [updatedTestStepStatus, setUpdatedTestStepStatus] = useState();
  const [noEvidences, setNoEvidences] = useState(false);
  let toastId;
  let $testCaseId;
  let $testNodeId;
  let $moduleId;

  const successToast = () => {
    toast.update(toastId, {
      render: 'Test case updated successfully',
      type: 'success',
      autoClose: 5000,
      isLoading: false
    });
  };

  const errorToast = () =>
    toast.update(toastId, {
      render: 'Error in updating the test case',
      type: 'error',
      autoClose: 5000,
      isLoading: false
    });

  const loadingToast = () => (toastId = toast.loading('Test case update in progress'));

  const formData = new FormData();

  const TestResultsSchema = Yup.object().shape({
    images: Yup.array().max(2, 'maximum of 15 screenshots per test case')
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      images: [],
      testCaseScreenshots: []
    },
    validationSchema: TestResultsSchema,
    onSubmit: async (values, { setSubmitting, resetForm, setErrors }) => {
      try {
        resetForm();
        setSubmitting(false);
      } catch (error) {
        console.error(error);
        setSubmitting(false);
        setErrors(error);
      }
    }
  });

  const { errors, values, touched, setFieldValue } = formik;

  const handleClose = () => {
    setOpen(false);
    setTestResultsToDelete([]);
    setUpdatedTestStepStatus([]);
    setTestCaseScreenshots([]);
    setTestCaseScreenshots({});
    displayTestCaseComments();
  };

  const handleCloseUpload = () => {
    setOpenUpload(false);
    setScreenShotsErrors({ ...screenShotsErrors, testCaseScreenshotsError: null });
    setFieldValue('images', []);
    setTestResultsToDelete([]);
    setUpdatedTestStepStatus([]);

    if (testResultsToDelete.constructor === Array) {
      const $testResultsToDelete = testResultsToDelete.filter((item, i, ar) => ar.indexOf(item) === i);
      setTestResultsToDelete($testResultsToDelete);
    }
  };

  const handleSaveUpload = () => {
    setOpenUpload(false);
    setScreenShotsErrors({ ...screenShotsErrors, testCaseScreenshotsError: null });
    setFieldValue('images', []);
  };

  const handleRemoveAll = () => {
    setTestCaseScreenshots([]);
    setEdited(true);
    setFieldValue('images', []);
    setScreenShotsErrors({ ...screenShotsErrors, testCaseScreenshotsError: null });
  };

  const handleRemove = (file) => {
    setEdited(true);
    const filteredItems = values.images.filter((_file) => _file !== file);
    setTestCaseScreenshots(filteredItems);
    setFieldValue('images', filteredItems);
    if (filteredItems.length > 15) {
      setScreenShotsErrors({
        ...screenShotsErrors,
        testCaseScreenshotsError: 'maximum of 15 screenshots per test case '
      });
    } else {
      setScreenShotsErrors({
        ...screenShotsErrors,
        testCaseScreenshotsError: null
      });
    }
  };

  const handleChangeDialogStatus = (event) => {
    setEdited(true);
    setTestCaseStatus(event.target.value);

    if (event.target.value === 'PASSED' || event.target.value === 'FAILED') {
      let $testStepDetails;
      if (testStepDetails && testStepDetails?.length > 0) {
        $testStepDetails = [...testStepDetails];
        testStepDetails.forEach((step, index) => {
          $testStepDetails[index] = { ...$testStepDetails[index], status: event.target.value };
        });
      }
      setUpdatedTestStepStatus($testStepDetails);
    }

    // setUpdatedTestCase({ ...updatedTestCase, status: event.target.value });
    setFieldValue('testCaseStatus', event.target.value);
  };

  const isCaseImageDeleted = (curIndex) => {
    let isDeleted = false;
    if (testResultsToDelete) {
      if (testResultsToDelete.constructor === Array) {
        if (testResultsToDelete.includes(curIndex)) {
          isDeleted = true;
        }
      } else if (Number(testResultsToDelete) === curIndex) {
        isDeleted = true;
      }
    }

    return isDeleted;
  };

  const deleteTestCaseImage = (index) => {
    setEdited(true);
    if (testResultsToDelete.constructor === Array) {
      setTestResultsToDelete([...testResultsToDelete, index]);
    } else {
      const $testResultsToDelete = [];
      $testResultsToDelete.push(index);
      setTestResultsToDelete($testResultsToDelete);
    }
  };

  const getUpdatedTestCaseData = async () => {
    try {
      const response = await axios({
        method: 'get',
        url: `${API.testRun.getJobById(testRunId)}`,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });

      const $modules = response?.data.response.testRun;
      const $testNodes = $modules.filter((module) => module.moduleID === $moduleId)[0].testNodes;

      const testNodeIndex = $testNodes.findIndex((testNode) => testNode?.testNodeID === $testNodeId);

      const $testNode = $testNodes[testNodeIndex];
      dispatch(
        getTestCaseDetails({
          ...testCaseDetails,
          screenShotComments: $testNode?.screenShotComments,
          status: $testNode?.status,
          testCaseResultsFile: $testNode?.testCaseResultsFile,
          dateStatusLastUpdated: $testNode?.dateStatusLastUpdated
        })
      );
      const $updatedTestSteps = $testNode.testCaseSteps;

      const caseIndex = rows.findIndex((row) => row?.id === $testNodeId);
      const updatedTestCase = {
        ...rows[caseIndex],
        status: $testNode?.status,
        dateStatusLastUpdated: $testNode?.dateStatusLastUpdated
      };
      const $rows = [...rows];

      const $testStepStatus = {};
      if ($updatedTestSteps) {
        if ($updatedTestSteps.constructor === Array) {
          $updatedTestSteps.forEach((step) => {
            $testStepStatus[step?._id] = step.status;
          });
        } else {
          $testStepStatus[$updatedTestSteps._id] = $updatedTestSteps.status;
        }
      }

      const $testStepDetails = [...testStepDetails];
      Object.keys($testStepStatus).forEach((stepId) => {
        const index = $testStepDetails.findIndex((step) => step?._id === stepId);
        if (index >= 0) {
          $testStepDetails[index] = { ...$testStepDetails[index], status: $testStepStatus[stepId] };
        }
      });

      if (updatedTestCase?.testStepStatuses) {
        updatedTestCase.testStepStatuses = $testStepStatus;
      }

      $rows[caseIndex] = updatedTestCase;
      dispatch(getRowsSuccess($rows));
      dispatch(getTestStepDetails($testStepDetails));

      if ($testNode?.testCaseResultsFile) {
        await getTestCaseResults($testNode.testCaseResultsFile);
        setCaseEvidencesFetched(true);
      }

      // const updatedGraphTestCasesCounts = [...graphTestCasesCounts];
      // const tnIndex = updatedGraphTestCasesCounts.findIndex((tn) => tn?.jobId === testRunId && tn?.id === $testNodeId);
      // updatedGraphTestCasesCounts[tnIndex] = { ...updatedGraphTestCasesCounts[tnIndex], status: $testNode?.status };

      // dispatch(setGraphTestCases(updatedGraphTestCasesCounts));
      // dispatch(setCurrentGraphTestCounts(updatedGraphTestCasesCounts));
      /* * updating release moduleData * */

      const $moduleData = [...moduleData];

      const $moduleIndex = $moduleData.findIndex((module) => module?._id === updatedTestCase?.moduleId);
      const $testNodeIndex = $moduleData[$moduleIndex]?.testNodes?.findIndex((tn) => tn?.id === $testNodeId);
      const $updatedTestNode = { ...$moduleData[$moduleIndex].testNodes[$testNodeIndex], status: $testNode?.status };
      const $updatedTestNodes = [...$moduleData[$moduleIndex]?.testNodes];
      $updatedTestNodes[$testNodeIndex] = $updatedTestNode;
      $moduleData[$moduleIndex] = { ...$moduleData[$moduleIndex], testNodes: $updatedTestNodes };
      dispatch(getModuleDataSuccess($moduleData));
    } catch (error) {
      console.log('error = ', error);
    }
  };

  const testCaseUpdate = async () => {
    loadingToast();
    dispatch(getTestCaseEvidences({ testCaseEvidencesFetched: false }));
    setCaseEvidencesFetched(false);
    dispatch(getTestStepEvidencesFetched(false));

    if (moduleId) {
      $moduleId = moduleId;
    } else {
      $moduleId = testCaseDetails?.moduleId;
    }
    if (testCase?.id) {
      $testNodeId = testCase?.id;
    } else {
      $testNodeId = testCaseDetails?.testNodeID;
    }
    if (testCase?._id) {
      $testCaseId = testCase?._id;
    } else {
      $testCaseId = testCaseDetails?.testCaseId;
    }
    try {
      const currentUser = await getIDBCurrentUser();
      formData.append('email', currentUser.email);
      formData.append('company', currentUser.company._id);
      let res = await axios({
        method: 'patch',
        url: `${API.testRun.testCaseUpdate(testRunId, $moduleId, $testNodeId, $testCaseId)}`,
        // data,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`,
          'Content-Type': 'multipart/form-data'
          // 'Access-Control-Allow-Origin': `${API.testRun.testCaseUpdate(testRunId, $moduleId, $testNodeId, $testCaseId)}`
        },
        data: formData
      });
      if (res.status === 200) successToast();
      if (res.status !== 200) errorToast();
      refreshTestCases(dispatch, null, testRunId);
    } catch (error) {
      errorToast();
      console.log('error = ', error);
    }
  };

  const displayTestCaseComments = useCallback(() => {
    if (testCaseDetails?.screenShotComments) {
      const content = EditorState.createWithContent(convertFromRaw(JSON.parse(testCaseDetails?.screenShotComments)));
      setDraftSimple(content);
    } else {
      setDraftSimple(EditorState.createEmpty());
    }
  }, [testCaseDetails]);

  const saveTestCase = async (e) => {
    const initialValue = 0;
    const testStepEvidenceCount = Object.values(testStepScreenShots).reduce(
      (accumulator, currentValue) => accumulator + currentValue,
      initialValue
    );
    if (testStepEvidenceCount === 0 && testCaseScreenshots?.length === 0) {
      setNoEvidences(true);
    } else {
      handleSave(e);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    let allFiles = {};
    if (testCaseScreenshots) {
      if (testCaseScreenshots?.length > 0) {
        testCaseScreenshots?.forEach((file) => {
          formData.append('testCaseScreenshots', file);
        });
      }
    }

    Object.keys(testStepScreenShots).forEach((stepId) => {
      const files = testStepScreenShots[stepId];
      allFiles[stepId] = files;
      if (Array.isArray(files)) {
        files.forEach((file) => {
          formData.append(stepId, file);
        });
      } else {
        formData.append(stepId, files);
      }
    });

    formData.append('testResultsToDelete', testResultsToDelete);

    Object.keys(testStepsToDelete).forEach((stepId) => {
      formData.append(`testStepsToDelete`, `${stepId}_${testStepsToDelete[stepId]}`);
    });

    formData.append('testCaseStatus', testCaseStatus);

    for (const stepId of Object.keys(testStepStatus)) {
      formData.append(`stepStatus`, `${stepId}_${testStepStatus[stepId]}`);

      // If any test case step status is FAILED, it is mandatory for the user to enter description in the text box
      if (testStepStatus[stepId] === 'FAILED') {
        if (!draftSimple.getCurrentContent().hasText()) {
          toast.error('Please describe about issue in text box as one of the test case step status is of FAILED');
          return;
        } else {
          formData.append('screenShotComments', JSON.stringify(convertToRaw(draftSimple.getCurrentContent())));
        }
      }

      if (
        testStepStatus[stepId] === 'PASSED' ||
        testStepStatus[stepId] === 'FAILED' ||
        testStepStatus[stepId] === 'WARNING' ||
        testStepStatus[stepId] === 'IGNORED'
      ) {
        // Checking values against both "Uploaded" and "Total" fields against each test case step
        // In another way, each test case step shall have an uploaded file or
        // already an existing uploaded file
        if (!allFiles[stepId] && !Object.hasOwn(testStepResults, stepId)) {
          toast.error('Please upload screenshots for the test case steps with PASSED/FAILED/WARNING/IGNORED status');
          return;
        }
      }
    }

    // if (draftSimple) {
    //   formData.append('screenShotComments', JSON.stringify(convertToRaw(draftSimple.getCurrentContent())));
    // }

    setOpen(false);
    setNoEvidences(false);

    await testCaseUpdate();
    dispatch(getTestCaseEvidences({ testCaseEvidencesFetched: false }));
    await getUpdatedTestCaseData().then(() => {});
    setTestCaseScreenshots([]);
    setTestStepScreenShots({});
    setTestResultsToDelete([]);
    setTestStepsToDelete({});
  };

  const handleOpenUpload = () => {
    setOpenUpload(true);
  };

  // const setInitialValues = useCallback(() => {
  //   if (testCaseDetails?.selectedTestCaseStatus) {
  //     setTestCaseStatus(testCaseDetails?.selectedTestCaseStatus);

  //     if (
  //       testCaseDetails?.selectedTestCaseStatus === 'PASSED' ||
  //       testCaseDetails?.selectedTestCaseStatus === 'FAILED' ||
  //       testCaseDetails?.selectedTestCaseStatus === 'SKIPPED' ||
  //       testCaseDetails?.selectedTestCaseStatus === 'WARNING' ||
  //       testCaseDetails?.selectedTestCaseStatus === 'IGNORED'
  //     ) {
  //       let $testStepDetails;
  //       if (testStepDetails && testStepDetails?.length > 0) {
  //         $testStepDetails = [...testStepDetails];
  //         testStepDetails.forEach((step, index) => {
  //           $testStepDetails[index] = { ...$testStepDetails[index], status: testCaseDetails?.selectedTestCaseStatus };
  //         });
  //       }
  //       setUpdatedTestStepStatus($testStepDetails);
  //     }
  //   } else {
  //     setTestCaseStatus(testCaseDetails?.status);
  //   }
  // }, [testCaseDetails, testStepDetails]);

  const setInitialValues = useCallback(() => {
    if (testCaseDetails?.selectedTestCaseStatus) {
      setTestCaseStatus(testCaseDetails?.selectedTestCaseStatus);

      if (
        testCaseDetails?.selectedTestCaseStatus === 'PASSED' ||
        testCaseDetails?.selectedTestCaseStatus === 'FAILED' ||
        testCaseDetails?.selectedTestCaseStatus === 'SKIPPED' ||
        testCaseDetails?.selectedTestCaseStatus === 'WARNING' ||
        testCaseDetails?.selectedTestCaseStatus === 'IGNORED'
      ) {
        let $testStepDetails;
        if (testStepDetails && testStepDetails?.length > 0) {
          $testStepDetails = [...testStepDetails];

          if (testCaseDetails?.selectedTestCaseStatus === 'FAILED') {
            // ✅ First step -> FAILED, rest -> SKIPPED
            $testStepDetails = $testStepDetails.map((step, index) => ({
              ...step,
              status: index === 0 ? 'FAILED' : 'SKIPPED'
            }));
          } else {
            // ✅ All steps -> same status
            $testStepDetails = $testStepDetails.map((step) => ({
              ...step,
              status: testCaseDetails?.selectedTestCaseStatus
            }));
          }
        }
        setUpdatedTestStepStatus($testStepDetails);
      }
    } else {
      setTestCaseStatus(testCaseDetails?.status);
    }
  }, [testCaseDetails, testStepDetails]);

  const handleDrop = useCallback(
    (acceptedFiles) => {
      // Filter the accepted files to ensure only images are processed
      const imageFiles = acceptedFiles.filter((file) => file.type.startsWith('image/'));

      if (imageFiles.length !== acceptedFiles.length) {
        setScreenShotsErrors({
          ...screenShotsErrors,
          testCaseScreenshotsError: 'Please upload only image files'
        });
        return; // stop further processing
      }

      setEdited(true);

      // Update the state with the filtered image files
      setTestCaseScreenshots(imageFiles);

      if (imageFiles?.length > 15) {
        setScreenShotsErrors({
          ...screenShotsErrors,
          testCaseScreenshotsError: 'maximum of 15 screenshots per test case '
        });
      } else {
        setScreenShotsErrors({
          ...screenShotsErrors,
          testCaseScreenshotsError: null
        });
      }

      // Set form field value with the filtered image files
      setFieldValue(
        'images',
        imageFiles.map((file) => {
          Object.assign(file, {
            preview: URL.createObjectURL(file)
          });
          return file;
        })
      );
    },
    [setFieldValue, screenShotsErrors]
  );

  const handleConfirmSaveClose = () => {
    setNoEvidences(false);
  };

  useEffect(() => {
    if (evidencesFetched) {
      setCaseEvidencesFetched(evidencesFetched);
    }
  }, [evidencesFetched]);

  useEffect(() => {
    displayTestCaseComments();
  }, [open, displayTestCaseComments]);

  useEffect(() => {
    setInitialValues();
  }, [testCaseDetails, setInitialValues]);

  useEffect(() => {
    setTestCaseScreenshots([]);
    setTestStepScreenShots({});
  }, []);

  return (
    <>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Add Results</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <Stack direction="row" spacing={6} paddingTop={2} paddingBottom={2}>
              <Stack>Test Case Status</Stack>
              <Stack>
                <TextField
                  select
                  fullWidth
                  id="testCaseStatus"
                  name="testCaseStatus"
                  value={testCaseStatus}
                  SelectProps={{ native: true }}
                  onChange={(event) => {
                    handleChangeDialogStatus(event);
                  }}
                  sx={{
                    '& fieldset': { border: '0 !important' },
                    '& select': {
                      pl: 1,
                      py: 0.5,
                      pr: '20px !important',
                      typography: 'subtitle2'
                    },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 0.75,
                      bgcolor: 'background.neutral'
                    },
                    '& .MuiNativeSelect-icon': {
                      top: 4,
                      right: 0,
                      width: 20,
                      height: 20
                    }
                  }}
                >
                  {STATUS_CODES.map((option) => (
                    <option key={option.id} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </TextField>
              </Stack>
            </Stack>
          </DialogContentText>
          <Stack direction="column" spacing={6} alignContent="center" justifyContent="center">
            <Stack>
              <LabelStyle>Comments</LabelStyle>
              <DraftEditor
                editorState={draftSimple}
                simple
                placeholder="Write something awesome..."
                onEditorStateChange={(value) => {
                  setEdited(true);
                  setDraftSimple(value);
                }}
              />
            </Stack>
            <Stack>
              <LabelStyle>Add Screenshots</LabelStyle>

              {/* <input type="file" name="test-file" onChange={(e) => setTestFile(e.target.files)} multiple /> */}
              <AddCircle
                color="primary"
                sx={{ cursor: 'pointer' }}
                onClick={() => {
                  setEdited(true);
                  handleOpenUpload();
                }}
              />

              <TextField
                disabled
                id="outlined-disabled"
                label={`Uploaded : ${testCaseScreenshots?.length || 0}`}
                border="none"
                sx={{
                  '& fieldset': { border: 'none' }
                }}
              />
              <TextField
                disabled
                id="outlined-disabled"
                label={`Total : ${testCaseResults?.length || 0}`}
                border="none"
                sx={{
                  '& fieldset': { border: 'none' }
                }}
              />
            </Stack>
          </Stack>
          <TestStepsScreenShotsUpload
            testStepScreenShots={testStepScreenShots}
            setTestStepScreenShots={setTestStepScreenShots}
            setTestStepsToDelete={setTestStepsToDelete}
            setTestStepStatus={setTestStepStatus}
            testStepStatus={testStepStatus}
            caseEvidencesFetched={caseEvidencesFetched}
            testStepsToDelete={testStepsToDelete}
            updatedTestStepStatus={updatedTestStepStatus}
            setTestCaseStatus={setTestCaseStatus}
            setEdited={setEdited}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
          <Button onClick={saveTestCase} variant="contained" type="submit" disabled={!edited}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openUpload} onClose={handleCloseUpload}>
        <DialogTitle>Add Results</DialogTitle>
        <DialogContent>
          <Stack direction="column" spacing={6} alignContent="center" justifyContent="center">
            <Stack>
              <UploadMultiFile
                showPreview
                maxSize={3145728}
                accept="image/*"
                files={values.images}
                onDrop={handleDrop}
                onRemove={handleRemove}
                onRemoveAll={handleRemoveAll}
                error={Boolean(touched.images && errors.images)}
                name="testCaseScreenShots"
              />
              {screenShotsErrors.testCaseScreenshotsError ? (
                <div className="error">{screenShotsErrors.testCaseScreenshotsError}</div>
              ) : null}
            </Stack>
          </Stack>
          <Stack mt={2} sx={{ width: 500, height: 50, paddingLeft: 5 }}>
            {!isModule && (
              <Paper
                variant="outlined"
                sx={{
                  height: 15,
                  alignContent: 'center',
                  justifyContent: 'center'
                }}
              >
                {!caseEvidencesFetched && (
                  <Box sx={{ display: 'flex' }}>
                    <CircularProgress />
                  </Box>
                )}

                {caseEvidencesFetched && testCaseResults?.length > 0 && (
                  <>
                    <Slider {...settings}>
                      {testCaseResults.map(
                        (image, index) =>
                          !isCaseImageDeleted(index) && (
                            <Paper elevation={5}>
                              <div key={index}>
                                <IconButton onClick={() => deleteTestCaseImage(index)} sx={{ float: 'right' }}>
                                  <CancelRounded />
                                </IconButton>
                              </div>

                              <img src={image} alt=" " style={{ objectFit: 'contain', objectPosition: 'center' }} />
                            </Paper>
                          )
                      )}
                    </Slider>
                  </>
                )}

                {testCaseScreenshots?.length === 0 &&
                  caseEvidencesFetched &&
                  testCaseResults?.length === 0 &&
                  'No screenshots found'}
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUpload} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={(e) => handleSaveUpload(e)}
            variant="contained"
            // disabled={screenShotsErrors.testCaseScreenshotsError}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={noEvidences}
        onClose={handleConfirmSaveClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">No evidences modified.Do you want to proceed?</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            <br />
            No evidences modified
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={(e) => {
              handleConfirmSaveClose();
              handleSave(e);
            }}
          >
            Yes
          </Button>
          <Button
            onClick={() => {
              handleConfirmSaveClose();
            }}
            autoFocus
          >
            No
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
