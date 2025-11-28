// material
import {
  Avatar,
  AvatarGroup,
  // Button,
  Stack,
  Grid,
  Link,
  Step,
  Stepper,
  StepLabel,
  Typography,
  AccordionSummary,
  Accordion,
  AccordionDetails,
  CircularProgress,
  Box
} from '@mui/material';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ExpandMore } from '@mui/icons-material';
// import PropTypes from 'prop-types';
import Label from '../../Label';
import {
  getTestCaseEvidences,
  getTestStepEvidences,
  getTestStepLogs,
  getCurrentFunction,
  getTestStepDetails,
  geTtestCaseEvidencesFetched
} from '../../../redux/slices/testRun';
import { useParams } from 'react-router-dom';
import { getTestCaseDetails } from '../../../_apis_/release';
import { useDispatch, useSelector } from '../../../redux/store';
import { openInNewTab } from '../../../utils/images';
import { setIndexedDBObject, getIndexedDBObject } from '../../../main';
import { highlight, IndexedDB, INDEXEDDB_KEYS, JOB_STATUS, STATUS_COLORS } from '../../../Constants';
import { getSessionObj } from '../../../utils/jwt';
import axios from 'axios';
import API from '../../../services';
import SpinnerOverlay from '../../../components/SpinnerOverlay';

// ----------------------------------------------------------------------

TestCaseDetailSteps.propTypes = {
  // testCase: PropTypes.object
};

