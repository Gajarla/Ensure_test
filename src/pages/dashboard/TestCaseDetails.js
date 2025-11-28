import { useState, useEffect, useCallback } from 'react';
// material
import { Container, Grid } from '@mui/material';
// hooks
import { useParams, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
// import axios from 'axios';
import axios from '../../utils/axiosInstance';
import useSettings from '../../hooks/useSettings';

import { useDispatch, useSelector } from '../../redux/store';
import { getUserPosts } from '../../redux/slices/user';
import {
  getTestCaseEvidences,
  getTestStepEvidences,
  getTestStepLogs,
  getTestStepDetails,
  getTestCaseDetails,
  geTtestCaseEvidencesFetched,
  setTestCaseDetails
} from '../../redux/slices/testRun';
import { setPageConfig, setTestCasesConfig } from '../../redux/slices/role';

// components
import Page from '../../components/Page';
import { TestCaseDetailHead, TestCaseDetailSteps, TestCaseDetailSections } from '../../components/_dashboard/testCases';
import API from '../../services';
import { setSessionObj, getSessionObj } from '../../utils/jwt';
import { getIndexedDBObject } from '../../main';
import { JOB_STATUS, IndexedDB, INDEXEDDB_KEYS } from '../../Constants';

// ----------------------------------------------------------------------

TestCaseDetails.propTypes = {
  testCase: PropTypes.object,
  testRunId: PropTypes.string,
  moduleId: PropTypes.string,
  getTestCaseResults: PropTypes.func,
  setOpenDetails: PropTypes.func
};

export default function TestCaseDetails({ testCase, testRunId, moduleId, setOpenDetails, formData }) {
  const { pathname } = useLocation();
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { posts } = useSelector((state) => state.user);
  const { testCaseId } = useParams();
  const isModule = pathname.includes('module');
  const { rows } = useSelector((state) => state.testRun);
  const [selectedTestCase, setSelectedTestCase] = useState(null);
  const { testCasesConfig } = useSelector((state) => state.role);
  const { roleConfig } = useSelector((state) => state.role);
  const allTestRuns = useSelector((state) => state.testRun.allTestRuns);
  const testCaseDetails = useSelector((state) => state.testRun.testCaseDetails);
  const currentRun = useSelector((state) => state.testRun.currentTestRun);
  const updatedTestCases = { ...useSelector((state) => state.testRun?.updatedTestCases) };
  const currentRunId = currentRun?._id;

  const setTestCase = useCallback(async () => {
    const testCase = rows?.find((row) => row._id === testCaseId);
    setSelectedTestCase(testCase);
    if (!testCase) {
      const testCase = await getIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.SELECTED_TESTCASE);
      setSelectedTestCase(testCase);
    }
    if (testCase) setSessionObj('selectedTestCase', JSON.stringify(testCase));
    if (!testCase) {
      const testCase = JSON.parse(getSessionObj('selectedTestCase'));
      setSelectedTestCase(testCase);
      setDefaultStepStatus(testCase?._id, [testCase]);
    }
  }, [rows, testCaseId]);

  const updateRunHistory = useCallback(() => {
    try {
      if (
        !testCaseDetails?.runHistory ||
        (testCaseDetails?.runHistory && testCaseDetails.testNodeID !== testCaseDetails?.runHistory[0]?.testNodeID)
      ) {
        const testRunHistory = [];
        allTestRuns?.forEach((run, index) => {
          if (parseInt(index, 10) <= allTestRuns.length) {
            const { releaseID, releaseName, jenkinsJobID, moduleID, testNodes, updatedAt, createdAt } = run;
            const nodeIndex = testNodes.findIndex((node) => node.testNodeID === testCase?.id);
            if (parseInt(nodeIndex, 10) >= 0) {
              const currentNode = testNodes[nodeIndex];
              const { testNodeID, status, dateStatusLastUpdated } = currentNode;
              testRunHistory?.push({
                releaseID,
                releaseName,
                jenkinsJobID,
                moduleID,
                testNodeID,
                result: status,
                dateStatusLastUpdated: dateStatusLastUpdated || updatedAt || createdAt
              });
              const $testCaseDetails = { ...testCaseDetails };
              $testCaseDetails.runHistory = testRunHistory;
              setTestCaseDetails(dispatch, $testCaseDetails);
            }
          }
        });
      }
    } catch (err) {
      console.error('error', err);
    }
  }, [dispatch, allTestRuns, testCase?.id, testCaseDetails]);

  const getTestStepExpected = (testCaseStep) => {
    let testStepDescrptionDisplay;
    const testStepAction = Object.keys(testCaseStep)[1];
    const testStepDescription = findVal(testCaseStep, 'testStepDescription');
    const testStepExpected = findVal(testCaseStep, 'expected');
    if (testStepDescription) {
      testStepDescrptionDisplay = testStepDescription;
    } else if (testStepExpected) {
      testStepDescrptionDisplay = testStepExpected;
    } else {
      testStepDescrptionDisplay = testStepAction;
    }
    return testStepDescrptionDisplay;
  };

  const getTestStepName = (testCaseStep) => {
    const testStepAction = Object.keys(testCaseStep)[1];
    return testStepAction;
  };

  const setDefaultStepStatus = (testCaseId, testCase) => {
    // const testCases = [];
    // const testCase = testCases.filter((testCase) => testCase._id === testCaseId);
    const updatedTestNode = rows.filter((node) => node?._id === testCaseId);
    const $testStepLogs = {};
    const $testStepDetails = [];
    let $testCaseSteps;
    let testStepFiles = null;

    dispatch(getTestStepEvidences({}));
    dispatch(getTestStepLogs({}));

    if (!isModule && !testCase[0]?.testStepStatuses) {
      if (testCase[0]?.testCaseSteps) {
        if (testCase[0]?.testCaseSteps.constructor === Array) {
          const $testStepStatuses = [];
          testCase[0]?.testCaseSteps.forEach((step) => {
            $testStepStatuses.push({
              _id: step?._id,
              status: JOB_STATUS.UNTESTED
            });
          });
          $testCaseSteps = $testStepStatuses;
        } else {
          $testCaseSteps = [{ _id: testCase[0]?.testCaseSteps?._id, status: JOB_STATUS.UNTESTED }];
        }
      }
    } else {
      $testCaseSteps = testCase[0]?.testStepStatuses;
      testCase[0]?.testStepStatuses?.forEach((testStepStatus) => {
        if (testStepStatus?.testStepLogsFile) testStepFiles = testStepStatus?.testStepLogsFile;
        if (testStepStatus?.testStepResultsFile) testStepFiles = testStepStatus?.testStepResultsFile;
      });
    }

    // const testStepsWithDescIndex = rows.findIndex((testNode) => testNode._id === testCaseId);
    let testStepsWithDesc = testCase[0].testCaseSteps;
    if (!isModule) {
      if (testStepsWithDesc) {
        if (testStepsWithDesc instanceof Array) {
          testStepsWithDesc = testStepsWithDesc.filter(
            (testStep) =>
              (!Object.keys(testStep).includes('sleep') &&
                !Object.keys(testStep).includes('frameSwitch') &&
                !Object.keys(testStep).includes('keyBoardEvent')) ||
              Object.keys(testStep).includes('manual')
          );

          testStepsWithDesc.forEach((step) => {
            const stepWithStatusIndex = $testCaseSteps?.findIndex((Statusstep) => Statusstep._id === step?._id);
            if (stepWithStatusIndex || stepWithStatusIndex === 0) {
              const stepWitStatus = $testCaseSteps[stepWithStatusIndex];
              $testStepDetails.push({
                _id: step?._id,
                name: getTestStepName(step),
                description: getTestStepExpected(step),
                status: stepWitStatus?.status
              });
            }
          });
        } else {
          testStepsWithDesc =
            (!Object.keys(testStepsWithDesc).includes('sleep') &&
              !Object.keys(testStepsWithDesc).includes('frameSwitch') &&
              !Object.keys(testStepsWithDesc).includes('keyBoardEvent')) ||
            (Object.keys(testStepsWithDesc).includes('manual') && testStepsWithDesc);
          if (testStepsWithDesc) {
            $testStepDetails.push({
              _id: testStepsWithDesc?._id,
              name: getTestStepName(testStepsWithDesc),
              description: getTestStepExpected(testStepsWithDesc),
              status: testStepsWithDesc?.status
            });
          }
        }

        if ($testStepDetails) {
          const updatedTestStepStatuses = testCase[0]?.testStepStatuses;
          if (updatedTestStepStatuses && $testStepDetails.constructor === Array) {
            Object.keys(updatedTestStepStatuses)?.forEach((stepId) => {
              const stepIndex = $testStepDetails.findIndex((step) => step?._id === stepId);
              if (stepIndex >= 0) {
                $testStepDetails[stepIndex] = {
                  ...$testStepDetails[stepIndex],
                  status: updatedTestStepStatuses[stepId]
                };
              }
            });
          }
        }
        dispatch(getTestStepDetails($testStepDetails));
        $testCaseSteps?.forEach((step) => {
          $testStepLogs[step?._id] = step?.log;
        });
        dispatch(getTestStepLogs($testStepLogs));
      }

      let testCaseResultsFile;
      let testCaseLogsFile;
      if (testCase[0]?.testCaseResultsFile) {
        testCaseResultsFile = testCase[0]?.testCaseResultsFile;
      } else if (updatedTestCases && updatedTestCases[testCaseId]) {
        testCaseResultsFile = updatedTestCases[testCaseId];
      }

      if (testCase[0]?.testCaseLogsFile) {
        testCaseLogsFile = testCase[0]?.testCaseLogsFile;
      } else if (updatedTestCases && updatedTestCases[testCaseId]) {
        testCaseLogsFile = updatedTestCases[testCaseId];
      }

      if (testCase[0]?.testCaseLogsFile) {
        testCaseLogsFile = testCase[0]?.testCaseLogsFile;
      }
      dispatch(getTestStepEvidences({}));

      if (testCaseResultsFile) {
        getTestCaseResults(testCaseResultsFile);
        if (testCaseLogsFile) {
          getTestCaseLogs(testCaseLogsFile);
        }
      } else {
        const payload = { testcaseevidences: [], testCaseEvidencesFetched: true };
        dispatch(getTestCaseEvidences(payload));
      }
    } else {
      // all modules functionality

      if (testStepsWithDesc) {
        if (testStepsWithDesc instanceof Array) {
          testStepsWithDesc = testStepsWithDesc.filter(
            (testStep) =>
              (!Object.keys(testStep).includes('sleep') &&
                !Object.keys(testStep).includes('frameSwitch') &&
                !Object.keys(testStep).includes('keyBoardEvent')) ||
              Object.keys(testStep).includes('manual')
          );
          testStepsWithDesc.forEach((step) => {
            $testStepDetails.push({
              _id: step?._id,
              name: getTestStepName(step),
              description: getTestStepExpected(step)
            });
          });
        } else {
          testStepsWithDesc =
            (!Object.keys(testStepsWithDesc).includes('sleep') &&
              !Object.keys(testStepsWithDesc).includes('frameSwitch') &&
              !Object.keys(testStepsWithDesc).includes('keyBoardEvent')) ||
            (Object.keys(testStepsWithDesc).includes('manual') && testStepsWithDesc);
          if (testStepsWithDesc) {
            $testStepDetails.push({
              _id: testStepsWithDesc?._id,
              name: getTestStepName(testStepsWithDesc),
              description: getTestStepExpected(testStepsWithDesc)
            });
          }
        }
      }
      dispatch(getTestStepDetails($testStepDetails));
    }

    if (testStepFiles) {
      const values = testStepFiles?.split('/');
      const jobId = values[1];
      const moduleId = values[2];
      const testNodeId = values[3];
      const formData = { jobId, moduleId, testNodeId };
      getTestStepResults(formData);
    }

    dispatch(
      getTestCaseDetails({
        ...testCaseDetails,
        testNodeID: testCase[0]?.id,
        testCaseId: testCase[0]?._id,
        moduleId: testCase[0]?.moduleId,
        screenShotComments: testCase[0]?.screenShotComments,
        status: updatedTestNode[0]?.status,
        testCaseResultsFile: testCase[0]?.testCaseResultsFile,
        dateStatusLastUpdated: updatedTestNode[0]?.dateStatusLastUpdated
      })
    );
  };

  const getTestCaseLogs = async (fileName) => {
    const tempStepFileData = {};
    if (fileName) {
      try {
        const response = await axios({
          method: 'get',
          url: `${API.testRun.getTestCaseLogs(fileName)}`,
          headers: {
            Authorization: `Bearer ${getSessionObj('accessToken')}`
          }
        });

        let testResults;
        let testCases;
        let testSteps;
        let $testResults = [];

        if (response?.data?.length > 0) {
          testResults = response?.data.split('**TestResults**');
          // testResults = testResults.filter((entry) => entry.trim() !== '');
          if (testResults) {
            testCases = testResults[0].split(' ');
            testCases = testCases.filter((entry) => entry.trim() !== '');
            if (testResults[1]) {
              testSteps = testResults[1].split('&&');
              testSteps = testSteps.filter((entry) => entry.trim() !== '');
            }
          }

          if (testCases) {
            $testResults = [];
            testCases.forEach((test) => {
              if (test.trim()) {
                $testResults.push(test.trim());
              }
            });

            const payload = { testcaseevidences: $testResults, testCaseEvidencesFetched: true };
            dispatch(getTestStepLogs(payload));
          }

          /** steps Logic */
          if (testSteps) {
            const cleanTestSteps = testSteps.filter((entry) => entry.trim() !== '');

            cleanTestSteps.forEach((step) => {
              const cleanStepData = step.split(' ').filter((entry) => entry.trim() !== '');

              const stepId = cleanStepData[0].trim();
              const stepFiles = cleanStepData.slice(1).map((file) => file.trim());

              if (tempStepFileData[stepId]) {
                if (stepFiles.constructor === Array && tempStepFileData[stepId].constructor === Array) {
                  tempStepFileData[stepId] = [...tempStepFileData[stepId], ...stepFiles];
                } else if (stepFiles.constructor === Array && tempStepFileData[stepId].constructor !== Array) {
                  const currentStepFiles = [...stepFiles];
                  currentStepFiles.push(tempStepFileData[stepId]);
                  tempStepFileData[stepId] = currentStepFiles;
                } else if (stepFiles.constructor !== Array && tempStepFileData[stepId].constructor === Array) {
                  const currentStepFiles = [...tempStepFileData[stepId]];
                  currentStepFiles.push(stepFiles);
                  tempStepFileData[stepId] = currentStepFiles;
                }
              } else {
                tempStepFileData[stepId] = stepFiles;
              }
            });

            dispatch(getTestStepLogs(tempStepFileData));
          }
        } else {
          const payload = { testcaseevidences: [], testCaseEvidencesFetched: true };
          dispatch(getTestCaseEvidences(payload));
        }
      } catch (error) {
        console.log('error = ', error);
      }
    }
  };

  const findVal = (object, key) => {
    let value;
    Object.keys(object).some((k) => {
      if (k === key) {
        value = object[k];
        return true;
      }
      if (object[k] && typeof object[k] === 'object') {
        value = findVal(object[k], key);
        return value !== undefined;
      }
      return value;
    });
    return value;
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
        if (images) dispatch(getTestStepEvidences(images));
        if (logs) dispatch(getTestStepLogs(logs));
        dispatch(geTtestCaseEvidencesFetched(true));
      } catch (error) {
        dispatch(geTtestCaseEvidencesFetched(true));
      }
    }
  };

  const getTestCaseResults = useCallback(
    async (fileName) => {
      const tempStepFileData = {};
      if (fileName) {
        try {
          const response = await axios({
            method: 'get',
            url: `${API.testRun.getTestCaseResults(fileName)}`,
            headers: {
              Authorization: `Bearer ${getSessionObj('accessToken')}`
            }
          });
          let testResults;
          let testCases;
          let testSteps;
          let $testResults = [];

          if (response?.data?.length > 0) {
            testResults = response?.data.split('**TestResults**');
            if (testResults) {
              testCases = testResults[0].split(' ');
              testCases = testCases.filter((entry) => entry.trim() !== '');
              if (testResults[1]) {
                testSteps = testResults[1].split('&&');
                testSteps = testSteps.filter((entry) => entry.trim() !== '');
              }
            }

            if (testCases) {
              $testResults = [];
              testCases.forEach((test) => {
                if (test.trim()) {
                  $testResults.push(test.trim());
                }
              });

              const payload = { testcaseevidences: $testResults, testCaseEvidencesFetched: true };
              dispatch(getTestCaseEvidences(payload));
            }

            /** steps Logic */
            if (testSteps) {
              const cleanTestSteps = testSteps.filter((entry) => entry.trim() !== '');

              cleanTestSteps.forEach((step) => {
                const cleanStepData = step.split(' ').filter((entry) => entry.trim() !== '');

                const stepId = cleanStepData[0].trim();
                const stepFiles = cleanStepData.slice(1).map((file) => file.trim());

                if (tempStepFileData[stepId]) {
                  if (stepFiles.constructor === Array && tempStepFileData[stepId].constructor === Array) {
                    tempStepFileData[stepId] = [...tempStepFileData[stepId], ...stepFiles];
                  } else if (stepFiles.constructor === Array && tempStepFileData[stepId].constructor !== Array) {
                    const currentStepFiles = [...stepFiles];
                    currentStepFiles.push(tempStepFileData[stepId]);
                    tempStepFileData[stepId] = currentStepFiles;
                  } else if (stepFiles.constructor !== Array && tempStepFileData[stepId].constructor === Array) {
                    const currentStepFiles = [...tempStepFileData[stepId]];
                    currentStepFiles.push(stepFiles);
                    tempStepFileData[stepId] = currentStepFiles;
                  }
                } else {
                  tempStepFileData[stepId] = stepFiles;
                }
              });

              dispatch(getTestStepEvidences(tempStepFileData));
            }
          } else {
            const payload = { testcaseevidences: [], testCaseEvidencesFetched: true };
            dispatch(getTestCaseEvidences(payload));
          }
        } catch (error) {
          console.error('error = ', error);
        }
      }
    },
    [dispatch]
  );

  useEffect(() => {
    getUserPosts(dispatch);
    if (testCase) setSelectedTestCase(testCase);
    else setTestCase();
    return () => {
      // cleanup code here
    };
  }, [dispatch, testCase, setTestCase]);

  useEffect(() => {
    updateRunHistory();
    return () => {
      // cleanup code here
    };
  }, [updateRunHistory]);

  useEffect(() => {
    const fetchData = async () => {
      if (!testCasesConfig) {
        const localRelease = await getIndexedDBObject(IndexedDB.RELEASE, INDEXEDDB_KEYS.CURRENT_RELEASE);
        if (localRelease) {
          setPageConfig(dispatch, roleConfig?.releases);
          setTestCasesConfig(dispatch, roleConfig?.releaseTestCases);
          console.log('Updated testCasesConfig:', roleConfig?.releaseTestCases); // Log to see if data is correct
        }
        const localTestRun = await getIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_TESTRUN);
        if (localTestRun) {
          dispatch(setPageConfig(roleConfig?.testRuns));
          dispatch(setTestCasesConfig(roleConfig?.testRunsTestCases));
          console.log('Updated testCasesConfig from testRun:', roleConfig?.testRunsTestCases); // Log data from test run
        }
      }
    };

    fetchData();
  }, [dispatch, roleConfig, testCasesConfig]);

  return (
    <Page title="TestEnsure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <Grid container spacing={4} sx={{ pt: 2 }}>
          <Grid item xs={12} md={12}>
            <TestCaseDetailHead
              testCase={selectedTestCase}
              testRunId={testRunId || currentRunId}
              moduleId={moduleId}
              setSelectedTestCase={setSelectedTestCase}
              getTestCaseResults={getTestCaseResults}
              getTestStepResults={getTestStepResults}
              setDefaultStepStatus={setDefaultStepStatus}
            />
          </Grid>
          <Grid item xs={12} md={12}>
            <TestCaseDetailSteps testCase={selectedTestCase} formData={formData} />
          </Grid>
          <Grid item xs={12} md={12}>
            <TestCaseDetailSections posts={posts} setOpenDetails={setOpenDetails} testCase={selectedTestCase} />
          </Grid>
        </Grid>
      </Container>
    </Page>
  );
}
