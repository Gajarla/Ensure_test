import { Suspense, lazy, useState, useEffect } from 'react';
import { Navigate, useRoutes, useLocation } from 'react-router-dom';
// layouts
import DashboardLayout from '../layouts/dashboard';
import LogoOnlyLayout from '../layouts/LogoOnlyLayout';
// guards
import GuestGuard from '../guards/GuestGuard';
import AuthGuard from '../guards/AuthGuard';
// import RoleBasedGuard from '../guards/RoleBasedGuard';
// components
import LoadingScreen from '../components/LoadingScreen';
import useAuth from '../hooks/useAuth';
import { USER_ROLES } from '../Constants';
// import ssoLogin from '../contexts/JWTContext';
import { useSelector, useDispatch } from '../redux/store';
import { setUserAppendUrl } from '../redux/slices/user';
import { setFetchRoledata } from '../redux/slices/role';
import { getSessionObj } from '../utils/jwt';

// ----------------------------------------------------------------------

const Loadable = (Component) => (props) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { pathname } = useLocation();
  const isDashboard = pathname.includes('/dashboard');

  return (
    <Suspense
      fallback={
        <LoadingScreen
          sx={{
            ...(!isDashboard && {
              top: 0,
              left: 0,
              width: 1,
              zIndex: 9999,
              position: 'fixed'
            })
          }}
        />
      }
    >
      <Component {...props} />
    </Suspense>
  );
};

export default function Router() {
  const { user } = useAuth();
  const { ssoLogin } = useAuth();
  const dispatch = useDispatch();
  const [path, setPath] = useState();
  const { pathname } = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const paramUser = window.atob(searchParams.get('user'));
  const { currentUser, isSSO, appendUrl } = useSelector((state) => state.user);

  useEffect(() => {
    if (user?.role?.roleID) {
      if (USER_ROLES.ADMIN?.includes(user?.role?.roleID)) {
        setPath('/dashboard/user/allUsers');
      } else setPath('/dashboard/details/home');
    }
    if (searchParams.size !== 0 && ((paramUser && !currentUser) || (paramUser && !isSSO))) {
      ssoLogin(paramUser);
      setPath('/dashboard/details/home');
    }
    const url = `${window.location.href}`;
    const aUrl = url.split('?')[1];

    if (!pathname.includes('configurator')) {
      setFetchRoledata(dispatch, true);
    }

    if (aUrl && !appendUrl) {
      setUserAppendUrl(dispatch, aUrl);
    }
  }, [dispatch, user, pathname, paramUser, currentUser, isSSO, ssoLogin, searchParams.size, appendUrl]);

  return useRoutes([
    {
      path: '/',
      element: <GuestGuard>{getSessionObj('loggedintime') ? <LoadingScreen /> : <Login />}</GuestGuard>
    },
    {
      path: 'auth',
      children: [
        {
          path: 'login',
          element: (
            <GuestGuard>
              <Login />
            </GuestGuard>
          )
        },
        {
          path: 'forgot-password',
          element: (
            <GuestGuard>
              <ForgotPassword />
            </GuestGuard>
          )
        },
        {
          path: 'reset-password/:resetToken/:userId',
          element: (
            <GuestGuard>
              <ResetPassword />
            </GuestGuard>
          )
        }
      ]
    },

    // Dashboard Routes
    {
      path: 'dashboard',
      element: (
        <AuthGuard>
          <DashboardLayout />
        </AuthGuard>
      ),
      children: [
        { path: '', element: <Navigate to={path} replace /> },
        {
          path: 'company',
          children: [
            { path: '', element: <Navigate to="/dashboard/company/profile" replace /> },
            { path: 'allCompanies', element: <CompanyList /> },
            { path: 'new', element: <CompanyCreate /> },
            { path: ':companyId/edit', element: <CompanyCreate /> }
          ]
        },
        {
          path: 'role',
          children: [
            { path: '', element: <Navigate to="/dashboard/role/profile" replace /> },
            { path: 'allRoles', element: <RoleList /> },
            { path: 'new', element: <RoleCreate /> },
            { path: ':roleId/edit', element: <RoleCreate /> },
            { path: 'configurator', element: <RoleConfigurator /> }
          ]
        },
        {
          path: 'user',
          children: [
            { path: '', element: <Navigate to="/dashboard/user/profile" replace /> },
            { path: 'allUsers', element: <UserList /> },
            { path: 'new', element: <UserCreate /> },
            { path: ':userId/edit', element: <UserCreate /> }
          ]
        },
        {
          path: 'details',
          children: [
            { path: '', element: <Navigate to="/dashboard/details/home" replace /> },
            { path: 'home', element: <Dashboard /> }
          ]
        },
        {
          path: 'project',
          children: [
            { path: '', element: <Navigate to="/dashboard/project/allProjects" replace /> },
            { path: 'allProjects', element: <AllProjects /> },
            { path: 'archivedProjects', element: <ArchivedProjects /> },
            { path: 'new', element: <ProjectCreate /> },
            { path: ':projectId/edit', element: <ProjectCreate /> }
          ]
        },
        {
          path: 'module',
          children: [
            { path: '', element: <Navigate to="/dashboard/module/allModules" replace /> },
            { path: 'allModules', element: <AllModules /> },
            { path: 'new', element: <ModuleCreate /> },
            { path: ':moduleId/edit', element: <ModuleCreate /> },
            { path: ':jsonBuilder', element: <JsonBuilder /> }
          ]
        },
        {
          path: 'testCase',
          children: [
            { path: 'testCases/module/:moduleId', element: <TestCases /> },
            { path: 'testCaseDetails/:testCaseId', element: <TestCaseDetails /> }
          ]
        },
        {
          path: 'release',
          children: [
            { path: '', element: <Navigate to="/dashboard/release/allReleases" replace /> },
            { path: 'allReleases', element: <AllReleases /> },
            { path: 'new', element: <ReleaseCreate /> },
            { path: 'release/:releaseId/testCases', element: <ReleaseTestCases /> },
            { path: ':releaseId/edit', element: <ReleaseCreate /> },
            { path: ':releaseId/releaseDashboard', element: <ReleaseDashboard /> }
          ]
        },
        {
          path: 'testRuns',
          children: [
            { path: '', element: <Navigate to="/dashboard/testRuns/allTestRuns" replace /> },
            { path: 'allTestRuns', element: <TestRuns /> },
            { path: 'testRuns/:testRunId/testCases', element: <ReleaseTestCases /> },
            { path: 'testRuns/:testRunId/video', element: <TestRunVideo /> }
          ]
        },
        {
          path: 'genai',
          children: [
            { path: '', element: <Navigate to="/dashboard/genai/allTestCases" replace /> },
            { path: 'ai-test-cases', element: <GenAITestCases /> }
          ]
        },

        {
          path: 'auditLog',
          children: [
            { path: '', element: <Navigate to="/dashboard/auditLog/auditLog" replace /> },
            { path: 'auditLog', element: <AuditLog /> }
          ]
        },

        {
          path: 'report',
          children: [
            { path: '', element: <Navigate to="/dashboard/report/report" replace /> },
            { path: 'report', element: <Report /> }
          ]
        }
      ]
    },

    // Main Routes
    {
      path: '*',
      element: <LogoOnlyLayout />,
      children: [
        { path: 'coming-soon', element: <ComingSoon /> },
        { path: 'maintenance', element: <Maintenance /> },
        { path: 'pricing', element: <Pricing /> },
        { path: 'payment', element: <Payment /> },
        { path: '500', element: <Page500 /> },
        { path: '404', element: <NotFound /> },
        { path: '*', element: <Navigate to="/404" replace /> }
      ]
    },
    { path: '*', element: <Navigate to="/404" replace /> }
  ]);
}

