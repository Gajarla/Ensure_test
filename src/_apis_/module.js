// utils
// import axios from 'axios';
import axios from '../utils/axiosInstance';
import API from '../services';
import { getSessionObj } from '../utils/jwt';
import { getIDBCurrentProject } from '../main';
import { HTTP_REQUEST } from '../Constants';
import { callBackendService } from '../redux/slices/common';

// ----------------------------------------------------------------------

export const getAllModuleList = async () => {
  let response = null;
  try {
    response = await axios({
      method: 'get',
      url: API.projects.allModules,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
  } catch (error) {
    console.log('error', error);
  }
  return response?.data;
};

// ----------------------------------------------------------------------

export const getModuleList = async (fetchTestCases = false, fetchTestSteps = false) => {
  let response = null;
  try {
    const projectSerialized = await getIDBCurrentProject();
    if (projectSerialized && projectSerialized._id) {
      response = await axios({
        method: 'get',
        url: API.projects.getModuleByProjectId(projectSerialized._id, fetchTestCases, fetchTestSteps),
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
    }
  } catch (error) {
    console.log('error', error);
  }
  return response?.data?.response;
};

// ----------------------------------------------------------------------

export const getModulesList = async () => {
  let response = null;
  try {
    const projectSerialized = await getIDBCurrentProject();
    if (projectSerialized && projectSerialized._id) {
      response = await axios({
        method: 'get',
        url: API.projects.getModulesByProjectId(projectSerialized._id),
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
    }
  } catch (error) {
    console.log('error', error);
  }
  return response?.data;
};

// ----------------------------------------------------------------------

export const getModuleDetails = async () => {
  let response = null;
  try {
    const projectSerialized = await getIDBCurrentProject();
    if (projectSerialized && projectSerialized._id) {
      response = await axios({
        method: 'get',
        url: API.projects.getModuleDetails(projectSerialized._id),
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
    }
  } catch (error) {
    console.log('error', error);
  }
  return response?.data;
};

// ----------------------------------------------------------------------

export const getExportModule = async (data) => {
  let response = null;
  try {
    const projectSerialized = await getIDBCurrentProject();
    if (projectSerialized && projectSerialized._id) {
      response = await callBackendService(HTTP_REQUEST.POST, `${API.releases.exportModule}`, data);
      console.log('response', response?.data?.exceldata);
    }
  } catch (error) {
    console.log('error', error);
  }
  return response?.data?.exceldata;
};
