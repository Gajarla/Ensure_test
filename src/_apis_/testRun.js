// import axios from 'axios';
import axios from '../utils/axiosInstance';
import API from '../services';
import { getSessionObj } from '../utils/jwt';
import { getIDBCurrentProject } from '../main';
import { HTTP_REQUEST } from '../Constants';
import { callBackendService } from '../redux/slices/common';
// utils

// ----------------------------------------------------------------------

export const getTestRunList = async () => {
  let response = null;
  try {
    const projectSerialized = await getIDBCurrentProject();
    if (projectSerialized && projectSerialized._id) {
      response = await axios({
        method: 'get',
        url: API.testRun.getJobsByPID(projectSerialized._id),
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

export const getTestRunById = async (testRunId) => {
  let response = null;
  try {
    response = await axios({
      method: 'get',
      url: `${API.testRun.getJobById(testRunId)}`,
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

export const getTestRunStatus = async (jobId) => {
  let response = null;
  try {
    response = await callBackendService(HTTP_REQUEST.GET, `${API.releases.getTestRunStatus(jobId)}`, null);
  } catch (error) {
    console.log('error', error);
  }
  return response?.data;
};

// ----------------------------------------------------------------------

export const getUpdatedJiraJobsStatus = async (jobIds) => {
  let response = null;
  try {
    response = await axios({
      method: 'get',
      // Passing false as there is no need of failed test case step screenshot while getting Jira jobs status
      // It is required only when user clicks on 'Export' button to download excel
      url: `${API.testRun.getJiraJobsStatusUpdate(jobIds, false)}`,
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

export const exportTestRunResults = async (data) => {
  let response = null;
  try {
    response = await callBackendService(HTTP_REQUEST.POST, `${API.releases.exportTestRunResults}`, data);
  } catch (error) {
    console.log('error', error);
  }
  return response;
};
