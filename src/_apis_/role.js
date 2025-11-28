// import axios from 'axios';
import axios from '../utils/axiosInstance';
import API from '../services';
import { getSessionObj } from '../utils/jwt';
import { getIDBCurrentUser } from '../main';
import { PERSIST_STORE } from '../Constants';
// utils

// ----------------------------------------------------------------------

export const getRolesList = async () => {
  let response = null;
  try {
    let currentUser = await getIDBCurrentUser();
    if (!currentUser) currentUser = JSON.parse(getSessionObj(PERSIST_STORE.USER));
    const data = { UserId: currentUser._id };
    response = await axios({
      method: 'post',
      url: `${API.roles.getAllRoles}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
  } catch (error) {
    console.log('error', error);
  }
  return response?.data?.data;
};

// ----------------------------------------------------------------------

export const getClientsRoleConfigList = async () => {
  let response = null;
  try {
    let currentUser = await getIDBCurrentUser();
    if (!currentUser) currentUser = JSON.parse(getSessionObj(PERSIST_STORE.USER));
    if (currentUser) {
      const data = { UserId: currentUser._id, companyId: currentUser?.company?._id, rid: currentUser?.role?._id };
      response = await axios({
        method: 'post',
        url: `${API.roles.getClientRoleConfigList}`,
        data,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
    }
  } catch (error) {
    console.log('error', error);
  }
  return response?.data?.data;
};

// ----------------------------------------------------------------------

export const getClientsRoleConfig = async (user) => {
  let response = null;
  try {
    let currentUser = await getIDBCurrentUser();
    if (!currentUser) currentUser = JSON.parse(getSessionObj(PERSIST_STORE.USER));
    if (!currentUser) currentUser = user;
    if (currentUser) {
      const data = { UserId: currentUser?._id, companyId: currentUser?.company?._id, rid: currentUser?.role?._id };
      response = await axios({
        method: 'post',
        url: `${API.roles.getRoleConfig}`,
        data,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
    }
  } catch (error) {
    console.log('error', error);
    if (error.response) response = error.response;
  }
  return response?.data?.data || response;
};

// ----------------------------------------------------------------------

export const getDefaultRoleConfig = async () => {
  let response = null;
  try {
    let currentUser = await getIDBCurrentUser();
    if (!currentUser) currentUser = JSON.parse(getSessionObj(PERSIST_STORE.USER));
    if (currentUser) {
      const data = { UserId: currentUser._id, companyId: 'DEFAULT', rid: 'DEFAULT' };
      response = await axios({
        method: 'post',
        url: `${API.roles.getRoleConfig}`,
        data,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
    }
  } catch (error) {
    console.log('error', error);
  }
  return response?.data?.data;
};

// ----------------------------------------------------------------------

export const getClientAdminRoleConfig = async (user) => {
  let response = null;
  try {
    let currentUser = await getIDBCurrentUser();
    if (!currentUser) currentUser = JSON.parse(getSessionObj(PERSIST_STORE.USER));
    if (!currentUser) currentUser = user;
    if (currentUser) {
      const data = { UserId: currentUser._id, companyId: 'CLIENT_ADMIN', rid: 'CLIENT_ADMIN' };
      response = await axios({
        method: 'post',
        url: `${API.roles.getClientAdminRoleConfig}`,
        data,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
    }
  } catch (error) {
    console.log('error', error);
  }
  return response?.data?.data;
};

// ----------------------------------------------------------------------