// IMPORT COMPONENTS

// Authentication
const Login = Loadable(lazy(() => import('../pages/authentication/Login')));
const ResetPassword = Loadable(lazy(() => import('../pages/authentication/ResetPassword')));
const ForgotPassword = Loadable(lazy(() => import('../pages/authentication/ForgotPassword')));
// Dashboard
const Dashboard = Loadable(lazy(() => import('../pages/dashboard/Dashboard')));
const CompanyList = Loadable(lazy(() => import('../pages/dashboard/CompanyList')));
const CompanyCreate = Loadable(lazy(() => import('../pages/dashboard/CompanyCreate')));
const RoleList = Loadable(lazy(() => import('../pages/dashboard/RoleList')));
const RoleCreate = Loadable(lazy(() => import('../pages/dashboard/RoleCreate')));
const RoleConfigurator = Loadable(lazy(() => import('../pages/dashboard/RoleConfigurator')));
const UserList = Loadable(lazy(() => import('../pages/dashboard/UserList')));
const UserCreate = Loadable(lazy(() => import('../pages/dashboard/UserCreate')));
const AllProjects = Loadable(lazy(() => import('../pages/dashboard/AllProjects')));
const AuditLog = Loadable(lazy(() => import('../pages/dashboard/AuditLog')));
const ArchivedProjects = Loadable(lazy(() => import('../pages/dashboard/ArchivedProjects')));
const ProjectCreate = Loadable(lazy(() => import('../pages/dashboard/ProjectCreate')));
const TestCases = Loadable(lazy(() => import('../pages/dashboard/TestCases')));
const TestCaseDetails = Loadable(lazy(() => import('../pages/dashboard/TestCaseDetails')));
const AllModules = Loadable(lazy(() => import('../pages/dashboard/AllModules')));
const ModuleCreate = Loadable(lazy(() => import('../pages/dashboard/ModuleCreate')));
const AllReleases = Loadable(lazy(() => import('../pages/dashboard/AllReleases')));
const ReleaseCreate = Loadable(lazy(() => import('../pages/dashboard/ReleaseCreate')));
const ReleaseTestCases = Loadable(lazy(() => import('../pages/dashboard/ReleaseTestCases')));
const TestRunVideo = Loadable(lazy(() => import('../pages/dashboard/TestRunVideo')));
const TestRuns = Loadable(lazy(() => import('../pages/dashboard/TestRuns')));
const ReleaseDashboard = Loadable(lazy(() => import('../pages/dashboard/ReleaseDashboard')));
const JsonBuilder = Loadable(lazy(() => import('../pages/dashboard/JsonBuilder')));
const GenAITestCases = Loadable(lazy(() => import('../pages/dashboard/GenAITestCases')));
const Report = Loadable(lazy(() => import('../pages/dashboard/Report')));
// Main
const ComingSoon = Loadable(lazy(() => import('../pages/ComingSoon')));
const Maintenance = Loadable(lazy(() => import('../pages/Maintenance')));
const Pricing = Loadable(lazy(() => import('../pages/Pricing')));
const Payment = Loadable(lazy(() => import('../pages/Payment')));
const Page500 = Loadable(lazy(() => import('../pages/Page500')));
const NotFound = Loadable(lazy(() => import('../pages/Page404')));
