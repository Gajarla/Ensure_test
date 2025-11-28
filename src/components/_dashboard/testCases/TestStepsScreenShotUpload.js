// material
import {
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  Stack,
  Typography,
  TextField,
  Button,
  Paper,
  Box,
  Divider,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  CircularProgress
} from '@mui/material';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import { useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useEffect, useState, useCallback } from 'react';
import { styled } from '@mui/material/styles';

import { AddCircle, CancelRounded } from '@mui/icons-material';
import Slider from 'react-slick';
import { useSelector } from '../../../redux/store';
import { UploadMultiFile } from '../../upload';
import { STATUS_CODES as STATUS } from '../../../Constants';

import './screenShots.css';

var updatedStepId = 0; /* eslint no-var: off */
var temptestStepScreenShots = {}; /* eslint no-var: off */

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

TestStepsScreenShotsUpload.propTypes = {
  testStepsToDelete: PropTypes.object,
  updatedTestStepStatus: PropTypes.object,
  testStepScreenShots: PropTypes.object,
  setTestStepScreenShots: PropTypes.func,
  setTestStepStatus: PropTypes.func,
  testStepStatus: PropTypes.object,
  caseEvidencesFetched: PropTypes.bool,
  setTestCaseStatus: PropTypes.func,
  setEdited: PropTypes.func,
  setTestStepsToDelete: PropTypes.func
};

