import { createSlice } from '@reduxjs/toolkit';
// utils
// import axios from 'axios';
import axios from '../../utils/axiosInstance';
import API from '../../services';
import { getSessionObj } from '../../utils/jwt';
import { getIDBCurrentProject } from '../../main';

// ----------------------------------------------------------------------

const initialState = {
  isLoading: false,
  error: false,
  fetchTestRunsData: true,
  testRunList: [],
  rows: [],
  currentTestRun: null,
  testCaseEvidences: [],
  testStepEvidences: {},
  testStepLogs: {},
  testStepDetails: [],
  testCaseEvidencesFetched: false,
  testStepEvidencesFetched: false,
  currentFunction: '',
  testCaseUpdateInProgress: '',
  testCaseDetails: {},
  updatedTestCases: {},
  allTestRuns: [],
  totalCount: 0
};

const slice = createSlice({
  name: 'testRun',
  initialState,
  reducers: {
    // START LOADING
    startLoading(state) {
      state.isLoading = true;
    },

    // NO OP, FIX IT!
    hasWarning(state) {
      state.isLoading = false;
    },

    // HAS ERROR
    hasError(state, action) {
      state.isLoading = false;
      state.error = action.payload;
    },

    // GET MANAGE USERS
    getFetchTestRunDataSuccess(state, action) {
      state.isLoading = false;
      state.fetchTestRunsData = action.payload;
    },

    // GET MANAGE USERS
    getTestRunListSuccess(state, action) {
      state.isLoading = false;
      state.testRunList = action.payload;
    },
    // GET MANAGE USERS
    getRowsSuccess(state, action) {
      state.isLoading = false;
      state.rows = action.payload;
    },

    // GET MANAGE USERS
    getCurrentTestRunSuccess(state, action) {
      state.isLoading = false;
      state.currentTestRun = action.payload;
    },

    getTestCaseEvidences(state, action) {
      state.testCaseEvidences = action.payload.testcaseevidences;
      state.testCaseEvidencesFetched = action.payload.testCaseEvidencesFetched;
    },

    getTestStepEvidences(state, action) {
      state.testStepEvidences = action.payload;
      state.testStepEvidencesFetched = true;
    },

    geTtestCaseEvidencesFetched(state, action) {
      state.testCaseEvidencesFetched = action.payload;
    },

    getTestStepEvidencesFetched(state, action) {
      state.testStepEvidencesFetched = action.payload;
    },

    getTestStepLogs(state, action) {
      state.testStepLogs = action.payload;
    },
    getCurrentFunction(state, action) {
      state.currentFunction = action.payload;
    },
    getTestCaseUpdateInProgress(state, action) {
      state.testCaseUpdateInProgress = action.payload;
    },
    getTestStepDetails(state, action) {
      state.testStepDetails = action.payload;
    },
    getTestCaseDetails(state, action) {
      state.testCaseDetails = action.payload;
    },
    getUpdatedTestCases(state, action) {
      state.updatedTestCases = action.payload;
    },
    getAllTestRuns(state, action) {
      state.allTestRuns = action.payload;
    },
    getTotalCountSuccess(state, action) {
      state.isLoading = false;
      state.totalCount = action.payload;
    }
  }
});

// Reducer
export default slice.reducer;

// Actions
export const {
  onToggleFollow,
  getCurrentTestRunSuccess,
  getRowsSuccess,
  getTestRunListSuccess,
  getTestCaseEvidences,
  getTestStepEvidences,
  getTestStepLogs,
  getCurrentFunction,
  getTestCaseUpdateInProgress,
  getTestStepDetails,
  getTestCaseDetails,
  getTestStepEvidencesFetched,
  getUpdatedTestCases,
  geTtestCaseEvidencesFetched,
  getAllTestRuns
} = slice.actions;

// ----------------------------------------------------------------------

export const getRunRelease = async (dispatch, id) => {
  dispatch(slice.actions.startLoading());
  try {
    await axios({
      method: 'post',
      url: `${API.testRun.createJob(id)}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    }).then(() => {
      getTestRunList(dispatch);
    });
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getTestRunList = async (dispatch) => {
  dispatch(slice.actions.startLoading());
  dispatch(getUpdatedTestCases({}));
  try {
    const projectSerialized = await getIDBCurrentProject();
    if (projectSerialized && projectSerialized._id) {
      const response = await axios({
        method: 'get',
        url: API.testRun.getJobsByPID(projectSerialized._id),
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });

      /** all Test Runs * */
      const { data } = response;
      const allTestRuns = [];
      data?.response?.forEach((run) => {
        const { releaseID, releaseName, jenkinsJobID, modules, createdAt, updatedAt } = run;
        modules?.forEach((module) => {
          const { moduleID, testNodes } = module;
          allTestRuns.push({
            releaseID,
            releaseName,
            jenkinsJobID,
            moduleID,
            testNodes,
            createdAt,
            updatedAt
          });
        });
      });
      await dispatch(slice.actions.getTestRunListSuccess(response.data?.response));
      await dispatch(slice.actions.getAllTestRuns(allTestRuns));
    } else {
      dispatch(slice.actions.hasWarning({}));
    }
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getTestRunById = async (dispatch, jobId) => {
  dispatch(slice.actions.startLoading());
  try {
    const response = await axios({
      method: 'get',
      url: `${API.testRun.getJobById(jobId)}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    dispatch(slice.actions.getCurrentTestRunSuccess(response.data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getJobUpdate = async (dispatch, jobId, id, status) => {
  dispatch(slice.actions.startLoading());
  try {
    await axios({
      method: 'patch',
      url: `${API.testRun.getJobUpdate(jobId, id, status)}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    await getTestRunById(dispatch, jobId);
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setCurrentTestRun = async (dispatch, currentTestRun) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getCurrentTestRunSuccess(currentTestRun));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setFetchTestRunData = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getFetchTestRunDataSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setTestCaseDetails = async (dispatch, testCaseDetails) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getTestCaseDetails(testCaseDetails));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setTestRunsList = async (dispatch, testRunsData) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getTestRunListSuccess(testRunsData));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setAllTestRunsList = async (dispatch, testRunsData) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getAllTestRuns(testRunsData));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

export const setTotalCount = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getTotalCountSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};
// ----------------------------------------------------------------------------

export const setFetchTestRunsData = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getFetchTestRunDataSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};
// ----------------------------------------------------------------------
