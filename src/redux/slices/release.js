import { filter } from 'lodash';
import { createSlice } from '@reduxjs/toolkit';
// utils
// import axios from 'axios';
import axios from '../../utils/axiosInstance';
import API from '../../services';
import { getSessionObj } from '../../utils/jwt';
import { getIDBCurrentUser, getIDBCurrentProject } from '../../main';

// ----------------------------------------------------------------------

const initialState = {
  isLoading: false,
  error: false,
  fetchReleaseData: true,
  releaseList: [],
  releaseData: null,
  testRunsList: [],
  moduleData: null,
  jsonData: null,
  currentRelease: null,
  testCases: [],
  dashboardData: {},
  releaseTestNodes: [],
  untestedTestNodes: [],
  graphTestCasesCounts: [],
  currentGraphTestCounts: [],
  executionDuration: null,
  totalCount: 0
};

const slice = createSlice({
  name: 'release',
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

    // DELETE MODULE
    deleteRelease(state, action) {
      const deleteRelease = filter(state.releaseList, (release) => release.id !== action.payload);
      state.releaseList = deleteRelease;
    },

    // GET MANAGE USERS
    getFetchReleaseDataSuccess(state, action) {
      state.isLoading = false;
      state.fetchReleaseData = action.payload;
    },

    // GET MANAGE USERS
    getReleaseListSuccess(state, action) {
      state.isLoading = false;
      state.releaseList = action.payload;
    },
    getTotalCountSuccess(state, action) {
      state.isLoading = false;
      state.totalCount = action.payload;
    },

    // GET MANAGE USERS
    getTestRunsListSuccess(state, action) {
      state.isLoading = false;
      state.testRunsList = action.payload;
    },

    // GET MANAGE USERS
    getModuleDataSuccess(state, action) {
      state.isLoading = false;
      state.moduleData = action.payload;
    },

    // GET MANAGE USERS
    getJsonSuccess(state, action) {
      state.isLoading = false;
      state.jsonData = action.payload;
    },

    // GET MANAGE USERS
    getCurrentReleaseSuccess(state, action) {
      state.isLoading = false;
      state.currentRelease = action.payload;
    },

    // GET MANAGE USERS
    getReleaseDataSuccess(state, action) {
      state.isLoading = false;
      state.releaseData = action.payload;
    },

    // GET MANAGE USERS
    getTestCasesSuccess(state, action) {
      state.isLoading = false;
      state.testCases = action.payload;
    },

    // GET MANAGE USERS
    getDashboardDataSuccess(state, action) {
      state.isLoading = false;
      state.dashboardData = action.payload;
    },

    setReleaseTestNodes(state, action) {
      state.isLoading = false;
      state.releaseTestNodes = action.payload;
    },

    setUntestedTestNodes(state, action) {
      state.isLoading = false;
      state.untestedTestNodes = action.payload;
    },
    setGraphTestCases(state, action) {
      state.isLoading = false;
      state.graphTestCasesCounts = action.payload;
    },
    setCurrentGraphTestCounts(state, action) {
      state.isLoading = false;
      state.currentGraphTestCounts = action.payload;
    },

    setExecutionDurationSuccess(state, action) {
      state.isLoading = false;
      state.executionDuration = action.payload;
    }
  }
});

// Reducer
export default slice.reducer;

// Actions
export const {
  onToggleFollow,
  deleteRelease,
  getReleaseListSuccess,
  getCurrentReleaseSuccess,
  getTestRunsListSuccess,
  setReleaseTestNodes,
  setUntestedTestNodes,
  setGraphTestCases,
  setCurrentGraphTestCounts,
  getModuleDataSuccess
} = slice.actions;

// ----------------------------------------------------------------------