export default function TestStepsScreenShotsUpload({
  testStepsToDelete,
  setTestStepsToDelete,
  testStepScreenShots,
  setTestStepScreenShots,
  setTestStepStatus,
  testStepStatus,
  caseEvidencesFetched,
  updatedTestStepStatus,
  setTestCaseStatus,
  setEdited
}) {
  const testStepDetails = useSelector((state) => state.testRun.testStepDetails);
  const [stepOpenUpload, setStepOpenUpload] = useState(false);
  const [currentStepId, setCurrentStepId] = useState();
  const [screenShotsErrors, setScreenShotsErrors] = useState({});
  const testStepResults = useSelector((state) => state.testRun.testStepEvidences);
  const { pathname } = useLocation();
  const currentFunction = useSelector((state) => state.testRun.currentFunction);
  const isModule = pathname.includes('module') || currentFunction.includes('module');

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

  const updateStepId = (stepId) => {
    updatedStepId = stepId;
    setCurrentStepId(stepId);
  };

  const handleStepOpenUpload = () => {
    setScreenShotsErrors({ ...screenShotsErrors, testStepScreenshotsError: null });
    setStepOpenUpload(true);
  };

  const handleStepCloseUpload = (e) => {
    e.preventDefault();
    setScreenShotsErrors({ ...screenShotsErrors, testStepScreenshotsError: null });
    setStepOpenUpload(false);
    setFieldValue('images', []);
    setTestStepsToDelete({});
  };

  const deleteTestStepImage = (currentStepId, index) => {
    setEdited(true);
    const $testStepsToDelete = { ...testStepsToDelete };
    if ($testStepsToDelete[currentStepId]) {
      $testStepsToDelete[currentStepId] = [...$testStepsToDelete[currentStepId], index];
      setTestStepsToDelete($testStepsToDelete);
    } else {
      const $testStepIndex = [];
      $testStepIndex.push(index);
      $testStepsToDelete[currentStepId] = $testStepIndex;
      setTestStepsToDelete($testStepsToDelete);
    }
  };

  const isStepImageDeleted = (stepId, curIndex) => {
    let isDeleted = false;
    if (testStepsToDelete[stepId]) {
      if (testStepsToDelete[stepId].constructor === Array) {
        if (testStepsToDelete[stepId].includes(curIndex)) {
          isDeleted = true;
        }
      } else if (Number(testStepsToDelete[stepId]) === curIndex) {
        isDeleted = true;
      }
    }
    return isDeleted;
  };

  // const handleStepStatusChange = (event, testStep) => {
  //   setEdited(true);
  //   const stepId = testStep._id;
  //   const stepStatus = event.target.value;
  //   const $testStepStatus = { ...testStepStatus };
  //   $testStepStatus[stepId] = stepStatus;
  //   setTestStepStatus($testStepStatus);
  //   if (stepStatus === 'FAILED') {
  //     setTestCaseStatus('FAILED');
  //   }

  //   if (allTestStepsPassed($testStepStatus)) {
  //     setTestCaseStatus('PASSED');
  //   }
  // };

  const handleStepStatusChange = (event, testStep) => {
    setEdited(true);
    const stepId = testStep._id;
    const stepStatus = event.target.value;

    // Make a copy of current statuses
    let $testStepStatus = { ...testStepStatus };

    // Update current step status
    $testStepStatus[stepId] = stepStatus;

    // Find the index of the changed step
    const changedIndex = testStepDetails.findIndex((step) => step._id === stepId);

    if (stepStatus === 'FAILED') {
      // FAILED → mark all next steps as SKIPPED
      for (let i = changedIndex + 1; i < testStepDetails.length; i++) {
        const nextStepId = testStepDetails[i]._id;
        $testStepStatus[nextStepId] = 'SKIPPED';
      }
      setTestCaseStatus('FAILED');
    } else {
      // If step is no longer FAILED → restore next steps to their original status (if not skipped for other reasons)
      for (let i = changedIndex + 1; i < testStepDetails.length; i++) {
        const nextStepId = testStepDetails[i]._id;
        // Restore from original details or make it blank if unknown
        $testStepStatus[nextStepId] = testStepDetails[i]?.status || '';
      }

      // After restoring, check overall pass condition
      if (allTestStepsPassed($testStepStatus)) {
        setTestCaseStatus('PASSED');
      } else if (Object.values($testStepStatus).includes('FAILED')) {
        setTestCaseStatus('FAILED');
      } else if (Object.values($testStepStatus).includes('UNTESTED')) {
        setTestCaseStatus('UNTESTED');
      } else if (Object.values($testStepStatus).includes('IGNORED')) {
        setTestCaseStatus('IGNORED');
      } else if (Object.values($testStepStatus).includes('WARNING')) {
        setTestCaseStatus('WARNING');
      }
    }

    // Update state
    setTestStepStatus($testStepStatus);
  };

  const allTestStepsPassed = (updatedTestStepDetails) => {
    let allStepsApss = false;
    const nonPassSteps = Object.keys(updatedTestStepDetails).filter((id) => updatedTestStepDetails[id] !== 'PASSED');
    if (nonPassSteps?.length === 0) {
      allStepsApss = true;
    }
    return allStepsApss;
  };

  const handleStepSaveUpload = (e) => {
    e.preventDefault();
    setScreenShotsErrors({ ...screenShotsErrors, testStepScreenshotsError: null });
    setStepOpenUpload(false);
    setFieldValue('images', []);
  };

  const handleStepDrop = useCallback(
    (acceptedFiles) => {
      // Filter the accepted files to ensure only images are processed
      const imageFiles = acceptedFiles.filter((file) => file.type.startsWith('image/'));
      // If some files were rejected due to type, you can show an error
      if (imageFiles.length !== acceptedFiles.length) {
        setScreenShotsErrors({
          ...screenShotsErrors,
          testStepScreenshotsError: 'Please upload only image files'
        });
        return; // stop further processing
      }
      setEdited(true);
      temptestStepScreenShots['' || updatedStepId] = imageFiles;
      if (imageFiles?.length > 5) {
        setScreenShotsErrors({
          ...screenShotsErrors,
          testStepScreenshotsError: 'maximum of 5 screenshots per test step '
        });
      } else {
        setScreenShotsErrors({
          ...screenShotsErrors,
          testStepScreenshotsError: null
        });
      }

      // $testStepScreenShots[currentStepId] = acceptedFiles;

      setTestStepScreenShots(temptestStepScreenShots);
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
    [screenShotsErrors, setEdited, setFieldValue, setTestStepScreenShots]
  );

  const handleStepRemove = (file) => {
    setEdited(true);
    const filteredItems = values.images.filter((_file) => _file !== file);
    temptestStepScreenShots['' || updatedStepId] = filteredItems;
    setTestStepScreenShots(temptestStepScreenShots);
    setFieldValue('images', filteredItems);
    if (filteredItems.length > 5) {
      setScreenShotsErrors({
        ...screenShotsErrors,
        testStepScreenshotsError: 'maximum of 5 screenshots per test step '
      });
    } else {
      setScreenShotsErrors({
        ...screenShotsErrors,
        testStepScreenshotsError: null
      });
    }
  };

  const handleStepRemoveAll = () => {
    setEdited(true);
    setScreenShotsErrors({ ...screenShotsErrors, testStepScreenshotsError: null });
    setFieldValue('images', []);
    setTestStepScreenShots({});
  };

  useEffect(() => {
    const $testStepStatus = {};
    if (testStepDetails && testStepDetails?.length > 0) {
      testStepDetails.forEach((step) => {
        $testStepStatus[step?._id] = step?.status;
      });
      setTestStepStatus($testStepStatus);
    }
  }, [testStepDetails, setTestStepStatus]);

  useEffect(() => {
    const $testStepStatus = {};
    if (updatedTestStepStatus && updatedTestStepStatus?.length > 0) {
      updatedTestStepStatus.forEach((step) => {
        $testStepStatus[step?._id] = step?.status;
      });
      setTestStepStatus($testStepStatus);
    }
  }, [updatedTestStepStatus, setTestStepStatus]);

  return (
    <>
      <Stack>
        <LabelStyle>Steps</LabelStyle>
        <Stepper orientation="vertical" sx={{ width: '100%' }}>
          {testStepDetails.map((testStep, index) => (
            <Step key={index} active>
              <StepLabel />
              <Paper variant="outlined" elevation={10}>
                <Stack
                  key={index}
                  active
                  direction="row"
                  spacing={2}
                  marginTop={2}
                  divider={<Divider orientation="vertical" flexItem />}
                >
                  <Stack
                    sx={{
                      width: '50%',
                      height: '100px',
                      overflow: 'hidden'
                    }}
                  >
                    <Typography>{testStepDetails[index]?.name}</Typography>
                    <Typography>{testStepDetails[index]?.description}</Typography>
                  </Stack>

                  <Stack
                    sx={{
                      width: '25%',
                      height: '100px',
                      overflow: 'hidden'
                    }}
                  >
                    Status
                    <TextField
                      select
                      width="50%"
                      id="testStepStatus"
                      name="testStepStatus"
                      SelectProps={{ native: true }}
                      onChange={(event) => {
                        handleStepStatusChange(event, testStep);
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
                      value={testStepStatus && testStep._id && testStepStatus[testStep._id]}
                    >
                      {testStepDetails &&
                        testStepDetails[index] &&
                        STATUS_CODES.map((option) => (
                          <option key={option.id} value={option.label} defaultValue={testStepDetails[index]?.status}>
                            {option.label}
                          </option>
                        ))}
                    </TextField>
                  </Stack>
                  <Stack
                    sx={{
                      width: '25%',
                      height: '100px',
                      overflow: 'hidden',
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start'
                    }}
                  >
                    Screenshots
                    <AddCircle
                      color="primary"
                      sx={{ cursor: 'pointer' }}
                      onClick={() => {
                        updateStepId(testStepDetails[index]?._id);
                        handleStepOpenUpload(true);
                      }}
                    />
                    <input
                      type="text"
                      id="uploaded"
                      value={`Uploaded : ${testStepScreenShots[testStep._id]?.length || 0}`}
                      readOnly
                      style={{ border: 'none', paddingTop: '6px' }}
                      disabled
                    />
                    <input
                      type="text"
                      id="total"
                      value={`Total         : ${testStepResults[testStepDetails[index]?._id]?.length || 0}`}
                      readOnly
                      style={{ border: 'none' }}
                      disabled
                    />
                  </Stack>
                </Stack>
              </Paper>
            </Step>
          ))}
        </Stepper>
      </Stack>

      <Dialog open={stepOpenUpload} onClose={handleStepCloseUpload}>
        <DialogTitle>Add Results</DialogTitle>
        <DialogContent>
          <Stack direction="column" spacing={6} alignContent="center" justifyContent="center">
            <Stack>
              <UploadMultiFile
                showPreview
                maxSize={3145728}
                accept="image/*"
                files={values.images}
                onDrop={handleStepDrop}
                onRemove={handleStepRemove}
                onRemoveAll={handleStepRemoveAll}
                error={Boolean(touched.images && errors.images)}
                name="testStepScreenshots"
              />
            </Stack>
            {screenShotsErrors.testStepScreenshotsError ? (
              <div className="error">{screenShotsErrors.testStepScreenshotsError}</div>
            ) : null}
          </Stack>
          {!isModule && (
            <Stack>
              <Paper
                variant="outlined"
                sx={{
                  // height: 15,
                  alignContent: 'center',
                  justifyContent: 'center'
                }}
              >
                {!caseEvidencesFetched && (
                  <Box sx={{ display: 'flex' }}>
                    <CircularProgress />
                  </Box>
                )}
                {caseEvidencesFetched && testStepResults[currentStepId] && (
                  <Slider {...settings}>
                    {testStepResults[currentStepId].map(
                      (image, index) =>
                        !isStepImageDeleted(currentStepId, index) && (
                          <Paper elevation={5}>
                            <div key={index}>
                              <IconButton
                                onClick={() => deleteTestStepImage(currentStepId, index)}
                                sx={{ float: 'right' }}
                              >
                                <CancelRounded />
                              </IconButton>
                            </div>
                            <img src={image} alt=" " style={{ objectFit: 'contain', objectPosition: 'center' }} />
                          </Paper>
                        )
                    )}
                  </Slider>
                )}
                {!testStepScreenShots[currentStepId] &&
                  caseEvidencesFetched &&
                  !testStepResults[currentStepId] &&
                  'No evidence found'}
              </Paper>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleStepCloseUpload} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={(e) => handleStepSaveUpload(e)}
            variant="contained"
            disabled={screenShotsErrors.testStepScreenshotsError}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
