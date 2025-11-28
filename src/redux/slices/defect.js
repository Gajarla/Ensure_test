import { createSlice } from '@reduxjs/toolkit';
// utils
import API from '../../services';
import { HTTP_REQUEST } from '../../Constants';
import { callBackendService } from './common';

// ----------------------------------------------------------------------

const initialState = {
  isLoading: false,
  error: false,
  defectList: null
};

const slice = createSlice({
  name: 'defect',
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
    getDefectListSuccess(state, action) {
      state.isLoading = false;
      state.defectList = action.payload;
    }
  }
});

// Reducer
export default slice.reducer;

// Actions
export const { onToggleFollow, deleteUser } = slice.actions;

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

export const getDefectList = async (dispatch, releaseId, jobId) => {
  dispatch(slice.actions.startLoading());
  try {
    let data = { releaseId };
    if (jobId) data = { releaseId, jobId };
    const response = await callBackendService(HTTP_REQUEST.POST, `${API.defectTracker.getIssues}`, data);
    dispatch(slice.actions.getDefectListSuccess(response?.response));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};