export default function TestCaseDetailSteps({ testCase, formData }) {
  const dispatch = useDispatch();
  const [showMore, setShowMore] = useState(false);
  const [showMoreText, setShowMoreText] = useState('Show more ...');
  const testStepResults = useSelector((state) => state.testRun.testStepEvidences);
  const evidencesFetched = useSelector((state) => state.testRun.testCaseEvidencesFetched);
  const { testCaseEvidencesFetched } = useSelector((state) => state.testRun);
  const testStepDetails = useSelector((state) => state.testRun.testStepDetails);
  const testStepLogs = useSelector((state) => state.testRun.testStepLogs);
  const currentFunction = useSelector((state) => state.testRun.currentFunction);
  const currentTestRun = useSelector((state) => state.testRun.currentTestRun);
  const { testCasesConfig } = useSelector((state) => state.role);
  const { currentModule } = useSelector((state) => state.module);
  const [clickedOn, setClickedOn] = useState([]);
  const [isSpinnerLoading, setIsSpinnerLoading] = useState(false);
  const [ndata, setNData] = useState();
  const { moduleId, testRunId } = useParams();

  const { pathname } = useLocation();
  const isTestCaseDetails = pathname.includes('testCaseDetails');
  const isModule =
    pathname.includes('module') || currentFunction.includes('module') || getSessionObj(INDEXEDDB_KEYS.CURRENT_MODULE);

  const handleShowMore = () => {
    setShowMore(!showMore);
    setShowMoreText(showMore ? 'Show More ...' : 'Show Less ...');
  };

  const getTestStepResults = async (data) => {
    if (data) {
      const images = {};
      const logs = {};
      dispatch(geTtestCaseEvidencesFetched(false));
      try {
        const response = await axios({
          method: 'post',
          url: `${API.testRun.getTestResultFiles}`,
          data,
          headers: {
            Authorization: `Bearer ${getSessionObj('accessToken')}`
          }
        });
        if (response?.data?.status === 200) {
          const resp = response?.data?.data;
          resp?.screens?.forEach((testStep) => {
            if (testStep?.testscreenshotfile) {
              images[testStep?.testStepId] = testStep?.testscreenshotfile;
            }
          });

          resp?.logs?.forEach((testStep) => {
            if (testStep?.testlogfile) {
              logs[testStep?.testStepId] = [testStep?.testlogfile];
            }
          });
        }
        if (images?.length !== 0) dispatch(getTestStepEvidences(images));
        if (logs?.length !== 0) dispatch(getTestStepLogs(logs));
        dispatch(geTtestCaseEvidencesFetched(true));
      } catch (error) {
        dispatch(geTtestCaseEvidencesFetched(true));
      }
    }
  };

  useEffect(() => {
    const intialize = async () => {
      if (!testStepResults) {
        if (evidencesFetched) {
          if (testStepResults?.length !== 0)
            setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.TESTSTEP_RESULTS, testStepResults);
          setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.EVIDENCES_FETCHED, evidencesFetched);
          if (testStepDetails?.length !== 0)
            setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.TESTSTEP_DETAILS, testStepDetails);
          if (testStepLogs?.length !== 0)
            setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.TESTSTEP_LOGS, testStepLogs);
          setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_FUNCTION, currentFunction);
          setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.TESTCASE_EVIDENCES_FECTHED, testCaseEvidencesFetched);
        } else if (isTestCaseDetails) {
          const testStepResults = await getIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.TESTSTEP_RESULTS);
          if (testStepResults) dispatch(getTestStepEvidences(testStepResults));
          await getIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.EVIDENCES_FETCHED);
          const testStepDetails = await getIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.TESTSTEP_DETAILS);
          if (testStepDetails) dispatch(getTestStepDetails(testStepDetails));
          const testStepLogs = await getIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.TESTSTEP_LOGS);
          if (testStepLogs) dispatch(getTestStepLogs(testStepLogs));
          const currentFunction = await getIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_FUNCTION);
          if (currentFunction) dispatch(getCurrentFunction(currentFunction));
          const payload = { testcaseevidences: [], testCaseEvidencesFetched: true };
          dispatch(getTestCaseEvidences(payload));
        }
      }
    };
    intialize();
  }, [
    dispatch,
    currentFunction,
    isTestCaseDetails,
    testStepDetails,
    evidencesFetched,
    testCaseEvidencesFetched,
    testStepLogs,
    testStepResults
  ]);

  useEffect(() => {
    const intialize = async () => {
      if (testCase) {
        setIsSpinnerLoading(true);
        dispatch(getTestStepDetails([]));
        let mId = testCase.moduleId;
        let currentModuleId = currentModule?._id;
        if (!currentModuleId) currentModuleId = JSON.parse(getSessionObj(INDEXEDDB_KEYS.CURRENT_MODULE))?._id;
        let jobId = testCase?.jobId;
        if (!jobId) jobId = testRunId;
        if (!jobId) {
          const localTestRun = await getIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_TESTRUN);
          jobId = localTestRun?._id;
        }
        if (!mId) {
          mId = moduleId;
          jobId = 0;
        }

        if (currentModuleId && isModule && mId !== currentModuleId) {
          mId = currentModuleId;
        }
        if (testCase?.moduleId) {
          mId = testCase?.moduleId;
        }
        const data = await getTestCaseDetails(jobId, mId, testCase._id);
        dispatch(getTestStepDetails(data?.testCaseSteps));
        setIsSpinnerLoading(false);
        const testStepFiles = data?.testCaseSteps[0]?.testStepResultsFile;
        if (testStepFiles) {
          const values = testStepFiles?.split(/[\\/]/);
          const jobId = values[1];
          const moduleId = values[2];
          const testNodeId = values[3];
          const formData = { jobId, moduleId, testNodeId };
          getTestStepResults(formData);
          dispatch(geTtestCaseEvidencesFetched(true));
          setNData(formData);
        }
      }
    };
    intialize();
  }, [testCase]);

  const openScreenshot = async (testStepId, fileType = 'screenshot') => {
    const data = { ...formData, ...ndata, testStepId, fileType };

    // Add immutably
    setClickedOn((prev) => [...prev, testStepId]);
    console.log('Added:', testStepId);

    try {
      const response = await axios({
        method: 'post',
        url: `${API.testRun.getScreenshot}`,
        data,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });

      const screenshot = response?.data?.data?.screenshot;
      if (screenshot) openInNewTab(screenshot, testStepId);
    } catch (error) {
      console.log('error', error);
    }

    // Remove immutably
    setClickedOn((prev) => prev.filter((id) => id !== testStepId));
    console.log('Removed:', testStepId);
  };

  return (
    (testStepDetails?.length > 0 || isSpinnerLoading) && (
      <Grid container spacing={3}>
        <Grid item xs={12} md={12}>
          <Stack spacing={2} sx={{ width: 1 }} direction="row" style={{ paddingBottom: '3%' }}>
            <Stack spacing={2} sx={{ width: 1 }}>
              <Typography spacing={2} variant="overline" sx={{ color: 'text.secondary' }}>
                Steps
              </Typography>
            </Stack>
            {!isModule && (
              <>
                <Stack spacing={2} sx={{ width: 1 }} style={{ paddingLeft: '60%' }}>
                  <Typography spacing={2} variant="overline" sx={{ color: 'text.secondary' }}>
                    Status
                  </Typography>
                </Stack>

                <Stack spacing={1} sx={{ width: 1 }} style={{ paddingLeft: '3%' }}>
                  <Typography spacing={2} variant="overline" sx={{ color: 'text.secondary' }} />
                </Stack>
                {testCasesConfig?.screenshots && (
                  <Stack spacing={1} sx={{ width: 1 }}>
                    <Typography spacing={2} variant="overline" sx={{ color: 'text.secondary' }}>
                      Screenshot
                    </Typography>
                  </Stack>
                )}
              </>
            )}
          </Stack>
          <SpinnerOverlay loading={isSpinnerLoading} />
          <Stack>
            <Stack spacing={1} alignItems="flex-start">
              <Stepper orientation="vertical" sx={{ width: '100%' }}>
                {!showMore &&
                  isModule &&
                  testStepDetails?.slice(0, 5).map((testCaseStep, index) => (
                    <Step key={index} active>
                      <StepLabel>
                        <Stack direction="row">
                          <Stack sx={{ margin: 1.1 }} style={{ width: '70%' }}>
                            {testCaseStep.description}
                          </Stack>

                          {!isModule && (
                            <>
                              <Stack sx={{ margin: 1.5 }}>
                                {testCaseStep.status && testCaseStep.status !== 'UNTESTED' ? (
                                  <>
                                    <Label
                                      variant="ghost"
                                      sx={{
                                        textTransform: 'capitalize',
                                        mx: 'auto',
                                        backgroundColor: STATUS_COLORS[testCaseStep.status || 'UNTESTED'].light,
                                        color: STATUS_COLORS[testCaseStep.status || 'UNTESTED'].highlight
                                      }}
                                    >
                                      {testCaseStep.status || 'UNTESTED'}
                                    </Label>
                                  </>
                                ) : (
                                  <Label
                                    variant="ghost"
                                    sx={{ textTransform: 'capitalize', mx: 'auto' }}
                                    style={{
                                      backgroundColor: '#9A9B9C'
                                    }}
                                  >
                                    {testCaseStep.status || 'UNTESTED'}
                                  </Label>
                                )}
                              </Stack>
                              {testCasesConfig?.screenshots && (
                                <Stack
                                  style={{ paddingLeft: testCaseStep.status === JOB_STATUS.SKIPPED ? '18%' : '13%' }}
                                >
                                  <AvatarGroup
                                    max={4}
                                    sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}
                                    style={{ flexDirection: 'row' }}
                                  >
                                    {testStepResults[testCaseStep._id]?.map((image) => (
                                      <>
                                        {clickedOn.includes(testCaseStep._id) && (
                                          <SpinnerOverlay loading={true} key={testCaseStep._id} />
                                        )}
                                        <Avatar
                                          key="image"
                                          alt="image"
                                          src={image}
                                          onClick={() => openScreenshot(testCaseStep._id)}
                                        />
                                      </>
                                    ))}
                                  </AvatarGroup>
                                </Stack>
                              )}
                            </>
                          )}
                        </Stack>
                      </StepLabel>
                    </Step>
                  ))}
                {!showMore &&
                  !isModule &&
                  testStepDetails?.slice(0, 5).map((testCaseStep, index) => (
                    <Step key={index} active>
                      <Accordion>
                        <AccordionSummary
                          expandIcon={<ExpandMore />}
                          aria-controls="panel1a-content"
                          id="panel1a-header"
                        >
                          <StepLabel style={{ width: '100%', height: '20px' }}>
                            <Stack direction="row">
                              <Stack sx={{ margin: 1.1 }} style={{ width: '70%' }}>
                                {testCaseStep.description}
                              </Stack>

                              {!isModule && (
                                <>
                                  <Stack sx={{ margin: 1.5 }}>
                                    {testCaseStep.status && testCaseStep.status !== 'UNTESTED' ? (
                                      <>
                                        <Label
                                          variant="ghost"
                                          sx={{
                                            textTransform: 'capitalize',
                                            mx: 'auto',
                                            backgroundColor: STATUS_COLORS[testCaseStep.status || 'UNTESTED'].light,
                                            color: STATUS_COLORS[testCaseStep.status || 'UNTESTED'].highlight
                                          }}
                                        >
                                          {testCaseStep.status || 'UNTESTED'}
                                        </Label>
                                      </>
                                    ) : (
                                      <Label
                                        variant="ghost"
                                        sx={{ textTransform: 'capitalize', mx: 'auto' }}
                                        style={{
                                          backgroundColor: '#9A9B9C'
                                        }}
                                      >
                                        {testCaseStep.status || 'UNTESTED'}
                                      </Label>
                                    )}
                                  </Stack>
                                  {testCasesConfig?.screenshots && (
                                    <Stack
                                      style={{
                                        paddingLeft: testCaseStep.status === JOB_STATUS.SKIPPED ? '18%' : '13%'
                                      }}
                                    >
                                      <AvatarGroup
                                        max={4}
                                        sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}
                                        style={{ flexDirection: 'row' }}
                                      >
                                        {testStepResults[testCaseStep._id]?.map((image) => (
                                          <>
                                            {clickedOn.includes(testCaseStep._id) && (
                                              <SpinnerOverlay loading={true} key={testCaseStep._id} />
                                            )}
                                            <Avatar
                                              key="image"
                                              alt="image"
                                              src={image}
                                              onClick={() => openScreenshot(testCaseStep._id)}
                                            />
                                          </>
                                        ))}
                                      </AvatarGroup>
                                    </Stack>
                                  )}
                                </>
                              )}
                            </Stack>
                          </StepLabel>
                        </AccordionSummary>
                        <AccordionDetails>
                          {' '}
                          {!evidencesFetched && (
                            <Box sx={{ display: 'flex' }}>
                              <CircularProgress />
                            </Box>
                          )}
                          {evidencesFetched && testStepResults[testCaseStep._id] && testCasesConfig?.logs && (
                            <>
                              {testStepLogs[testCaseStep._id] && (
                                <>
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
                                      resize: 'vertical',
                                      color: '#1C2025',
                                      background: '#fff',
                                      border: '1px solid #DAE2ED',
                                      boxShadow: '0px 2px 2px #F3F6F9',
                                      overflowY: 'scroll',
                                      height: '250px'
                                    }}
                                  >
                                    {testStepLogs[testCaseStep._id]
                                      .join(' ')
                                      .split('\n')
                                      .map((line) =>
                                        highlight.find((text) => line.toLowerCase().includes(text.toLowerCase())) ? (
                                          <Stack
                                            style={{
                                              color:
                                                (testCaseStep.status === 'PASSED' && '#229A16') ||
                                                (testCaseStep.status === 'FAILED' && '#B72103'),
                                              backgroundColor:
                                                (testCaseStep.status === 'PASSED' && '#e4f8dd') ||
                                                (testCaseStep.status === 'FAILED' && '#ffe2e1'),
                                              fontWeight: '500'
                                            }}
                                          >
                                            {line}
                                          </Stack>
                                        ) : (
                                          <Stack>{line}</Stack>
                                        )
                                      )}
                                  </div>
                                  {/* {testCaseStep.status === JOB_STATUS.FAILED && (
                                    <Button
                                      // form="save-test-data"
                                      variant="contained"
                                      type="submit"
                                      color="error"
                                      style={{ marginTop: '2%', marginLeft: '50%' }}
                                      onClick={() => {
                                        // setOpen(true);
                                        getTestStepDesc(testCaseStep?._id);
                                      }}
                                    >
                                      Create Issue
                                    </Button>
                                  )} */}
                                </>
                              )}
                            </>
                          )}
                          {evidencesFetched && !testStepResults[testCaseStep._id] && 'No evidence found'}
                        </AccordionDetails>
                      </Accordion>
                    </Step>
                  ))}

                {showMore &&
                  isModule &&
                  testStepDetails?.map((testCaseStep, index) => (
                    <Step key={index} active>
                      <StepLabel>
                        <Stack direction="row">
                          <Stack sx={{ margin: 1.1 }} style={{ width: '70%' }}>
                            {testCaseStep.description}
                          </Stack>
                          {!isModule && (
                            <>
                              <Stack sx={{ margin: 1.5 }}>
                                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                                  {testCaseStep.status || 'UNTESTED'}
                                </Typography>
                              </Stack>

                              <Stack style={{ paddingLeft: '5%' }}>
                                <AvatarGroup
                                  max={4}
                                  sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}
                                  style={{ flexDirection: 'row' }}
                                >
                                  {testStepResults[testCaseStep._id]?.map((image) => (
                                    <>
                                      {clickedOn.includes(testCaseStep._id) && (
                                        <SpinnerOverlay loading={true} key={testCaseStep._id} />
                                      )}

                                      <Avatar
                                        key="image"
                                        alt="image"
                                        src={image}
                                        onClick={() => openScreenshot(testCaseStep._id)}
                                      />
                                    </>
                                  ))}
                                </AvatarGroup>
                              </Stack>
                            </>
                          )}
                        </Stack>
                      </StepLabel>
                    </Step>
                  ))}

                {showMore &&
                  !isModule &&
                  testStepDetails?.map((testCaseStep, index) => (
                    <Step key={index} active>
                      <Accordion>
                        <AccordionSummary
                          expandIcon={<ExpandMore />}
                          aria-controls="panel1a-content"
                          id="panel1a-header"
                        >
                          <StepLabel style={{ width: '100%', height: '20px' }}>
                            <Stack direction="row">
                              <Stack sx={{ margin: 1.1 }} style={{ width: '70%' }}>
                                {testCaseStep.description}
                              </Stack>
                              {!isModule && (
                                <>
                                  <Stack sx={{ margin: 1.5 }}>
                                    {testCaseStep.status && testCaseStep.status !== 'UNTESTED' ? (
                                      <>
                                        <Label
                                          variant="ghost"
                                          sx={{
                                            textTransform: 'capitalize',
                                            mx: 'auto',
                                            backgroundColor: STATUS_COLORS[testCaseStep.status || 'UNTESTED'].light,
                                            color: STATUS_COLORS[testCaseStep.status || 'UNTESTED'].highlight
                                          }}
                                        >
                                          {testCaseStep.status || 'UNTESTED'}
                                        </Label>
                                      </>
                                    ) : (
                                      <Label
                                        variant="ghost"
                                        sx={{ textTransform: 'capitalize', mx: 'auto' }}
                                        style={{
                                          backgroundColor: '#9A9B9C'
                                        }}
                                      >
                                        {testCaseStep.status || 'UNTESTED'}
                                      </Label>
                                    )}
                                  </Stack>
                                  {testCasesConfig?.screenshots && (
                                    <Stack
                                      style={{
                                        paddingLeft: testCaseStep.status === JOB_STATUS.SKIPPED ? '18%' : '13%'
                                      }}
                                    >
                                      <AvatarGroup
                                        max={4}
                                        sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}
                                        style={{ flexDirection: 'row' }}
                                      >
                                        {testStepResults[testCaseStep._id]?.map((image) => (
                                          <>
                                            {clickedOn.includes(testCaseStep._id) && (
                                              <SpinnerOverlay loading={true} key={testCaseStep._id} />
                                            )}
                                            <Avatar
                                              key="image"
                                              alt="image"
                                              src={image}
                                              onClick={() => openScreenshot(testCaseStep._id)}
                                            />
                                          </>
                                        ))}
                                      </AvatarGroup>
                                    </Stack>
                                  )}
                                </>
                              )}
                            </Stack>
                          </StepLabel>
                        </AccordionSummary>
                        <AccordionDetails>
                          {!evidencesFetched && (
                            <Box sx={{ display: 'flex' }}>
                              <CircularProgress />
                            </Box>
                          )}

                          {evidencesFetched && testStepResults[testCaseStep._id] && testCasesConfig?.logs && (
                            <>
                              {/* {testStepLogs[testCaseStep._id] && (
                                <>
                                  <Textarea
                                    aria-label="minimum height"
                                    minRows={3}
                                    maxRows={8}
                                    disabled
                                    defaultValue={testStepLogs[testCaseStep._id]}
                                  />
                                </>
                              )} */}
                              {testStepLogs[testCaseStep._id] && (
                                <>
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
                                      resize: 'vertical',
                                      color: '#1C2025',
                                      background: '#fff',
                                      border: '1px solid #DAE2ED',
                                      boxShadow: '0px 2px 2px #F3F6F9',
                                      overflowY: 'scroll',
                                      height: '250px'
                                    }}
                                  >
                                    {testStepLogs[testCaseStep._id]
                                      .join(' ')
                                      .split('\n')
                                      .map((line) =>
                                        highlight.find((text) => line.toLowerCase().includes(text.toLowerCase())) ? (
                                          <Stack
                                            style={{
                                              color:
                                                (testCaseStep.status === 'PASSED' && '#229A16') ||
                                                (testCaseStep.status === 'FAILED' && '#B72103'),
                                              backgroundColor:
                                                (testCaseStep.status === 'PASSED' && '#e4f8dd') ||
                                                (testCaseStep.status === 'FAILED' && '#ffe2e1'),
                                              fontWeight: '500'
                                            }}
                                          >
                                            {line}
                                          </Stack>
                                        ) : (
                                          <Stack>{line}</Stack>
                                        )
                                      )}
                                  </div>
                                </>
                              )}
                            </>
                          )}
                          {evidencesFetched && !testStepResults[testCaseStep._id] && 'No evidence found'}
                        </AccordionDetails>
                      </Accordion>
                    </Step>
                  ))}
                {/* {testStepDesc && (
                  <DefectCreation open={open} setOpen={setOpen} testCase={testCase} testStepDesc={testStepDesc} />
                )} */}
              </Stepper>
              {testStepDetails?.length > 5 && (
                <Link style={{ cursor: 'pointer' }} onClick={handleShowMore}>
                  {showMoreText}
                </Link>
              )}
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    )
  );
}
