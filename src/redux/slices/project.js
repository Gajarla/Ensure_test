import { filter } from 'lodash';
import { createSlice } from '@reduxjs/toolkit';
// utils
// import axios from 'axios';
import axios from '../../utils/axiosInstance';
import { getSessionObj } from '../../utils/jwt';
import url from '../../URL';
import API from '../../services';
import STATUS from '../../components/_dashboard/project/ProjectStatus';
import { getIDBCurrentUser, setIDBCurrenrProject } from '../../main';
import { setFetchRoledata } from './role';
import { PERSIST_STORE } from '../../Constants';

// ----------------------------------------------------------------------

const initialState = {
  isLoading: false,
  error: false,
  projectList: null,
  companyStatusProjectList: null,
  fetchProjectData: true,
  filterProjects: null,
  currentProject: null,
  templatesList: null,
  testCaseSteps: null,
  totalCount: 0
};

const slice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    // START LOADING
    startLoading(state) {
      state.isLoading = true;
    },

    // HAS ERROR
    hasError(state, action) {
      state.isLoading = false;
      state.error = action.payload;
    },

    // DELETE Project
    deleteProject(state, action) {
      const deleteProject = filter(state.projectList, (project) => project.id !== action.payload);
      state.projectList = deleteProject;
    },

    // GET MANAGE USERS
    getProjectListSuccess(state, action) {
      state.isLoading = false;
      state.projectList = action.payload;
    },

    getTotalCountSuccess(state, action) {
      state.isLoading = false;
      state.totalCount = action.payload;
    },

    // GET ALL ACTIVE STATUS PROJECTS IN A COMPANY
    getCompanyStatusProjectListSuccess(state, action) {
      state.isLoading = false;
      state.companyStatusProjectList = action.payload;
    },

    // GET MANAGE USERS
    getFilteredProjectListSuccess(state, action) {
      state.isLoading = false;
      state.filterProjects = action.payload;
    },

    // GET MANAGE USERS
    getTemplatesListSuccess(state, action) {
      state.isLoading = false;
      state.templatesList = action.payload;
    },

    // GET MANAGE USERS
    getFetchProjectDataSuccess(state, action) {
      state.isLoading = false;
      state.fetchProjectData = action.payload;
    },

    // GET CURRENT PROJECT
    getCurrentProjectSuccess(state, action) {
      state.isLoading = false;
      state.currentProject = action.payload;
    },

    // GET CURRENT PROJECT
    getTestCaseStepsSuccess(state, action) {
      state.isLoading = false;
      state.testCaseSteps = action.payload;
    }
  }
});

// Reducer
export default slice.reducer;

// Actions
export const { onToggleFollow, deleteProject, getProjectListSuccess, getFilteredProjectListSuccess } = slice.actions;

// ----------------------------------------------------------------------

export function getProjectList() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const currentUser = await getIDBCurrentUser();
      const response = await axios({
        method: 'get',
        url: `${API.projects.allProjects(currentUser?.company?._id, currentUser?._id)}`,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
      dispatch(slice.actions.getProjectListSuccess(response.data));
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export function getFilteredProjectList(status) {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      // dispatch(getProjectList());
      console.log('status', status);
      console.log(currentUser?.company?._id, currentUser?._id);
      const currentUser = await getIDBCurrentUser();
      let url = null;
      switch (status) {
        case STATUS.ARCHIVED:
          url = `${API.projects.allArchivedProjects(currentUser?.company?._id, currentUser?._id)}`;
          break;
        case STATUS.UNARCHIVED:
          url = `${API.projects.allUnArchivedProjects(currentUser?.company?._id, currentUser?._id)}`;
          break;
        default:
          url = `${API.projects.allProjects(currentUser?.company?._id)}`;
          break;
      }
      const response = await axios({
        method: 'get',
        url,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
      dispatch(slice.actions.getFilteredProjectListSuccess(response.data));
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export const getCreateProject = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    await axios({
      method: 'post',
      url: `${API.projects.createProject}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    // await dispatch(getProjectList());
    setFetchProjectData(dispatch, true);
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getEditProject = async (dispatch, data, projectID) => {
  let response = null;
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    data = { ...data, email: currentUser.email };
    response = await axios({
      method: 'patch',
      url: `${url.host}/api/projects/Project/update/${projectID}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    // await dispatch(getProjectList());
    let project = null;
    try {
      const response = await axios({
        method: 'get',
        url: `${API.projects.findProject(projectID)}`,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
      project = response?.data?.data;
      setCurrentProject(dispatch, project);
      setFetchRoledata(dispatch, true);
      setFetchProjectData(dispatch, true);
    } catch (error) {
      console.error('error', error);
    }
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
  return response;
};

// ----------------------------------------------------------------------

export const getDeleteProject = async (dispatch, id) => {
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    const data = { ...data, email: currentUser.email };
    await axios({
      method: 'delete',
      url: `${API.projects.deleteProject}/${id}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    // await dispatch(getProjectList());
    setFetchProjectData(dispatch, true);
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setCurrentProject = async (dispatch, currentProject) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getCurrentProjectSuccess(currentProject));
    setIDBCurrenrProject(currentProject);
    window.localStorage.setItem(PERSIST_STORE.PROJECT, JSON.stringify(currentProject));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setProjectList = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getProjectListSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

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

export const setCompanyStatusProjectList = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getCompanyStatusProjectListSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setFetchProjectData = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getFetchProjectDataSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setFilteredProjectList = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getFilteredProjectListSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export function getTemaplates() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const response = await axios({
        method: 'get',
        url: `${API.projects.getTemplates}`,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
      dispatch(slice.actions.getTemplatesListSuccess(response.data));
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export function getTemaplatesByCompanyId() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const currentUser = await getIDBCurrentUser();
      const response = await axios({
        method: 'get',
        url: `${API.projects.getTemplatesByCompanyId(currentUser?.company?._id)}`,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
      dispatch(slice.actions.getTemplatesListSuccess(response.data));
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export const setTestCaseSteps = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getTestCaseStepsSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};
