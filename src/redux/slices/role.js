import { createSlice } from '@reduxjs/toolkit';
// utils
// import axios from 'axios';
import axios from '../../utils/axiosInstance';
import API from '../../services';
import { getSessionObj } from '../../utils/jwt';
// import { accessToken } from '../../contexts/JWTContext';
import { getIDBCurrentUser } from '../../main';
// ----------------------------------------------------------------------

const initialState = {
  isLoading: false,
  error: false,
  fetchRoleData: true,
  currentPage: 0,
  rolesList: null,
  filteredRoleList: null,
  clientsRoleConfigList: null,
  roleConfig: null,
  pageConfig: null,
  testCasesConfig: null,
  clientsRoleConfig: null,
  defaultRoleConfig: null,
  currentRole: null
};

const slice = createSlice({
  name: 'role',
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

    // GET MANAGE USERS
    getFetchRoleDataSuccess(state, action) {
      state.isLoading = false;
      state.fetchRoleData = action.payload;
    },

    // GET MANAGE USERS
    getRolesListSuccess(state, action) {
      state.isLoading = false;
      state.rolesList = action.payload;
    },

    // GET MANAGE USERS
    getFilteredRolesListSuccess(state, action) {
      state.isLoading = false;
      state.filteredRoleList = action.payload;
    },

    // GET MANAGE USERS
    getClientsRoleConfigListSuccess(state, action) {
      state.isLoading = false;
      state.clientsRoleConfigList = action.payload;
    },

    // GET MANAGE USERS
    getRoleConfigSuccess(state, action) {
      state.isLoading = false;
      state.roleConfig = action.payload;
    },

    // GET MANAGE USERS
    getPageConfigSuccess(state, action) {
      state.isLoading = false;
      state.pageConfig = action.payload;
    },

    // GET MANAGE USERS
    getTestCasesConfigSuccess(state, action) {
      state.isLoading = false;
      state.testCasesConfig = action.payload;
    },

    // GET MANAGE USERS
    getClientsRoleConfigSuccess(state, action) {
      state.isLoading = false;
      state.clientsRoleConfig = action.payload;
    },

    // GET MANAGE USERS
    getDefaultRoleConfigSuccess(state, action) {
      state.isLoading = false;
      state.defaultRoleConfig = action.payload;
    },

    // GET MANAGE USERS
    getcurrentRoleSuccess(state, action) {
      state.isLoading = false;
      state.currentRole = action.payload;
    }
  }
});

// Reducer
export default slice.reducer;

// Actions
export const { onToggleFollow, deleteUser } = slice.actions;

// ----------------------------------------------------------------------

export function getRolesList() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const currentUser = await getIDBCurrentUser();
      const data = { UserId: currentUser._id };
      const response = await axios({
        method: 'post',
        url: `${API.roles.getAllRoles}`,
        data,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
      if (parseInt(response?.data?.status, 10) === 200)
        dispatch(slice.actions.getRolesListSuccess(response?.data?.data));
      else dispatch(slice.actions.hasError(response.data));
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export const setFetchRoledata = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getFetchRoleDataSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setRolesList = async (dispatch, rolesList) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getRolesListSuccess(rolesList));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setFilteredRolesList = async (dispatch, filteredRolesList) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getFilteredRolesListSuccess(filteredRolesList));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getCreateRole = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    data = { ...data, UserId: currentUser._id };
    const response = await axios({
      method: 'post',
      url: `${API.roles.createRole}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    if (parseInt(response?.data.status, 10) === 200) {
      await dispatch(getRolesList());
      dispatch(slice.actions.hasError(false));
    } else dispatch(slice.actions.hasError(response?.data?.message));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getEditRole = async (dispatch, data, roleId) => {
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    data = { ...data, UserId: currentUser._id, updatedBy: currentUser._id, rid: roleId };
    await axios({
      method: 'post',
      url: `${API.roles.updateRole}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    await dispatch(getRolesList());
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getDeleteRole = async (dispatch, roleId) => {
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    const data = { UserId: currentUser._id, updatedBy: currentUser._id, rid: roleId, roleID: roleId };
    await axios({
      method: 'post',
      url: `${API.roles.deleteRole}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    await dispatch(getRolesList());
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setDefaultRoleConfig = async (dispatch, clientsRoleConfig) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getDefaultRoleConfigSuccess(clientsRoleConfig));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setClientsRoleConfig = async (dispatch, clientsRoleConfig) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getClientsRoleConfigSuccess(clientsRoleConfig));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setClientsRoleConfigList = async (dispatch, roleConfig) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getClientsRoleConfigListSuccess(roleConfig));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setRoleConfig = async (dispatch, roleConfig) => {
  dispatch(slice.actions.startLoading());
  try {
    if (roleConfig) {
      dispatch(slice.actions.getRoleConfigSuccess(roleConfig));
    }
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setPageConfig = async (dispatch, pageConfig) => {
  dispatch(slice.actions.startLoading());
  try {
    if (pageConfig) dispatch(slice.actions.getPageConfigSuccess(pageConfig));
  } catch (error) {
    console.log('error', error);
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setTestCasesConfig = async (dispatch, testCasesConfig) => {
  dispatch(slice.actions.startLoading());
  try {
    if (testCasesConfig) dispatch(slice.actions.getTestCasesConfigSuccess(testCasesConfig));
  } catch (error) {
    console.log('error', error);
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getCreateRoleConfig = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    data = {
      ...data,
      UserId: currentUser._id,
      rid: data?.role,
      roleID: currentUser?.role?.roleID,
      companyId: currentUser?.company?._id
    };
    const response = await axios({
      method: 'post',
      url: `${API.roles.createRoleConfig}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    if (parseInt(response?.data.status, 10) === 200) {
      await dispatch(getClientsRoleConfig());
      dispatch(slice.actions.hasError(false));
    } else dispatch(slice.actions.hasError(response?.data?.message));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export function getClientsRoleConfig() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const currentUser = await getIDBCurrentUser();
      const data = { UserId: currentUser._id, companyId: currentUser?.company?._id, rid: currentUser?.role?._id };
      const response = await axios({
        method: 'post',
        url: `${API.roles.getRoleConfig}`,
        data,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
      if (parseInt(response?.data?.status, 10) === 200)
        dispatch(slice.actions.getClientsRoleConfigSuccess(response?.data?.data));
      else dispatch(slice.actions.hasError(response.data));
    } catch (error) {
      dispatch(slice.actions.hasError(error));
      console.log('error', error);
    }
  };
}

// ----------------------------------------------------------------------

export const setCurrentRole = async (dispatch, roleId) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getcurrentRoleSuccess(roleId));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};
