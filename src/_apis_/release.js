// import axios from 'axios';
import axios from '../utils/axiosInstance';
import API from '../services';
import { getSessionObj } from '../utils/jwt';
import { getIDBCurrentProject } from '../main';
import { HTTP_REQUEST } from '../Constants';
import { callBackendService } from '../redux/slices/common';
// utils

// ----------------------------------------------------------------------

export const getReleaseList = async () => {
  let response = null;
  try {
    const projectSerialized = await getIDBCurrentProject();
    if (projectSerialized && projectSerialized._id) {
      response = await axios({
        method: 'get',
        url: API.releases.getReleaseByPID2(projectSerialized._id),
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

export const getReleaseTestRuns = async (releaseId) => {
  let response = null;
  try {
    response = await axios({
      method: 'get',
      url: API.testRun.releaseTestRuns(releaseId),
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

export const getReleaseInfo = async (releaseId) => {
  let response = null;
  try {
    response = await axios({
      method: 'get',
      url: API.testRun.releaseInfo(releaseId),
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
  } catch (error) {
    console.log('error', error);
  }
  return response?.data?.response;
};

// ----------------------------------------------------------------------

export const getReleaseExecutionDuration = async (releaseId, moduleId) => {
  let response = null;
  try {
    let data = { releaseId };
    if (moduleId) {
      data = { releaseId, moduleId };
    }
    response = await callBackendService(HTTP_REQUEST.POST, `${API.releases.getReleaseExecutionDuration}`, data);
  } catch (error) {
    console.log('error', error);
  }
  return response?.message?.data?.executionDuration;
};

// ----------------------------------------------------------------------

export const getReleaseStatus = async (releaseId) => {
  let response = null;
  try {
    response = await callBackendService(HTTP_REQUEST.GET, `${API.releases.getReleaseStatus(releaseId)}`, null);
  } catch (error) {
    console.log('error', error);
  }
  return response?.data;
};

// ----------------------------------------------------------------------

export const getReleaseEditObj = async (releaseId) => {
  let response = null;
  try {
    response = await callBackendService(HTTP_REQUEST.GET, `${API.releases.getRelease2Edit(releaseId)}`, null);
  } catch (error) {
    console.log('error', error);
  }
  return response?.data;
};

// ----------------------------------------------------------------------

export const getExecutingReleasesData = async (jobIds) => {
  let response = null;
  try {
    response = await axios({
      method: 'get',
      url: `${API.releases.getExecutingReleasesData(jobIds, false)}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
  } catch (error) {
    console.error('error', error);
  }
  return response?.data;
};

// ----------------------------------------------------------------------

export const getTestCaseDetails = async (jobId, moduleId, testCaseId) => {
  let response = null;
  try {
    response = await callBackendService(
      HTTP_REQUEST.GET,
      `${API.releases.getTestCaseDetails(jobId, moduleId, testCaseId)}`,
      null
    );
  } catch (error) {
    console.log('error', error);
  }
  console.log('response', response);
  return response?.data;
};
