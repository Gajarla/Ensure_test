import { useState, useEffect } from 'react';
import { sample } from 'lodash';
import moment from 'moment';
import { useSnackbar } from 'notistack';
// material
import {
  Box,
  Tooltip,
  Pagination,
  Typography,
  TextField,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { useFormik } from 'formik';
import {
  DataGrid,
  // useGridSlotComponentProps,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridSaveAltIcon,
  useGridApiContext,
  useGridSelector,
  gridPageSelector,
  gridPageCountSelector,
  gridPageSizeSelector,
  gridRowCountSelector
} from '@mui/x-data-grid';

import Button from '@mui/material/Button';
import { Menu, MenuItem } from '@mui/material';
import { Icon } from '@iconify/react';
import arrowUpwardFill from '@iconify/icons-eva/arrow-upward-fill';
import { useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
// utils
// components
import * as Yup from 'yup';
import PropTypes from 'prop-types';
import checkmarkCircle2Fill from '@iconify/icons-eva/checkmark-circle-2-fill';
import { exportTestCasesWithSteps } from '../../../../redux/slices/common';
import Label from '../../../../components/Label';
import TestCaseDetails from '../../../dashboard/TestCaseDetails';
import {
  getTestCaseEvidences,
  getTestStepEvidences,
  getTestStepLogs,
  getCurrentFunction,
  getTestStepDetails,
  getTestCaseDetails,
  geTtestCaseEvidencesFetched
} from '../../../../redux/slices/testRun';

import { exportTestRunResults, handleExportedFileDownload } from '../../../../_apis_/testRun';
import { useDispatch, useSelector } from '../../../../redux/store';
import API from '../../../../services';
import { getSessionObj } from '../../../../utils/jwt';
import TestCaseScreenShotsUpload from '../../../../components/_dashboard/testCases/TestCaseScreenShotsUpload';
import { JOB_STATUS, STATUS_COLORS, IndexedDB, INDEXEDDB_KEYS, STATUS_CODES as STATUS } from '../../../../Constants';
import { setIndexedDBObject, getIndexedDBObject } from '../../../../main';

// ----------------------------------------------------------------------

function RenderPriority(getPriority) {
  return (
    /* eslint-disable */
    <div sx={{ textTransform: 'capitalize', mx: 'auto' }}>
      <Icon
        icon={arrowUpwardFill}
        color={(getPriority === 'P1' && 'red') || (getPriority === 'P2' && 'orange') || 'green'}
      />
      {getPriority}
    </div>
    /* eslint-enable */
  );
}

// ----------------------------------------------------------------------

const STATUS_CODES = STATUS;

// const STATUS_COLORS = {
//   PASSED: {
//     light: '#E6F4EA',
//     highlight: '#36AB51' // green
//   },
//   FAILED: {
//     light: '#FDECEA',
//     highlight: '#F44B25' // red
//   },
//   UNTESTED: {
//     light: '#F2F3F4',
//     highlight: '#9A9B9C' // gray
//   },
//   BLOCKED: {
//     light: '#E0F7FA',
//     highlight: '#16ABC5' // cyan
//   },
//   SKIPPED: {
//     light: '#E3F2FD',
//     highlight: '#42A5F5' // blue
//   },
//   IGNORED: {
//     light: '#FFFDE7',
//     highlight: '#FFD700' // yellow
//   },
//   WARNING: {
//     light: '#FFF3E0',
//     highlight: '#FF9800' // orange
//   }
// };

DataGridCustom.propTypes = {
  testCases: PropTypes.array
};

export default function DataGridCustom({ testCases, page, pageSize, onPageChange, count }) {
  const { pathname } = useLocation();
  const dispatch = useDispatch();
  const { testRunId } = useParams();
  const isTestRun = pathname.includes('testRuns');
  const isModule = pathname.includes('module');
  const testRun = useSelector((state) => state.testRun);
  const { currentTestRun } = useSelector((state) => state.testRun);
  const { currentRelease } = useSelector((state) => state.release);
  const { currentUser } = useSelector((state) => state.user);
  const { defectList } = useSelector((state) => state.defect);
  const rows = testRun?.rows;
  const { enqueueSnackbar } = useSnackbar();
  // const { rows } = useSelector((state) => state.testRun);
  const release = useSelector((state) => state.release);
  const userList = useSelector((state) => state.user.userList);
  const paramObj = useParams();
  const { pageConfig, testCasesConfig } = useSelector((state) => state.role);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState();
  const [fileCreated, setFileCreated] = useState(false);

  const updatedTestCases = { ...useSelector((state) => state.testRun?.updatedTestCases) };
  const testCaseDetails = useSelector((state) => state.testRun.testCaseDetails);

  const handleClickOpen = () => {
    setOpen(true);
  };

  function CustomPagination() {
    // const { state, apiRef } = useGridSlotComponentProps();
    // let pCount = parseInt(state.pagination.pageCount, 10);
    // const testCaseCount = [...new Set(rows?.map((row) => row?.testCaseID))]?.length;
    // if (testCaseCount / state.pagination.pageSize < pCount) {
    //   pCount = parseInt(testCaseCount / state.pagination.pageSize, 10);
    //   if (testCaseCount % state.pagination.pageSize > 0) pCount += 1;
    // }

    // return (
    //   <Pagination
    //     color="primary"
    //     count={pCount}
    //     page={state.pagination.page + 1}
    //     onChange={(event, value) => apiRef.current.setPage(value - 1)}
    //   />
    // );
    const apiRef = useGridApiContext();
    const page = useGridSelector(apiRef, gridPageSelector);
    const pageSize = useGridSelector(apiRef, gridPageSizeSelector);
    const defaultPageCount = useGridSelector(apiRef, gridPageCountSelector);

    // ✅ Compute testCaseCount here without hooks
    const allIds = apiRef.current.getAllRowIds();
    const uniqueTestCases = new Set();

    allIds.forEach((id) => {
      const row = apiRef.current.getRow(id);
      if (row?.testCaseID) uniqueTestCases.add(row.testCaseID);
    });

    const testCaseCount = uniqueTestCases.size;

    // ✅ Calculate pageCount
    let pageCount = defaultPageCount;
    if (testCaseCount > 0) {
      pageCount = Math.ceil(testCaseCount / pageSize);
    }

    return (
      <Pagination
        color="primary"
        count={pageCount}
        page={page + 1}
        onChange={(event, value) => apiRef.current.setPage(value - 1)}
      />
    );
  }

  const renderHeaderLP = (title) => (
    <Tooltip title={title}>
      <Typography
        style={{ fontWeight: '600', width: '100%', fontSize: '0.8rem', paddingLeft: '30%', textAlign: 'center' }}
      >
        {title}
      </Typography>
    </Tooltip>
  );

  const renderHeader = (title) => (
    <Tooltip title={title}>
      <Typography style={{ fontWeight: '600', width: '100%', fontSize: '0.8rem', textAlign: 'center' }}>
        {title}
      </Typography>
    </Tooltip>
  );

  const columns = [
    {
      field: 'id',
      hide: true
    },
    {
      field: 'testCaseId',
      headerName: 'ID',
      disableColumnMenu: true,
      align: 'center',
      valueGetter: (params) => params.getValue(params.id, 'testCaseID'),
      flex: 0,
      // renderHeader: () => renderHeaderLP('ID'),
      renderCell: (params) => {
        const getTestCaseId = params.getValue(params.id, 'testCaseID');
        const _id = params.getValue(params.id, '_id');

        return (
          <Typography
            variant="body2"
            sx={{ color: '#0045ff', fontWeight: '600', cursor: 'pointer' }}
            noWrap
            onClick={() => {
              searchTestCase(_id);
              setDefaultStepStatus(_id);
              handleOpenDetails();
            }}
          >
            {getTestCaseId}
          </Typography>
        );
      }
    },
    {
      field: 'testCaseTitle',
      headerName: 'Test Case',
      flex: 1.25,
      disableColumnMenu: true,
      align: 'center',
      renderHeader: () => renderHeader('Test Case'),
      renderCell: (params) => {
        const testCaseTitle = params.getValue(params.id, 'testCaseTitle');
        return (
          <Tooltip title={testCaseTitle} placement="left-start">
            <Typography sx={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {testCaseTitle}{' '}
            </Typography>
          </Tooltip>
        );
      }
    },
    {
      field: 'suiteName',
      headerName: 'Module',
      flex: 1,
      disableColumnResize: true,
      align: 'center',
      renderHeader: () => (
        <Tooltip title="Module">
          <Typography style={{ fontWeight: '600', width: '100%', fontSize: '0.8rem' }}>Module</Typography>
        </Tooltip>
      ),
      disableColumnMenu: true,
      renderCell: (params) => {
        const suiteName = params.getValue(params.id, 'suiteName');
        return (
          <Tooltip title={suiteName} placement="left-start">
            <Typography sx={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {suiteName}{' '}
            </Typography>
          </Tooltip>
        );
      }
    },
    {
      field: 'priority',
      headerName: 'Priority',
      disableColumnMenu: true,
      // renderHeader: () => renderHeaderLP('Priority'),
      flex: 1,
      align: 'center',
      renderCell: (params) => {
        const getPriority = params.getValue(params.id, 'priority') || sample(['P1', 'P2', 'P3']);
        return RenderPriority(getPriority);
      }
    },
    {
      field: 'automationStatus',
      headerName: 'Automated?',
      flex: 1,
      renderHeader: () => renderHeader('Automated?'),
      disableColumnMenu: true,
      align: 'center',
      renderCell: (params) => {
        const automationStatus = params.getValue(params.id, 'automationStatus');
        return automationStatus ? (
          <Box component={Icon} icon={checkmarkCircle2Fill} sx={{ width: 20, height: 20, color: 'primary.main' }} />
        ) : (
          'No'
        );
      }
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1.25,
      hide: isModule,
      disableColumnMenu: true,
      editable: true,
      // headerAlign: 'center',
      // align: 'center',
      // renderHeader: () => renderHeaderLP('Status'),
      renderCell: (params) => {
        const status = params.getValue(params.id, 'status');
        const _id = params.getValue(params.id, 'id');
        const statusLabel =
          status !== JOB_STATUS.UNTESTED ? (
            <>
              {/* <Label
                variant="ghost"
                color={
                  (status === JOB_STATUS.FAILED && 'error') || (status === JOB_STATUS.SKIPPED && 'warning') || 'success'
                }
                sx={{ textTransform: 'capitalize', mx: 'auto' }}
              >
                {status}
              </Label> */}
              <Label
                variant="ghost"
                sx={{
                  textTransform: 'capitalize',
                  mx: 'auto',
                  backgroundColor: STATUS_COLORS[status].light,
                  color: STATUS_COLORS[status].highlight
                }}
              >
                {status}
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
              {status}
            </Label>
          );
        return isTestRun && pageConfig?.edit ? (
          <TextField
            select
            fullWidth
            value={status}
            SelectProps={{ native: true }}
            onChange={(event) => {
              handleClickOpen();
              handleChangeStatus(event, _id);
            }}
            sx={{
              '& fieldset': { border: '0 !important' },
              '& select': { pl: 1, py: 0.5, pr: '20px !important', typography: 'subtitle2' },
              '& .MuiOutlinedInput-root': { borderRadius: 0.75, bgcolor: 'background.neutral' },
              '& .MuiNativeSelect-icon': { top: 4, right: 0, width: 20, height: 20 }
            }}
          >
            {STATUS_CODES.map((option) => (
              <option key={option.id} value={option.label}>
                {option.label}
              </option>
            ))}
          </TextField>
        ) : (
          statusLabel
        );
      }
    },
    {
      field: 'executionDuration',
      headerName: 'Execution Time',
      renderHeader: () => renderHeader('Execution Time'),
      flex: 1.25,
      align: 'center',
      hide:
        isModule ||
        rows?.filter((row) => row.status === JOB_STATUS.UNTESTED)?.length === rows?.length ||
        rows?.filter((row) => row.automationStatus === false)?.length === rows?.length,
      disableColumnMenu: true,

      renderCell: (params) => {
        const executionDuration = params.getValue(params.id, 'executionDuration');
        return executionDuration;
      }
    }
  ];

  const [openDetails, setOpenDetails] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState(null);

  const handleOpenDetails = () => {
    setOpenDetails(true);
  };

  const handleCloseDetails = () => {
    setOpenDetails(false);
  };

  const TestResultsSchema = Yup.object().shape({
    status: Yup.string().required('Status is required'),
    images: Yup.array().min(1, 'Images is required')
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      images: []
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

  const { setFieldValue } = formik;

  const handleChangeStatus = (event, itemId) => {
    const payload = { testcaseevidences: [], testCaseEvidencesFetched: false };
    const testCaseIndex = rows.findIndex((testCaseObj) => testCaseObj.id === itemId);
    const testCase = rows[testCaseIndex];
    dispatch(getTestCaseEvidences(payload));
    setDefaultStepStatus(testCase?._id);
    setFieldValue('status', testCaseDetails?.status);
    dispatch(
      getTestCaseDetails({
        ...testCaseDetails,
        testNodeID: testCase?.id,
        testCaseId: testCase?._id,
        moduleId: testCase?.moduleId,
        screenShotComments: testCase?.screenShotComments,
        status: testCase?.status,
        testCaseResultsFile: testCase?.testCaseResultsFile,
        selectedTestCaseStatus: event.target.value
      })
    );
  };

  const searchTestCase = (testCaseId) => {
    const testCase = rows?.find((row) => row._id === testCaseId);
    setSelectedTestCase(testCase);
    setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.SELECTED_TESTCASE, testCase);
    const payload = { testcaseevidences: [], testCaseEvidencesFetched: false };
    dispatch(getTestCaseEvidences(payload));
  };

  const setDefaultStepStatus = (testCaseId) => {
    const testCase = testCases.filter((testCase) => testCase._id === testCaseId);
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

    const testStepsWithDescIndex = rows.findIndex((testNode) => testNode._id === testCaseId);
    let testStepsWithDesc = rows[testStepsWithDescIndex].testCaseSteps;
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
          const updatedTestStepStatuses = updatedTestNode[0]?.testStepStatuses;
          if ($testStepDetails.constructor === Array) {
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
      const values = testStepFiles?.split(/[\\/]/);
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

  const getTestCaseResults = async (fileName) => {
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

          if (testCases?.length > 0) {
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
          if (testSteps?.length > 0) {
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
        // dispatch(slice.actions.hasError(error));
        console.log('error = ', error);
      }
    }
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

  useEffect(() => {
    dispatch(getCurrentFunction(''));

    // if (isTestRun) {
    //   const fetchData = async () => {};

    //   fetchData();
    // }

    return () => {}; // cleanup (safe, no error)
  }, [dispatch, isTestRun]);

  // Function to access testCaseSteps and testStepStatuses in an easier way
  const modifyRows = (rows) => {
    const finalRows = [];
    let step;
    let obj;
    let k;
    for (let i = 0; i < rows.length; i += 1) {
      const testCaseSteps = [];
      const testCaseStepsStatuses = [];
      const issueLink = [];
      const stepNum = [];
      k = 0;
      if (rows[i]?.testCaseSteps?.length > 0) {
        for (let j = 0; j < rows[i].testCaseSteps.length; j += 1) {
          step = findVal(rows[i].testCaseSteps[j], 'testStepDescription');
          if (step !== undefined) {
            testCaseSteps.push(step);
            k += 1;
            stepNum.push(k);
            if (rows[i]?.testStepStatuses?.length > 0) {
              if (rows[i].testStepStatuses[j]?.status) testCaseStepsStatuses.push(rows[i].testStepStatuses[j].status);
              if (rows[i].testStepStatuses[j]?.status === JOB_STATUS.FAILED)
                issueLink.push({
                  text: `View Issue - ${defectList[0]?.defectTrack?.key}`,
                  hyperlink: defectList[0]?.defectUrl
                });
              else issueLink.push('');
            }
          }
        }
      }
      obj = {
        testCaseID: rows[i]?.testCaseID,
        testCaseTitle: rows[i]?.testCaseTitle,
        testCaseDescription: rows[i]?.testCaseDescription,
        suiteName: rows[i]?.suiteName,
        // moduleId: rows[i]?.moduleId,
        status: rows[i]?.status,
        executionDuration: rows[i]?.executionDuration,
        // executionStart: rows[i]?.executionStart,
        // executionEnd: rows[i]?.executionEnd,
        tags: rows[i]?.tags,
        automationStatus: rows[i]?.automationStatus,
        testCaseSteps,
        testStepStatuses: testCaseStepsStatuses,
        stepNumbers: stepNum,
        issueLink
      };
      finalRows.push(obj);
    }
    return finalRows;
  };

  // Custom Export Button, overriding the existing export button of gridtoolbar
  const CustomExportButton = () => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedOptions, setSelectedOptions] = useState({
      includeLogs: true,
      includeScreenshots: true
    });
    // Handle checkbox toggle
    const handleToggle = (option) => {
      setSelectedOptions((prev) => ({
        ...prev,
        [option]: !prev[option]
      }));
    };

    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleClick = (event) => {
      setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
      setAnchorEl(null);
    };

    const handleExport = async () => {
      let obj = {};
      let curData;
      let userName;
      let runningStatus;
      const details = modifyRows(rows);
      handleClose();
      // Below variable is to differtiate from which screen 'Export' button is clicked
      // Based from where the button is clicked, we will be hiding some columns in the excel sheet
      // especially for Modules screen
      let pageName = 'Modules';
      if (paramObj.releaseId) {
        pageName = 'Releases';
        // Not considering the release state as it does not give exact
        // execution start and end time stamps for multi module releases
        try {
          const [response, response1] = await Promise.all([
            axios({
              method: 'get',
              url: `${API.releases.getExecutingReleasesData(paramObj.releaseId, true)}`,
              headers: {
                Authorization: `Bearer ${getSessionObj('accessToken')}`
              }
            }),
            axios({
              method: 'get',
              url: `${API.testRun.getLatestTestRunUser(paramObj.releaseId, 'release')}`,
              headers: {
                Authorization: `Bearer ${getSessionObj('accessToken')}`
              }
            })
          ]);
          curData = response?.data?.data[0];
          userName = response1?.data?.data;
          runningStatus = curData.runningStatus;
        } catch (error) {
          console.log('error = ', error);
        }
      }
      if (paramObj.testRunId) {
        pageName = 'Test Runs';
        curData = testRun?.currentTestRun;
        // If state related to testRun is null
        // The state will become blank whenever user presses refresh button on browser
        // if (!curData) {
        try {
          const [response, response1] = await Promise.all([
            axios({
              method: 'get',
              url: `${API.testRun.getJiraJobsStatusUpdate(paramObj.testRunId, true)}`,
              headers: {
                Authorization: `Bearer ${getSessionObj('accessToken')}`
              }
            }),
            axios({
              method: 'get',
              url: `${API.testRun.getLatestTestRunUser(paramObj.testRunId, 'job')}`,
              headers: {
                Authorization: `Bearer ${getSessionObj('accessToken')}`
              }
            })
          ]);
          curData = response?.data?.data[0];
          userName = response1?.data?.data;
        } catch (error) {
          console.log('error = ', error);
        }
        // }
        // If state of userList in user exists
        // else {
        //   userName = userList.find((user) => user?._id === curData?.createdBy);
        //   userName = `${userName.firstName} ${userName.lastName}`;
        // }
        runningStatus = curData.runningStatus;
      }
      if (pageName === 'Releases' || pageName === 'Test Runs') {
        obj = {
          releaseName: curData?.releaseName,
          testRunName: curData?.testRun,
          user: userName || '',
          total: curData?.total || 0,
          passed: curData?.passed || 0,
          failed: curData?.failed || 0,
          untested: curData?.untested || 0,
          skipped: curData?.skipped || 0,
          blocked: curData?.blocked || 0,
          executionDuration: curData?.executionDuration || '',
          executionStart: moment(curData?.executionStart).format('MMMM Do YYYY, h:mm:ss A') || '',
          executionEnd: moment(curData?.executionEnd).format('MMMM Do YYYY, h:mm:ss A') || '',
          jobStatus: runningStatus,
          failedTestCaseStepScreenshot: curData?.failedTestCaseStepScreenshot,
          failedTestCaseStepLog: curData?.failedTestCaseStepLog
        };
        if (obj.jobStatus === 'Completed') {
          const summary = obj;
          const result = { details, summary };

          // enqueueSnackbar('Download started...', { variant: 'info' });

          console.log('currentTestRun', currentTestRun);
          console.log('currentRelease', currentRelease);

          await exportTestCasesWithSteps(
            result,
            selectedOptions,
            defectList,
            curData?.failedTestCaseStepScreenshot,
            curData?.failedTestCaseStepLog,
            pageName,
            `${currentTestRun?.testRun || currentRelease?.releaseName}_withoutScreenshots.xlsx`
          );
          enqueueSnackbar('File downloaded successfully!', { variant: 'success' });
        } else {
          setDialogOpen(true);
        }
        // setDialogOpen(false);
      } else {
        await exportTestCasesWithSteps({ details }, '', pageName);
      }
    };

    const handleExportWithScreenshots = async () => {
      enqueueSnackbar('Test results with screenshots are currently being generated…!!', { variant: 'info' });
      const formData = { jobId: currentTestRun?._id, fileName: currentTestRun?.testRun };
      handleClose();
      const response = await exportTestRunResults(formData);
      if (parseInt(response?.status, 10) === 200) {
        setFileCreated(true);
        setTimeout(() => {
          handleExportedFileDownload();
        }, 5000);
      } else setFileCreated(false);
      enqueueSnackbar('Test Results with screenshots is ready to download!!', { variant: 'success' });
    };

    const handleExportedFileDownload = () => {
      const downloadUrl = `${API.testRun.downloadExportedFile(currentUser._id, testRunId)}?bypass=true`;
      handleClose();
      enqueueSnackbar('Download started...', { variant: 'info' });

      // Use fetch + blob to ensure download works even if endpoint requires CORS
      fetch(downloadUrl, { method: 'GET' })
        .then((res) => res.blob())
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `${currentTestRun?.testRun}_withScreenshots.xlsx`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          enqueueSnackbar('File downloaded successfully!', { variant: 'success' });
        })
        .catch((err) => {
          console.error('Download failed', err);
          enqueueSnackbar('Unexpected error while downloading file.', { variant: 'error' });
        });
    };

    return (
      <>
        {/* Release Case */}
        {paramObj.releaseId && (
          <Button onClick={handleExport} variant="text" startIcon={<GridSaveAltIcon />}>
            Export
          </Button>
        )}

        {/* Test Run Case */}
        {paramObj.testRunId && (
          <>
            <Button onClick={handleClick} variant="text" startIcon={<GridSaveAltIcon />}>
              Export
            </Button>
            <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
              <MenuItem
                onClick={
                  currentTestRun?.exportedFilePath || fileCreated
                    ? handleExportedFileDownload
                    : handleExportWithScreenshots
                }
              >
                With Screenshots
              </MenuItem>
              <MenuItem onClick={handleExport}>Without Screenshots</MenuItem>
            </Menu>
          </>
        )}

        {/* the below will be useful when checkboxes are needed */}
        {/* <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
          <DialogTitle>Export Options</DialogTitle>
          <DialogContent>
            <List>
              <ListItem>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedOptions.includeLogs}
                      onChange={() => handleToggle('includeLogs')}
                      color="primary"
                    />
                  }
                  label="Include Logs"
                />
              </ListItem>
              <ListItem>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedOptions.includeScreenshots}
                      onChange={() => handleToggle('includeScreenshots')}
                      color="primary"
                    />
                  }
                  label="Include Screenshots"
                />
              </ListItem>
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button onClick={handleExport} color="primary" variant="contained">
              Yes, Export
            </Button>
          </DialogActions>
        </Dialog> */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
          <DialogTitle style={{ marginBottom: '16px' }}>Cannot Download</DialogTitle>
          <DialogContent>
            <span role="img" aria-label="warning" style={{ color: 'red', fontWeight: 'bold' }}>
              ⚠️
            </span>{' '}
            <span style={{ fontWeight: 'bold', color: 'red' }}>
              Test Run is still under execution. Please wait until it completes.
            </span>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} color="secondary">
              Ok
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  };

  const CustomToolbar = () => (
    <GridToolbarContainer>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <CustomExportButton /> {/* Replaces GridToolbarExport */}
    </GridToolbarContainer>
  );

  return (
    <>
      <DataGrid
        // disableDensitySelector
        // disableSelectionOnClick
        rows={rows}
        columns={columns}
        pagination
        pageSize={10}
        components={{
          // Toolbar: GridToolbar,
          Toolbar: CustomToolbar,
          Pagination: CustomPagination
        }}
        // slots={{ toolbar: CustomToolbar }}
      />
      <Drawer
        open={openDetails}
        onClose={handleCloseDetails}
        anchor="right"
        PaperProps={{ sx: { width: { xs: 1, sm: '60%' } } }}
      >
        <TestCaseDetails
          testCase={selectedTestCase}
          testRunId={testRunId}
          fromModules={isModule}
          getTestCaseResults={getTestCaseResults}
          setOpenDetails={setOpenDetails}
          rows={rows}
        />
      </Drawer>
      {open && (
        <TestCaseScreenShotsUpload
          open={open}
          setOpen={setOpen}
          testCase={selectedTestCase}
          getTestCaseResults={getTestCaseResults}
          testRunId={testRunId}
        />
      )}
    </>
  );
}
