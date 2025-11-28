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
  fetchModuleData: true,
  moduleList: null,
  filteredModuleList: null,
  filteredBPModuleList: null,
  jsonData: null,
  currentModule: null,
  validations: null,
  totalcount: 0,
  testCasesPageCount: 0
};

const slice = createSlice({
  name: 'module',
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
    deleteModule(state, action) {
      const deleteModule = filter(state.moduleList, (module) => module.id !== action.payload);
      state.moduleList = deleteModule;
    },

    // GET MANAGE USERS
    getModuleListSuccess(state, action) {
      state.isLoading = false;
      state.moduleList = action.payload;
    },

    // GET MANAGE USERS
    getFilteredModuleListSuccess(state, action) {
      state.isLoading = false;
      state.filteredModuleList = action.payload;
    },
    // GET TOTAL COUNT
    getTotalCountSuccess(state, action) {
      state.isLoading = false;
      state.totalcount = action.payload;
    },

    // GET TOTAL COUNT
    getTestCasesTotalCountSuccess(state, action) {
      state.isLoading = false;
      state.testCasesPageCount = action.payload;
    },

    // GET MANAGE USERS
    getFilteredBPModuleListSuccess(state, action) {
      state.isLoading = false;
      state.filteredBPModuleList = action.payload;
    },

    // GET MANAGE USERS
    getJsonSuccess(state, action) {
      state.isLoading = false;
      state.jsonData = action.payload;
    },

    // GET MANAGE USERS
    getCurrentModuleSuccess(state, action) {
      state.isLoading = false;
      state.currentModule = action.payload;
    },
    // GET MANAGE USERS
    getFetchModuleDataSuccess(state, action) {
      state.isLoading = false;
      state.fetchModuleData = action.payload;
    },
    // GET Validations
    setValidations(state, action) {
      state.isLoading = false;
      state.validations = action.payload;
    }
  }
});

// Reducer
export default slice.reducer;

// Actions
export const { onToggleFollow, deleteModule, getModuleListSuccess, setValidations } = slice.actions;

// ----------------------------------------------------------------------

export function getModuleList(fetchTestCases = false, fetchTestSteps = false) {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const projectSerialized = await getIDBCurrentProject();
      if (projectSerialized && projectSerialized._id) {
        const response = await axios({
          method: 'get',
          url: API.projects.getModuleByProjectId(projectSerialized._id, fetchTestCases, fetchTestSteps),
          headers: {
            Authorization: `Bearer ${getSessionObj('accessToken')}`
          }
        });
        dispatch(slice.actions.getModuleListSuccess(response?.data?.response));
        dispatch(slice.actions.getFilteredModuleListSuccess(response?.data?.response));
      } else {
        dispatch(slice.actions.hasWarning({}));
      }
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export function getModulesList() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const projectSerialized = await getIDBCurrentProject();
      if (projectSerialized && projectSerialized._id) {
        const response = await axios({
          method: 'get',
          url: API.projects.getModuleListByProjectId(projectSerialized._id, 'createdAt', 'desc', '10', '0'),
          headers: {
            Authorization: `Bearer ${getSessionObj('accessToken')}`
          }
        });
        const { data } = response;
        const modules = data?.response;
        const totalcount = data?.totalCount;
        modules.sort((a, b) => {
          let value = 0;
          if (a.createdAt.localeCompare(b.createdAt)) value = -1;
          else value = 1;
          return value;
        });
        setTotalCount(dispatch, totalcount);
        dispatch(slice.actions.getModuleListSuccess(modules));
        // dispatch(slice.actions.getFilteredModuleListSuccess(response?.data?.response));
      } else {
        dispatch(slice.actions.hasWarning({}));
      }
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export const getCreateModule = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  let response = true;
  try {
    response = await axios({
      method: 'post',
      url: `${API.projects.createModule}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    await dispatch(getModulesList());
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
  return response?.data;
};

// ----------------------------------------------------------------------

export const getUpdateModule = async (dispatch, data, id) => {
  dispatch(slice.actions.startLoading());
  try {
    await axios({
      method: 'patch',
      url: `${API.projects.updateModule(id)}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    await dispatch(getModuleList());
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getParseTestCases = async (dispatch, data) => {
  let result = false;
  dispatch(slice.actions.startLoading());
  try {
    const response = await axios({
      method: 'post',
      url: `${API.projects.parseTestCases}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    dispatch(slice.actions.getJsonSuccess(response.data[0]));
    await dispatch(getModuleList());
  } catch (error) {
    result = true;
    dispatch(slice.actions.hasError(error));
  }
  return result;
};

// ----------------------------------------------------------------------

export const getDeleteModule = async (dispatch, id) => {
  let response = null;
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    const data = { email: currentUser.email, company: currentUser.company };
    response = await axios({
      method: 'delete',
      url: `${API.projects.deleteModule}/${id}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    await dispatch(getModuleList());
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
  return response.data;
};

// ----------------------------------------------------------------------

export const setCurrentModule = async (dispatch, currentModule) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getCurrentModuleSuccess(currentModule));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setFetchModuleData = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getFetchModuleDataSuccess(data));
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

export const setTestCasesPageCount = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getTestCasesTotalCountSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------

export const setJsonData = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getJsonSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setModuleList = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getModuleListSuccess(data));
    // dispatch(slice.actions.getFilteredModuleListSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setFilteredModuleList = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getFilteredModuleListSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setFilteredBPModuleList = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getFilteredBPModuleListSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ---------------------------------------------------------
export const getValidations = async (dispatch) => {
  try {
    const response = await axios({
      method: 'get',
      url: `${API.validate.getValidations()}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    const data = response?.data[0];
    await dispatch(slice.actions.setValidations(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};
