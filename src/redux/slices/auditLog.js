import { createSlice } from '@reduxjs/toolkit';
// utils
import axios from 'axios';
import API from '../../services';
import { getSessionObj } from '../../utils/jwt';
import { getIDBCurrentUser } from '../../main';

// ----------------------------------------------------------------------

const initialState = {
  isLoading: false,
  error: false,
  posts: [],
  currentPage: 0,
  auditLogs: []
};

const slice = createSlice({
  name: 'auditLog',
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
    // GET POSTS
    getPostsSuccess(state, action) {
      state.isLoading = false;
      state.posts = action.payload;
    },

    // GET MANAGE USERS
    getAuditLogListSuccess(state, action) {
      state.isLoading = false;
      state.auditLogs = action.payload;
    }
  }
});

// Reducer
export default slice.reducer;

// Actions
export const { onToggleFollow, deleteUser } = slice.actions;

// ----------------------------------------------------------------------

export function getAduitLogList() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const currentUser = await getIDBCurrentUser();
      const companyId = currentUser?.company?._id;
      const response = await axios({
        method: 'get',
        url: `${API.users.getCompanyUsers(companyId)}`,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
      dispatch(slice.actions.getUserListSuccess(response.data));
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export const setAuditLogs = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getAuditLogListSuccess(data));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};