export function getReleaseList() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const projectSerialized = await getIDBCurrentProject();
      if (projectSerialized && projectSerialized._id) {
        const response = await axios({
          method: 'get',
          url: API.releases.getReleaseByPID2(projectSerialized._id),
          headers: {
            Authorization: `Bearer ${getSessionObj('accessToken')}`
          }
        });
        if (response.data instanceof Array) await dispatch(getReleaseListSuccess(response.data?.response));
        else await dispatch(getReleaseListSuccess([]));
      } else {
        dispatch(slice.actions.hasWarning({}));
      }
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export function getReleasesList() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const projectSerialized = await getIDBCurrentProject();
      if (projectSerialized && projectSerialized._id) {
        const data = await axios({
          method: 'get',
          url: API.releases.getReleaseByPID(projectSerialized._id, 'createdAt', 'desc', '10', '0'),
          headers: {
            Authorization: `Bearer ${getSessionObj('accessToken')}`
          }
        });
        const releases = data?.data?.response;
        const totalcount = data?.data?.totalCount;
        setTotalCount(dispatch, totalcount);
        if (releases instanceof Array) await dispatch(getReleaseListSuccess(releases));
        else await dispatch(getReleaseListSuccess([]));
      } else {
        dispatch(slice.actions.hasWarning({}));
      }
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export const getReleaseTestRuns = async (dispatch, releaseId) => {
  dispatch(slice.actions.startLoading());
  try {
    const response = await axios({
      method: 'get',
      url: API.testRun.releaseTestRuns(releaseId),
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    await dispatch(slice.actions.getTestRunsListSuccess(response.data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setReleaseTestRuns = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    await dispatch(slice.actions.getTestRunsListSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setFetchReleaseData = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    await dispatch(slice.actions.getFetchReleaseDataSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setTestCases = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    await dispatch(slice.actions.getTestCasesSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setTotalCount = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getTotalCountSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

// ----------------------------------------------------------------------

export const getCreateRelease = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    const projectSerialized = await getIDBCurrentProject();
    data = {
      ...data,
      email: currentUser.email,
      company: currentUser.company,
      templateID: projectSerialized?.templateID,
      projectID: projectSerialized?._id
    };

    await axios({
      method: 'post',
      url: `${API.releases.createRelease}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    await dispatch(getReleasesList());
    await dispatch(slice.actions.getFetchReleaseDataSuccess(true));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
  setReleaseData(dispatch, null);
};

// ----------------------------------------------------------------------

export const getUpdateRelease = async (dispatch, releaseID, data) => {
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    const projectSerialized = await getIDBCurrentProject();
    data = {
      ...data,
      releaseID,
      email: currentUser.email,
      company: currentUser.company,
      templateID: projectSerialized?.templateID
    };

    await axios({
      method: 'post',
      url: `${API.releases.updateRelease}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    // await dispatch(getReleaseList());
    await dispatch(getReleasesList());
    await dispatch(slice.actions.getFetchReleaseDataSuccess(true));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
  setReleaseData(dispatch, null);
};

// ----------------------------------------------------------------------

export const getCloneRelease = async (dispatch, id, releaseName) => {
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    const inputs = { email: currentUser.email, company: currentUser.company };
    const response = await axios({
      method: 'get',
      url: `${API.releases.getRelease(id)}`,
      inputs,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    const { data } = response;
    const cloneData = { ...data?.response, releaseName };
    const { modules } = cloneData;
    const newModules = modules?.map((module) => {
      const { testPlaceholders } = module;
      const newPlaceholders = testPlaceholders?.map((testPlaceholder) => {
        const newPlaceholder = { ...testPlaceholder, jobId: null, tpId: null };
        return newPlaceholder;
      });
      return { ...module, testPlaceholders: newPlaceholders };
    });
    const revisedData = { ...cloneData, modules: newModules };
    getCreateRelease(dispatch, revisedData);
    // await dispatch(getReleaseList());
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getDeleteRelease = async (dispatch, id) => {
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    const data = { email: currentUser.email, company: currentUser.company };
    await axios({
      method: 'delete',
      url: `${API.releases.deleteRelease}/${id}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    await dispatch(getReleasesList());
    await dispatch(slice.actions.getFetchReleaseDataSuccess(true));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setCurrentRelease = async (dispatch, currentRelease) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getCurrentReleaseSuccess(currentRelease));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setReleaseData = async (dispatch, releaseData) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getReleaseDataSuccess(releaseData));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setReleaseList = async (dispatch, releaseData) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getReleaseListSuccess(releaseData));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setModuleData = async (dispatch, moduleData) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getModuleDataSuccess(moduleData));
  } catch (error) {
    console.log('errr', error);
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setDashboardData = async (dispatch, dashboardData) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getDashboardDataSuccess(dashboardData));
  } catch (error) {
    console.log('errr', error);
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setExecutionDuration = async (dispatch, executionDuration) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.setExecutionDurationSuccess(executionDuration));
  } catch (error) {
    console.log('errr', error);
    dispatch(slice.actions.hasError(error));
  }
};
