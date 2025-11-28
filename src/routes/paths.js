// ----------------------------------------------------------------------

function path(root, sublink) {
  return `${root}${sublink}`;
}

const ROOTS_AUTH = '/auth';
const ROOTS_DASHBOARD = '/dashboard';

// ----------------------------------------------------------------------

export const PATH_AUTH = {
  root: ROOTS_AUTH,
  login: path(ROOTS_AUTH, '/login'),
  loginUnprotected: path(ROOTS_AUTH, '/login-unprotected'),
  register: path(ROOTS_AUTH, '/register'),
  registerUnprotected: path(ROOTS_AUTH, '/register-unprotected'),
  forgotPassword: path(ROOTS_AUTH, '/forgot-password'),
  resetPassword: path(ROOTS_AUTH, '/reset-password'),
  verify: path(ROOTS_AUTH, '/verify')
};

export const PATH_PAGE = {
  comingSoon: '/coming-soon',
  maintenance: '/maintenance',
  pricing: '/pricing',
  payment: '/payment',
  about: '/about-us',
  contact: '/contact-us',
  faqs: '/faqs',
  page404: '/404',
  page500: '/500',
  components: '/components'
};

export const PATH_DASHBOARD = {
  root: ROOTS_DASHBOARD,
  general: {
    app: path(ROOTS_DASHBOARD, '/app'),
    ecommerce: path(ROOTS_DASHBOARD, '/ecommerce')
  },
  // dashboard: {
  //   root: path(ROOTS_DASHBOARD, '/dashboard'),
  //   dashboard: path(ROOTS_DASHBOARD, '/dashboard/dashboard')
  // },
  company: {
    root: path(ROOTS_DASHBOARD, '/company'),
    allCompanies: path(ROOTS_DASHBOARD, '/company/allCompanies'),
    newCompany: path(ROOTS_DASHBOARD, '/company/new'),
    editById: path(ROOTS_DASHBOARD, `/company/reece-chung/edit`)
  },
  role: {
    root: path(ROOTS_DASHBOARD, '/role'),
    allRoles: path(ROOTS_DASHBOARD, '/role/allRoles'),
    newRole: path(ROOTS_DASHBOARD, '/role/new'),
    editById: path(ROOTS_DASHBOARD, `/role/reece-chung/edit`),
    configurator: path(ROOTS_DASHBOARD, `/role/configurator`)
  },
  user: {
    root: path(ROOTS_DASHBOARD, '/user'),
    allUsers: path(ROOTS_DASHBOARD, '/user/allUsers'),
    profile: path(ROOTS_DASHBOARD, '/user/profile'),
    cards: path(ROOTS_DASHBOARD, '/user/cards'),
    list: path(ROOTS_DASHBOARD, '/user/list'),
    newUser: path(ROOTS_DASHBOARD, '/user/new'),
    editById: path(ROOTS_DASHBOARD, `/user/reece-chung/edit`),
    account: path(ROOTS_DASHBOARD, '/user/account')
  },
  details: {
    root: path(ROOTS_DASHBOARD, '/project'),
    home: path(ROOTS_DASHBOARD, '/details/home')
  },
  project: {
    root: path(ROOTS_DASHBOARD, '/project'),
    allProjects: path(ROOTS_DASHBOARD, '/project/allProjects'),
    archivedProjects: path(ROOTS_DASHBOARD, '/project/archivedProjects'),
    newProject: path(ROOTS_DASHBOARD, '/project/new'),
    editById: path(ROOTS_DASHBOARD, `/project/reece-chung/edit`)
  },
  module: {
    root: path(ROOTS_DASHBOARD, '/module'),
    allModules: path(ROOTS_DASHBOARD, '/module/allModules'),
    newModule: path(ROOTS_DASHBOARD, '/module/new'),
    editById: (id) => path(ROOTS_DASHBOARD, `/module/${id}/edit`),
    jsonBuilder: path(ROOTS_DASHBOARD, '/module/jsonBuilder')
  },
  testCase: {
    root: path(ROOTS_DASHBOARD, '/testCase'),
    testCasesByModule: path(ROOTS_DASHBOARD, '/testCase/testCases'),
    testcaseDetails: path(ROOTS_DASHBOARD, '/testCase/testCaseDetails')
  },
  release: {
    root: path(ROOTS_DASHBOARD, '/release'),
    allReleases: path(ROOTS_DASHBOARD, '/release/allReleases'),
    newRelease: path(ROOTS_DASHBOARD, '/release/new'),
    releaseTestCases: path(ROOTS_DASHBOARD, '/release/reece-chung/testCases'),
    editById: path(ROOTS_DASHBOARD, `/release/reece-chung/edit`),
    releaseDashboard: path(ROOTS_DASHBOARD, '/release/reece-chung/releaseDashboard')
  },
  testRuns: {
    root: path(ROOTS_DASHBOARD, '/testRuns'),
    allTestRuns: path(ROOTS_DASHBOARD, '/testRuns/allTestRuns'),
    testRunTestCases: path(ROOTS_DASHBOARD, '/testRuns/reece-chung/testCases'),
    video: path(ROOTS_DASHBOARD, '/testRuns/reece-chung/video')
  },
  genai: {
    root: path(ROOTS_DASHBOARD, '/genai'),
    testCases: path(ROOTS_DASHBOARD, '/genai/ai-test-cases')
  },
  auditLog: {
    root: path(ROOTS_DASHBOARD, '/auditLog'),
    auditLog: path(ROOTS_DASHBOARD, '/auditLog/auditLog')
  },
  report: {
    root: path(ROOTS_DASHBOARD, '/report'),
    report: path(ROOTS_DASHBOARD, '/report/report')
  }
};

export const PATH_DOCS = 'https://docs-minimals.vercel.app/introduction';
