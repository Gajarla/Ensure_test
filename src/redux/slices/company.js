import { createSlice } from '@reduxjs/toolkit';
// utils
// import axios from 'axios';
import axios from '../../utils/axiosInstance';
import API from '../../services';
import { getSessionObj } from '../../utils/jwt';
import { getIDBCurrentUser } from '../../main';

// ----------------------------------------------------------------------

const initialState = {
  isLoading: false,
  error: false,
  currentPage: 0,
  companyList: null,
  currentCompany: null
};

const slice = createSlice({
  name: 'company',
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
    getCompaniesListSuccess(state, action) {
      state.isLoading = false;
      state.companyList = action.payload;
    },

    // GET CURRENT USER
    getCurrentCompanySuccess(state, action) {
      state.isLoading = false;
      state.currentUser = action.payload;
    }
  }
});

// Reducer
export default slice.reducer;

// Actions
export const { onToggleFollow, deleteUser } = slice.actions;

// ----------------------------------------------------------------------

export function getCompaniesList() {
  return async (dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const currentUser = await getIDBCurrentUser();
      const data = { UserId: currentUser._id, companyId: currentUser.company._id };
      const response = await axios({
        method: 'post',
        url: `${API.companies.getAllCompanies}`,
        data,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
      if (parseInt(response?.data?.status, 10) === 200)
        dispatch(slice.actions.getCompaniesListSuccess(response?.data?.data));
      else dispatch(slice.actions.hasError(response.data));
    } catch (error) {
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

export const getCreateCompany = async (dispatch, data) => {
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    data = { ...data, UserId: currentUser._id };
    const response = await axios({
      method: 'post',
      url: `${API.companies.createCompany}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    if (parseInt(response?.data.status, 10) === 200) {
      await dispatch(getCompaniesList());
      dispatch(slice.actions.hasError(false));
    } else dispatch(slice.actions.hasError(response?.data?.message));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getEditCompany = async (dispatch, data, companyId) => {
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    data = { ...data, UserId: currentUser._id, updatedBy: currentUser._id, CompanyId: companyId };
    await axios({
      method: 'post',
      url: `${API.companies.updateCompany}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    // dispatch(slice.actions.getUserListSuccess(response.data.users));
    await dispatch(getCompaniesList());
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const getDeleteCompany = async (dispatch, companyId) => {
  dispatch(slice.actions.startLoading());
  try {
    const currentUser = await getIDBCurrentUser();
    const data = { UserId: currentUser._id, updatedBy: currentUser._id, CompanyId: companyId };
    await axios({
      method: 'post',
      url: `${API.companies.deleteCompany}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    await dispatch(getCompaniesList());
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};

// ----------------------------------------------------------------------

export const setCompanyList = async (dispatch, page) => {
  dispatch(slice.actions.startLoading());
  try {
    dispatch(slice.actions.getCompaniesListSuccess(page));
  } catch (error) {
    dispatch(slice.actions.hasError(error));
  }
};
