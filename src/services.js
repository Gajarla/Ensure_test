/* eslint-disable prettier/prettier */
const APP_HOST_URL = process.env.REACT_APP_API_BASE_URL;

const API_VERSION = '/api'; // /v1

const version = 'v1';

// endpoints
const API = {
  auth: {
    signIn: `${APP_HOST_URL}${API_VERSION}/auth/signin`,
    forgotPassword: `${APP_HOST_URL}${API_VERSION}/auth/forgotpassword`,
    resetPassword: `${APP_HOST_URL}${API_VERSION}/auth/${version}/resetpassword`,
    validateLicense: `${APP_HOST_URL}${API_VERSION}/auth/validateSLicense`
  },
  sso: {
    verify: `${APP_HOST_URL}${API_VERSION}/auth/verify`,
    validation: `${APP_HOST_URL}${API_VERSION}/auth/validation`
  },
  companies: {
    getAllCompanies: `${APP_HOST_URL}${API_VERSION}/users/${version}/getAllCompanies`,
    createCompany: `${APP_HOST_URL}${API_VERSION}/users/${version}/createCompany`,
    updateCompany: `${APP_HOST_URL}${API_VERSION}/users/${version}/updateCompany`,
    deleteCompany: `${APP_HOST_URL}${API_VERSION}/users/${version}/deleteCompany`
  },
  roles: {
    getAllRoles: `${APP_HOST_URL}${API_VERSION}/rolemanage/${version}/getRoles`,
    createRole: `${APP_HOST_URL}${API_VERSION}/rolemanage/${version}/createRole`,
    updateRole: `${APP_HOST_URL}${API_VERSION}/rolemanage/${version}/updateRole`,
    deleteRole: `${APP_HOST_URL}${API_VERSION}/rolemanage/${version}/deleteRole`,
    createRoleConfig: `${APP_HOST_URL}${API_VERSION}/rolemanage/${version}/RoleManage`,
    getRoleConfig: `${APP_HOST_URL}${API_VERSION}/rolemanage/${version}/getRoleManage`,
    getClientAdminRoleConfig: `${APP_HOST_URL}${API_VERSION}/rolemanage/${version}/getRoleManage/client`,
    getClientRoleConfigList: `${APP_HOST_URL}${API_VERSION}/rolemanage/${version}/getRoleManage/list`
  },
  users: {
    getAllUsers: `${APP_HOST_URL}${API_VERSION}/users/allUsers`,
    getCompanyUsers: (companyId) => `${APP_HOST_URL}${API_VERSION}/users/allUsers/${companyId}`,
    getAllTemplates: `${APP_HOST_URL}${API_VERSION}/users/allTemplates`,
    getAllRoles: `${APP_HOST_URL}${API_VERSION}/users/allRoles`,
    getUser: `${APP_HOST_URL}${API_VERSION}/users/User`,
    createUser: `${APP_HOST_URL}${API_VERSION}/users/${version}/createUser`,
    updateUser: (id) => `${APP_HOST_URL}${API_VERSION}/users/User/update/${id}`,
    deleteUser: (id) => `${APP_HOST_URL}${API_VERSION}/users/User/delete/${id}`
  },
  projects: {
    allProjects: (companyId, userId) => `${APP_HOST_URL}${API_VERSION}/projects/allProjects/${companyId}/${userId}`,
    companyStatusProjects: (companyId, status, rowsPerPage) =>
      `${APP_HOST_URL}${API_VERSION}/projects/allProjects/${companyId}/${status}/${rowsPerPage}`,
    // allArchivedProjects: (companyId, userId) =>
    //   `${APP_HOST_URL}${API_VERSION}/projects/${version}/findProjects/{"status":["ARCHIVED"]}/${companyId}/${userId}`,
    allUnFilteredUnArchivedProjects: (companyId, userId) =>
      `${APP_HOST_URL}${API_VERSION}/projects/${version}/findProjects/{"status":["ACTIVE","CLOSED"]}/${companyId}/${userId}`,
    allArchivedProjects: (companyId, userId, orderBy, order, rowsPerPage, page) =>
      `${APP_HOST_URL}${API_VERSION}/projects/${version}/findProjects/{"status":["ARCHIVED"]}/${companyId}/${userId}/${orderBy}/${order}/${rowsPerPage}/${page}`,
    allUnArchivedProjectsList: (companyId, userId) =>
      `${APP_HOST_URL}${API_VERSION}/projects/${version}/findProjects/{"status":["ACTIVE","CLOSED"]}/${companyId}/${userId}`,
    allUnArchivedProjects: (companyId, userId, orderBy, order, rowsPerPage, page) =>
      `${APP_HOST_URL}${API_VERSION}/projects/${version}/findProjects/{"status":["ACTIVE","CLOSED"]}/${companyId}/${userId}/${orderBy}/${order}/${rowsPerPage}/${page}`,
    getProject: (projectId) => `${APP_HOST_URL}${API_VERSION}/projects/Project/${projectId}`,
    findProject: (projectId) => `${APP_HOST_URL}${API_VERSION}/projects/${version}/findProject/${projectId}`,
    createProject: `${APP_HOST_URL}${API_VERSION}/projects/${version}/createProject`,
    updateProject: `${APP_HOST_URL}${API_VERSION}/projects/Project/update`,
    deleteProject: `${APP_HOST_URL}${API_VERSION}/projects/Project/delete`,
    checkProjectNameExists: `${APP_HOST_URL}${API_VERSION}/projects/Project/checkProjectNameExists`,
    allModules: `${APP_HOST_URL}${API_VERSION}/projects/allModules`,
    getModuleByProjectId: (id, fetcTestCases, fetcTestSteps) =>
      `${APP_HOST_URL}${API_VERSION}/projects/v2/ModuleByPID/${id}/${fetcTestCases}/${fetcTestSteps}`,
    getModuleListByProjectId: (id, orderBy, order, rowsPerPage, page, fetcTestCases, fetcTestSteps) =>
      `${APP_HOST_URL}${API_VERSION}/projects/v2/ModuleByPID/${id}/${orderBy}/${order}/${rowsPerPage}/${page}/${fetcTestCases}/${fetcTestSteps}`,
    getTestCasesByModuleId: (pid, mid, orderBy, order, rowsPerPage, page, fetcTestCases, fetcTestSteps) =>
      `${APP_HOST_URL}${API_VERSION}/projects/v2/ModuleByPID/${pid}/${mid}/${orderBy}/${order}/${rowsPerPage}/${page}/${fetcTestCases}/${fetcTestSteps}`,
    getModulesByProjectId: (id) => `${APP_HOST_URL}${API_VERSION}/projects/ModulesByPID/${id}`,
    getModulesList: (moduleId) => `${APP_HOST_URL}${API_VERSION}/projects/${version}/ModuleByPID/${moduleId}`,
    getModuleDetails: (id) => `${APP_HOST_URL}${API_VERSION}/projects/${version}/ModuleDetails/${id}/All`,
    projectModules: `${APP_HOST_URL}${API_VERSION}/projects/Project`,
    createModule: `${APP_HOST_URL}${API_VERSION}/projects/${version}/createModule`,
    parseTestCases: `${APP_HOST_URL}${API_VERSION}/projects/parseTestCases`,
    createManualModule: `${APP_HOST_URL}${API_VERSION}/projects/createManualModule`,
    updateModule: (id) => `${APP_HOST_URL}${API_VERSION}/projects/Module/update/${id}`,
    deleteModule: `${APP_HOST_URL}${API_VERSION}/projects/Module/delete`,
    downLoadModule: `${APP_HOST_URL}${API_VERSION}/projects/downloadModule`,
    getTemplates: `${APP_HOST_URL}${API_VERSION}/projects/getTemplates`,
    getTemplatesByCompanyId: (companyId) => `${APP_HOST_URL}${API_VERSION}/projects/getTemplates/${companyId}`,
    getTestCaseSteps: (companyId, projectId) =>
      `${APP_HOST_URL}${API_VERSION}/projects/getTestCaseSteps/${companyId}/${projectId}`,
    download: (userId, filename) => `${APP_HOST_URL}${API_VERSION}/releases/${version}/download/${userId}/${filename}`
  },
  releases: {
    release: `${APP_HOST_URL}${API_VERSION}/releases/Release/XMLConfig`,
    getRelease: (id) => `${APP_HOST_URL}${API_VERSION}/releases/Release/${id}`,
    deleteRelease: `${APP_HOST_URL}${API_VERSION}/releases/Release/delete`,
    getAllReleases: `${APP_HOST_URL}${API_VERSION}/releases/allReleases`,
    // getReleaseByPID: (projectID, orderBy, order, rowsPerPage, page) =>
    //   `${APP_HOST_URL}${API_VERSION}/releases/${version}/ReleaseByPID/${projectID}/${orderBy}/${order}/${rowsPerPage}/${page}`,
    getReleaseByPID2: (projectID) => `${APP_HOST_URL}${API_VERSION}/releases/${version}/ReleaseByPID/${projectID}`,
    getReleaseByPID: (projectID, orderBy, order, rowsPerPage, page, searchTerm) =>
      `${APP_HOST_URL}${API_VERSION}/releases/${version}/ReleaseByPID/${projectID}/${orderBy}/${order}/${rowsPerPage}/${page}${
        searchTerm ? `?searchTerm=${encodeURIComponent(searchTerm)}` : ''
      }`,
    getReleaseStatus: (releaseId) => `${APP_HOST_URL}${API_VERSION}/releases/v4/getReleaseStatus/${releaseId}`,
    getTestCaseDetails: (jobId, moduleId, testCaseId) =>
      `${APP_HOST_URL}${API_VERSION}/releases/${version}/getTestCaseDetails/${jobId}/${moduleId}/${testCaseId}`,
    getTestRunStatus: (jobId) => `${APP_HOST_URL}${API_VERSION}/releases/v3/getTestRunStatus/${jobId}`,
    exportTestRunResults: `${APP_HOST_URL}${API_VERSION}/releases/v1/exportTestRunResults`,
    getMultiTestRunStatus: (jobIds) => `${APP_HOST_URL}${API_VERSION}/releases/getMultipleTestRunStatus/${jobIds}`,
    createRelease: `${APP_HOST_URL}${API_VERSION}/releases/createRelease`,
    getRelease2Edit: (releaseId) => `${APP_HOST_URL}${API_VERSION}/releases/${version}/getRelease/${releaseId}`,
    updateRelease: `${APP_HOST_URL}${API_VERSION}/releases/${version}/updateRelease`,
    createJenkinsJob: `${APP_HOST_URL}${API_VERSION}/releases/createJenkinsJob`,
    getAllJobs: `${APP_HOST_URL}${API_VERSION}/releases/AllJobs`,
    testResults: `${APP_HOST_URL}${API_VERSION}/releases/TestResults/fetch`,
    getReleaseExecutionDuration: `${APP_HOST_URL}${API_VERSION}/releases/${version}/getReleaseExecutionDuration`,
    exportModule: `${APP_HOST_URL}${API_VERSION}/releases/${version}/exportModule`,
    getExecutingReleasesData: (releaseIds, includeFailedTestCaseStepDetails) =>
      `${APP_HOST_URL}${API_VERSION}/releases/ReleaseDetail/${releaseIds}?includeFailedTestCaseStepDetails=${includeFailedTestCaseStepDetails}`
  },
  testsuites: {
    getExecutionData: `${APP_HOST_URL}${API_VERSION}/testsuites/TestSuite`,
    getTestSuitesByModules: `${APP_HOST_URL}${API_VERSION}/testsuites/getTestSuitesByModules`
  },
  testRun: {
    getReleaseTestRunVersion: `${APP_HOST_URL}${API_VERSION}/releases/${version}/getReleaseTestRunVersion`,
    createJob: (releaseId) => `${APP_HOST_URL}${API_VERSION}/releases/v2/createJob/${releaseId}`,
    reRunJob: (jobId) => `${APP_HOST_URL}${API_VERSION}/releases/reRunJob/${jobId}`,
    stopJob: (jobId) => `${APP_HOST_URL}${API_VERSION}/releases/stopJob/${jobId}`,
    // getJobsByPID: (projectId) => `${APP_HOST_URL}${API_VERSION}/projects/allJobs/${projectId}`,
    getJobsByPID: (projectId) => `${APP_HOST_URL}${API_VERSION}/projects/v1/allJobs/${projectId}`,
    // getAllJobsByPID: (projectId, orderBy, order, rowsPerPage, page) =>
    //   `${APP_HOST_URL}${API_VERSION}/projects/v1/allJobs/${projectId}/${orderBy}/${order}/${rowsPerPage}/${page}`,
    getAllJobsByPID: (projectId, orderBy, order, rowsPerPage, page, searchTerm) =>
      `${APP_HOST_URL}${API_VERSION}/projects/v1/allJobs/${projectId}/${orderBy}/${order}/${rowsPerPage}/${page}${
        searchTerm ? `?searchTerm=${encodeURIComponent(searchTerm)}` : ''
      }`,
    getJiraJobsStatusUpdate: (jobIds, includeFailedTestCaseStepDetails) =>
      `${APP_HOST_URL}${API_VERSION}/releases/jobStatusDetail/${jobIds}?includeFailedTestCaseStepDetails=${includeFailedTestCaseStepDetails}`,
    getJobById: (jobId) => `${APP_HOST_URL}${API_VERSION}/releases/jobDetails/${jobId}`,
    getJobUpdate: (jobId, id, status) => `${APP_HOST_URL}${API_VERSION}/releases/jobUpdate/${jobId}/${id}/${status}`,
    releaseTestRuns: (releaseId) => `${APP_HOST_URL}${API_VERSION}/releases/allJobs/${releaseId}`,
    releaseInfo: (releaseId) => `${APP_HOST_URL}${API_VERSION}/releases/${version}/ReleaseInfo/${releaseId}`,
    testCaseUpdate: (testRunId, moduleId, id, testCaseId) =>
      `${APP_HOST_URL}${API_VERSION}/releases/testCaseUpdate/${testRunId}/${moduleId}/${id}/${testCaseId}`,
    getTestCaseResults: (fileName) => `${APP_HOST_URL}${API_VERSION}/releases/getTestCaseResults/${fileName}`,
    getTestCaseLogs: (fileName) => `${APP_HOST_URL}${API_VERSION}/releases/getTestCaseLogs/${fileName}`,
    getTestResultFiles: `${APP_HOST_URL}${API_VERSION}/releases/v5/gettestresultfiles`,
    getScreenshot: `${APP_HOST_URL}${API_VERSION}/releases/v1/gettestresultfile`,
    getGenAITestCases: `${APP_HOST_URL}${API_VERSION}/releases/${version}/getGenAITestCases`,
    // generatePresignedUrl: `${APP_HOST_URL}${API_VERSION}/releases/${version}/generatePresignedUrl`,
    getJob: (userId, testRunId) => `${APP_HOST_URL}${API_VERSION}/releases/${version}/getJob/${userId}/${testRunId}`,
    getModule: (userId, moduleId) =>
      `${APP_HOST_URL}${API_VERSION}/releases/${version}/getModule/${userId}/${moduleId}`,
    streamVideo: (userId, testRunId) =>
      `${APP_HOST_URL}${API_VERSION}/releases/${version}/video/stream/${userId}/${testRunId}`,
    downloadVideo: (userId, testRunId) =>
      `${APP_HOST_URL}${API_VERSION}/releases/${version}/video/download/${userId}/${testRunId}`,
    downloadExportedFile: (userId, testRunId) =>
      `${APP_HOST_URL}${API_VERSION}/releases/${version}/exportedFile/download/${userId}/${testRunId}`,
    liveStreamVideo: (jenkinsJobName, testRunId) =>
      `${APP_HOST_URL}${API_VERSION}/releases/${version}/video/livestream/${jenkinsJobName}/${testRunId}/index.m3u8`,
    getLatestTestRunUser: (id, type) => `${APP_HOST_URL}${API_VERSION}/releases/latestTestRunUser/${id}/${type}`,
    getAttachmentByEmail: `${APP_HOST_URL}${API_VERSION}/releases/${version}/sendAttachmentInEmail`
  },
  defectTracker: {
    createUser: `${APP_HOST_URL}${API_VERSION}/users/${version}/createUserinDefectTracker`,
    getIssues: `${APP_HOST_URL}${API_VERSION}/users/${version}/Issues/list`
  },
  auditLog: {
    getAduitLogs: (company) => `${APP_HOST_URL}${API_VERSION}/audits/Audit/${company}`
  },
  validate: {
    getValidations: () => `${APP_HOST_URL}${API_VERSION}/projects/getValidations`
  }
};

export default API;
