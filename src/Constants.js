export const STATUS = ['ARCHIVED', 'CLOSED'];

export const USER_ROLES = {
  ADMIN: 'R0001',
  CLIENT_ADMIN: 'R0002',
  QA_ENGINEER: 'R0003',
  RELEASE_MANAGER: 'R0004',
  EXECUTOR: 'R0005',
  EXECUTIVES: 'R0006',
  AUTOMATION_USER: 'R0007'
};

export const JOB_STATUS = {
  UNTESTED: 'UNTESTED',
  IGNORED: 'IGNORED',
  WARNING: 'WARNING',
  PASSED: 'PASSED',
  SKIPPED: 'SKIPPED',
  FAILED: 'FAILED'
};

export const STATUS_CODES = [
  { id: 'UNTESTED', label: 'UNTESTED' },
  { id: 'IGNORED', label: 'IGNORED' },
  { id: 'WARNING', label: 'WARNING' },
  { id: 'PASSED', label: 'PASSED' },
  { id: 'SKIPPED', label: 'SKIPPED' },
  { id: 'FAILED', label: 'FAILED' }
];

export const STATUS_COLORS = {
  TOTAL: {
    light: '#e5e5e5',
    highlight: '#000000' // green
  },
  PASSED: {
    light: '#E6F4EA',
    highlight: '#229A16' // green
  },
  FAILED: {
    light: '#FDECEA',
    highlight: '#B72136' // red
  },
  UNTESTED: {
    light: '#F2F3F4',
    highlight: '#9A9B9C' // gray
  },
  BLOCKED: {
    light: '#E0F7FA',
    highlight: '#16ABC5' // cyan
  },
  SKIPPED: {
    light: '#E3F2FD',
    highlight: '#1E88E5' // blue
  },
  IGNORED: {
    light: '#FFF8E1',
    highlight: '#E8AA0F' // yellow
  },
  WARNING: {
    light: '#FFF3E0',
    highlight: '#F57C00' // orange
  }
};

export const PERSIST_STORE = { USER: 'redux-user', PROJECT: 'redux-project' };

export const highlight = ['[PASSED]', '[FAILED]', '[SKIPPED]'];

// export default { STATUS, PERSIST_STORE };

export const HTTP_REQUEST = { GET: 'get', POST: 'post', PATCH: 'patch', DELETE: 'delete' };

const Constants = { STATUS, PERSIST_STORE };

export const ACCESS_TOKEN = 'accessToken';

export const LOGGED_IN_TIME = 'loggedintime';

export const CURRENT_USER = 'currentUser';

export const CURRENT_PROJECT = 'currentProject';

export const INDEXEDDB_NAME = 'tedata';

export const IndexedDB = {
  USER: 'user',
  ROLE: 'role',
  COMPANY: 'company',
  PROJECT: 'project',
  MODULE: 'module',
  RELEASE: 'release',
  TESTRUN: 'testRun'
};

export const INDEXEDDB_PERMISSIONS = { READ_WRITE: 'readwrite', READ_ONLY: 'readonly' };

export const INDEXEDDB_KEYS = {
  CURRENT_USER,
  CURRENT_PROJECT,
  CURRENT_MODULE: 'currentModule',
  CURRENT_RELEASE: 'currentRelease',
  CURRENT_TESTRUN: 'currentTestRun',
  ROLE_CONFIG: 'roleConfig',
  SELECTED_TESTCASE: 'selectedTestCase',
  TESTSTEP_RESULTS: 'testStepResults',
  EVIDENCES_FETCHED: 'evidencesFetched',
  TESTSTEP_DETAILS: 'testStepDetails',
  TESTSTEP_LOGS: 'testStepLogs',
  CURRENT_FUNCTION: 'currentFunction',
  TESTCASE_EVIDENCES_FECTHED: 'testCaseEvidencesFetched'
};

export const RELEASE_SCHEDULE = {
  NO_REPEAT: 'No Repeat',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly'
};

export const GEN_AI_INPUT = {
  TEXT: 'text',
  IMAGE: 'image'
};

export const EXCLUDE_KEYS = ['url', 'username', 'password', 'tpId', 'jobId', 'testRunProcessed'];

export const EXCLUDE_SET_KEYS = ['tpId', 'jobId', 'testRunProcessed'];

export const JOB_RUNNING_STATUS = {
  IN_QUEUE: 'In Queue',
  WAITING: 'Waiting',
  RE_RUN: 'Re Run',
  IN_PROGRESS: 'In Progress',
  UPLOADING_VIDEO: 'Uploading Video',
  ABORTED: 'Aborted',
  COMPLETED: 'Completed'
};

export const MODULE_VALIDATIONS = {
  VALIDATE: 'validate'
};

export const FILE_TYPE = { JSON: 'JSON', TEST_DATA: 'TEST_DATA', MANUAL: 'MANUAL' };

export const ACCEPT_JSON = { 'application/json': ['.json'] };

export const ACCEPT_EXCEL = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/octet-stream': ['.xls', '.xlsx'] // fallback type some browsers use
};

export const ACCEPT_JSON_XML = {
  'application/json': ['.json'],
  'application/xml': ['.xml'],
  'text/xml': ['.xml'] // some browsers use this for XML
};

export default Constants;
