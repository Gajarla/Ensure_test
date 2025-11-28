// utils
// import axios from 'axios';
import axios from '../utils/axiosInstance';
import API from '../services';
import { getSessionObj } from '../utils/jwt';
import { getAllModuleList } from './module';
import STATUS from '../components/_dashboard/project/ProjectStatus';
import { setCurrentProject } from '../redux/slices/project';
import { setRoleConfig, setFetchRoledata } from '../redux/slices/role';
import { getIDBCurrentUser, getIDBCurrentProject } from '../main';

// ----------------------------------------------------------------------

export const getProjectList = async (dispatch) => {
  let projects = null;
  try {
    const currentUser = await getIDBCurrentUser();
    const companyId = currentUser?.company?._id;
    const response = await axios({
      method: 'get',
      url: `${API.projects.allProjects(companyId, currentUser?._id)}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });

    const moduleResponse = await getAllModuleList();

    const { data } = response;
    projects = data?.map((project) => {
      const modules = moduleResponse?.filter((module) => module.projectID === project._id);
      const newProject = { ...project, modulesCount: modules.length };
      return newProject;
    });
    const currentProject = await getIDBCurrentProject();
    const project = projects?.find((project) => project._id === currentProject?._id);
    if (!project) {
      setCurrentProject(dispatch, null);
      setRoleConfig(dispatch, null);
      setFetchRoledata(dispatch, true);
    }
  } catch (error) {
    console.error('error', error);
  }
  return projects;
};

// Fetch all projects of respective status in a company

export const getCompanyStatusProjectList = async (companyId, status, rowsPerPage) => {
  let allActiveProjects = null;
  try {
    const response = await axios({
      method: 'get',
      url: `${API.projects.companyStatusProjects(companyId, status, rowsPerPage)}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    allActiveProjects = response?.data;
  } catch (error) {
    console.error('error', error);
  }
  return allActiveProjects;
};

// ----------------------------------------------------------------------

// export const getFilteredProjectList = async (status, companyId) => {
//   let projects = null;
//   try {
//     let url = null;
//     const currentUser = await getIDBCurrentUser();

//     if (!companyId) companyId = currentUser?.company?._id;

//     switch (status) {
//       case STATUS.ARCHIVED:
//         url = `${API.projects.allArchivedProjects(companyId, currentUser?._id)}`;
//         break;
//       case STATUS.UNARCHIVED:
//         url = `${API.projects.allUnArchivedProjects(companyId, currentUser?._id)}`;
//         break;
//       default:
//         url = `${API.projects.allProjects(companyId)}`;
//         break;
//     }
//     const response = await axios({
//       method: 'get',
//       url,
//       headers: {
//         Authorization: `Bearer ${getSessionObj('accessToken')}`
//       }
//     });
//     projects = response?.data;
//   } catch (error) {
//     console.error('error', error);
//   }
//   return projects;
// };

export const getUnFilteredProjectList = async (status, companyId) => {
  let projects = null;
  try {
    let url = null;
    const currentUser = await getIDBCurrentUser();

    if (!companyId) companyId = currentUser?.company?._id;

    switch (status) {
      case STATUS.ARCHIVED:
        url = `${API.projects.allArchivedProjects(companyId, currentUser?._id)}`;
        break;
      case STATUS.UNARCHIVED:
        url = `${API.projects.allUnArchivedProjects(companyId, currentUser?._id)}`;
        break;
      default:
        url = `${API.projects.allProjects(companyId)}`;
        break;
    }
    const response = await axios({
      method: 'get',
      url,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    projects = response?.data;
  } catch (error) {
    console.error('error', error);
  }
  return projects;
};

export const getFilteredProjects = async (status, companyId) => {
  let projects = null;
  try {
    let url = null;
    const currentUser = await getIDBCurrentUser();

    if (!companyId) companyId = currentUser?.company?._id;

    switch (status) {
      case STATUS.ARCHIVED:
        url = `${API.projects.allArchivedProjects(companyId, currentUser?._id)}`;
        break;
      case STATUS.UNARCHIVED:
        url = `${API.projects.allUnArchivedProjectsList(companyId, currentUser?._id)}`;
        break;
      default:
        url = `${API.projects.allProjects(companyId)}`;
        break;
    }
    const response = await axios({
      method: 'get',
      url,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    projects = response?.data?.data;
  } catch (error) {
    console.error('error', error);
  }
  return projects;
};

export const getFilteredProjectList = async (status, companyId, orderBy, order, rowsPerPage, page) => {
  let projects = null;
  try {
    let url = null;
    const currentUser = await getIDBCurrentUser();
    // console.log('companyId', companyId, rowsPerPage);

    if (!companyId) companyId = currentUser?.company?._id;

    switch (status) {
      case STATUS.ARCHIVED:
        // url = `${API.projects.allArchivedProjects(companyId, currentUser?._id, orderBy)}`;
        url = `${API.projects.allArchivedProjects(companyId, currentUser?._id, orderBy, order, rowsPerPage, page)}`;
        break;
      case STATUS.UNARCHIVED:
        url = `${API.projects.allUnArchivedProjects(companyId, currentUser?._id, orderBy, order, rowsPerPage, page)}`;
        break;
      default:
        url = `${API.projects.allProjects(companyId, rowsPerPage)}`;
        break;
    }
    const response = await axios({
      method: 'get',
      url,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    projects = response?.data;
  } catch (error) {
    console.error('error', error);
  }
  return projects;
};

// ----------------------------------------------------------------------

export const getAuditLogs = async (companyId) => {
  let auditlogs = null;
  try {
    const response = await axios({
      method: 'get',
      url: `${API.auditLog.getAduitLogs(companyId)}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    auditlogs = response?.data;
  } catch (error) {
    console.error('error', error);
  }
  return auditlogs;
};

// ----------------------------------------------------------------------

export const getTestCaseSteps = async (companyId, projectId) => {
  let testCaseSteps = null;
  try {
    const response = await axios({
      method: 'get',
      url: `${API.projects.getTestCaseSteps(companyId, projectId)}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    testCaseSteps = response?.data;
  } catch (error) {
    console.error('error', error);
  }
  return testCaseSteps;
};

// ----------------------------------------------------------------------

export const getProject = async (projectId) => {
  let project = null;
  try {
    const response = await axios({
      method: 'get',
      url: `${API.projects.findProject(projectId)}`,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    project = response?.data?.data;
  } catch (error) {
    console.error('error', error);
  }
  return project;
};
