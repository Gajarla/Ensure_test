import { filter } from 'lodash';
import { createSlice } from '@reduxjs/toolkit';
// utils
// import axios from 'axios';
import axios from '../../utils/axiosInstance';
import API from '../../services';
import { getSessionObj } from '../../utils/jwt';
import { getPosts } from '../../_apis_/user';
// import { accessToken } from '../../contexts/JWTContext';
// import from '../../Constants';
import { PERSIST_STORE, HTTP_REQUEST } from '../../Constants';
import { callBackendService } from './common';
import { setIDBCurrentUser, getIDBCurrentUser } from '../../main';

// ----------------------------------------------------------------------

const initialState = {
  isLoading: false,
  error: false,
  email: null,
  posts: [],
  isSSO: false,
  getTokens: true,
  appendUrl: null,
  requestPassword: false,
  currentPage: 0,
  userList: [],
  companiesList: null,
  currentUser: null
};

const slice = createSlice({
  name: 'user',
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
    getUserEmailSuccess(state, action) {
      state.isLoading = false;
      state.email = action.payload;
    },
    // GET POSTS
    getPostsSuccess(state, action) {
      state.isLoading = false;
      state.posts = action.payload;
    },

    getIsSSOSuccess(state, action) {
      state.isLoading = false;
      state.isSSO = action.payload;
    },

    getGetTokensSuccess(state, action) {
      state.isLoading = false;
      state.getTokens = action.payload;
    },

    getAppendUrlSuccess(state, action) {
      state.isLoading = false;
      state.appendUrl = action.payload;
    },

    getRequestPasswordSuccess(state, action) {
      state.isLoading = false;
      state.requestPassword = action.payload;
    },

    // DELETE USERS
    deleteUser(state, action) {
      const deleteUser = filter(state.userList, (user) => user.id !== action.payload);
      state.userList = deleteUser;
    },

    // GET MANAGE USERS
    getUserListSuccess(state, action) {
      state.isLoading = false;
      state.userList = action.payload;
    },

    // GET MANAGE USERS
    getCompaniesListSuccess(state, action) {
      state.isLoading = false;
      state.companiesList = action.payload;
    },

    // GET CURRENT USER
    getCurrentUserSuccess(state, action) {
      state.isLoading = false;
      state.currentUser = action.payload;
    },

    // GET CURRENT USER
    getCurrentPageSuccess(state, action) {
      state.isLoading = false;
      state.currentPage = action.payload;
    }
  }
});

// Reducer
export default slice.reducer;

// Actions
export const { onToggleFollow, deleteUser } = slice.actions;

// ----------------------------------------------------------------------
export const getUserPosts = async (dispatch) => {
  dispatch(slice.actions.startLoading());
  try {
    // const response = await axios.get('/api/user/posts');
    const posts = await getPosts();
    dispatch(slice.actions.getPostsSuccess(posts));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};
// ----------------------------------------------------------------------
export const setUserEmail = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getUserEmailSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setUserIsSSO = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getIsSSOSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setUserGetTokens = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getGetTokensSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setUserAppendUrl = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getAppendUrlSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setUserRequestPassword = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getRequestPasswordSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setError = async (dispatch, error) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.hasError(error));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setCurrentUser = async (dispatch, loggedInUser) => {
  dispatch(slice.actions.startLoading());
  try {
    let user = null;
    if (loggedInUser) {
      delete loggedInUser.password;
      user = loggedInUser;
    } else {
      const persistUser = JSON.parse(window.localStorage.getItem(PERSIST_STORE.USER));
      const currentUser = JSON.parse(persistUser.currentUser);
      user = currentUser;
    }
    dispatch(slice.actions.getCurrentUserSuccess(user));
    setIDBCurrentUser(user);
    window.localStorage.setItem(PERSIST_STORE.USER, JSON.stringify(user));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setCurrentPage = async (dispatch, page) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getCurrentPageSuccess(page));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setUserList = async (dispatch, page) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getUserListSuccess(page));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export function getUsers() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const response = await callBackendService(HTTP_REQUEST.GET, `${API.users.getAllUsers}?bypass=true`, null);
      dispatch(slice.actions.getUserListSuccess(response?.data));
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export function getUserList() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const currentUser = await getIDBCurrentUser();
      const companyId = currentUser?.company?._id;
      const rid = currentUser?.role?._id;
      const roleID = currentUser?.role?.roleID;
      const data = { rid, roleID, UserId: currentUser?._id };
      const response = await callBackendService(HTTP_REQUEST.POST, `${API.users.getCompanyUsers(companyId)}`, data);
      dispatch(slice.actions.getUserListSuccess(response));
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export function getCompaniesList() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const currentUser = await getIDBCurrentUser();
      const companyId = currentUser?.company?._id;
      const data = { UserId: currentUser._id, companyId };
      const response = await axios({
        method: 'post',
        url: `${API.companies.getAllCompanies}`,
        data,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
      dispatch(slice.actions.getCompaniesListSuccess(response?.data?.data));
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export const getCreateUser = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    const response = await axios({
      method: 'post',
      url: `${API.users.createUser}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    if (parseInt(response?.status, 10) === 200) {
      await dispatch(getUserList());
      dispatch(slice.actions.hasError(false));
    } else dispatch(slice.actions.hasError(response?.data?.message));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getEditUser = async (dispatch, data, userId) => {
  dispatch(slice.actions.startLoading());
  delete data.password;
  try {
    await axios({
      method: 'patch',
      url: `${API.users.updateUser(userId)}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    await dispatch(getUserList());
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getDeleteUser = async (dispatch, userId) => {
  dispatch(slice.actions.startLoading());
  try {
    await axios({
      method: 'delete',
      url: `${API.users.deleteUser(userId)}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    await dispatch(getUserList());
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};
