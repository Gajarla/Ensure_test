import PropTypes from 'prop-types';
import { useEffect, useState, useCallback } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
// material
import { alpha, styled } from '@mui/material/styles';
import { Box, Stack, Drawer, Typography } from '@mui/material';
// hooks
import useAuth from '../../hooks/useAuth';
import useCollapseDrawer from '../../hooks/useCollapseDrawer';
import { useSelector, useDispatch } from '../../redux/store';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// components
import mainlogo from '../TestEnsure_Logo.svg';
import MyAvatar from '../../components/MyAvatar';
import Scrollbar from '../../components/Scrollbar';
import NavSection from '../../components/NavSection';
import { MHidden } from '../../components/@material-extend';
//
import sidebarConfig from './SidebarConfig';
import sidebarAdminConfig from './sidebarAdminConfig';
import sidebarClientConfig from './sidebarClientConfig';
import sidebarDefaultConfig from './sidebarDefaultConfig';
import sidebarProjectConfig from './SidebarProjectConfig';
import { setCurrentProject } from '../../redux/slices/project';
import { setDefaultRoleConfig, setClientsRoleConfig, setRoleConfig, setFetchRoledata } from '../../redux/slices/role';
import { getClientsRoleConfig, getClientAdminRoleConfig, getDefaultRoleConfig } from '../../_apis_/role';
import { getIDBCurrentUser, getIDBCurrentProject, setIndexedDBObject, setIDBCurrenrProject } from '../../main';
import { getSessionObj, setSessionObj } from '../../utils/jwt';
import { IndexedDB, INDEXEDDB_KEYS, USER_ROLES, PERSIST_STORE } from '../../Constants';

// ----------------------------------------------------------------------

const DRAWER_WIDTH = 280;
const COLLAPSE_WIDTH = 102;

const adminRoles = [USER_ROLES.ADMIN, USER_ROLES.CLIENT_ADMIN];

const RootStyle = styled('div')(({ theme }) => ({
  [theme.breakpoints.up('lg')]: {
    flexShrink: 0,
    transition: theme.transitions.create('width', {
      duration: theme.transitions.duration.complex
    })
  }
}));

const AccountStyle = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2, 2.5),
  borderRadius: theme.shape.borderRadiusSm,
  backgroundColor: theme.palette.grey[500_12]
}));

// ----------------------------------------------------------------------

DashboardSidebar.propTypes = {
  isOpenSidebar: PropTypes.bool,
  onCloseSidebar: PropTypes.func
};

const filterByRole = (sidebarConfig, user) => {
  const filteredData = sidebarConfig;
  const sections = [];
  filteredData?.forEach((section) => {
    const filteredItems = section.items?.filter((item) => item.roles?.includes(user?.role?.roleID));
    if (filteredItems?.length > 0) {
      sections.push({ ...section, items: filteredItems });
    }
  });
  return sections.length === 0 ? sidebarConfig : sections;
};

const filterByRoleConfig = async (sidebarConfig, clientsRoleConfig, user, currentProject) => {
  try {
    const currentUser = await getIDBCurrentUser();
    if (clientsRoleConfig) {
      const roleConfig = clientsRoleConfig[0]?.components[0];

      const newConfig = [];
      let sections = [];

      if (roleConfig && Object.keys(roleConfig)?.length > 0) {
        Object.keys(roleConfig)?.forEach((config) => {
          const active = Object.keys(roleConfig[config]).filter((k) => roleConfig[config][k]).length;
          if (active !== 0) newConfig.push(config.toLowerCase());
        });
        const filteredData = sidebarConfig;

        if (!adminRoles.includes(currentUser?.role?.roleID.toString())) {
          filteredData?.forEach((section) => {
            const filteredItems = section.items?.filter((item) =>
              newConfig?.includes(item?.title.replaceAll(' ', '')?.toLowerCase())
            );
            if (filteredItems?.length > 0) {
              sections.push({ ...section, items: filteredItems });
            }
          });
        }
      }
      if (currentUser?.role?.roleID === USER_ROLES.ADMIN) sections = sidebarAdminConfig;
      if (currentUser?.role?.roleID === USER_ROLES.CLIENT_ADMIN)
        sections = currentProject ? filterByRole(sidebarProjectConfig) : sidebarClientConfig;
      if (sections.length === 0 && !adminRoles.includes(currentUser?.role?.roleID)) sections = sidebarDefaultConfig;
      if (currentUser && sections.length === 0) return sidebarConfig;
      if (currentUser && sections.length !== 0) return sections;
    }
  } catch (error) {
    console.log('error', error);
  }
  return null;
};

export default function DashboardSidebar({ isOpenSidebar, onCloseSidebar }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { logout } = useAuth();
  const [user, setUser] = useState(useAuth());
  const { currentUser, appendUrl } = useSelector((state) => state.user);
  const { currentProject, projectList } = useSelector((state) => state.project);
  const { defaultRoleConfig, clientsRoleConfig, roleConfig, fetchRoleData } = useSelector((state) => state.role);
  const [navConfig, setNavConfig] = useState();

  const { isCollapse, collapseClick, collapseHover, onHoverEnter, onHoverLeave } = useCollapseDrawer();

  const getUrl = useCallback(
    (url) => {
      let newUrl = url;
      const nurl = `${window.location.href}`;
      const aUrl = nurl.split('?')[1];
      if (appendUrl) newUrl = `${url}?${appendUrl}`;
      else if (aUrl) newUrl = `${url}?${aUrl}`;
      return newUrl;
    },
    [appendUrl]
  );

  const navigateToLink = useCallback(
    (url) => {
      navigate(getUrl(url));
    },
    [navigate, getUrl]
  );

  const setUserRoleConfig = useCallback(
    async (clientsRoleConfig) => {
      let user = currentUser;
      if (!user) user = await getIDBCurrentUser();
      const roleConfig = clientsRoleConfig?.find(
        (clientRoleConfig) =>
          clientRoleConfig.rid === user?.role?._id ||
          clientRoleConfig.rid === 'DEFAULT' ||
          clientRoleConfig.rid === 'CLIENT_ADMIN'
      );
      if (user?.role?.roleID !== USER_ROLES.CLIENT_ADMIN && roleConfig && !pathname.includes('configurator')) {
        setRoleConfig(dispatch, roleConfig?.components[0]);
      }
      if (user?.role?.roleID === USER_ROLES.CLIENT_ADMIN) {
        const clientsAdminRoleConfig = await getClientAdminRoleConfig(user);
        const roleConfig = clientsAdminRoleConfig?.find(
          (clientRoleConfig) =>
            clientRoleConfig.rid === user?.role._id ||
            clientRoleConfig.rid === 'DEFAULT' ||
            clientRoleConfig.rid === 'CLIENT_ADMIN'
        );
        if (clientsAdminRoleConfig && !pathname.includes('configurator')) {
          setRoleConfig(dispatch, roleConfig?.components[0]);
        }
      }
    },
    [dispatch, pathname, currentUser]
  );

  const getDefaultConfig = useCallback(async () => {
    if (!defaultRoleConfig) {
      const dRoleConfig = await getDefaultRoleConfig();
      if (dRoleConfig) setDefaultRoleConfig(dispatch, dRoleConfig[0]);
    }
  }, [dispatch, defaultRoleConfig]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    }
  }, [logout]);

  useEffect(() => {
    const initialize = async () => {
      if (isOpenSidebar) {
        onCloseSidebar();
      }

      if (fetchRoleData) {
        setFetchRoledata(dispatch, false);
        let user = currentUser;
        if (!user) user = await getIDBCurrentUser();
        if (!user) user = JSON.parse(getSessionObj(PERSIST_STORE.USER));
        setUser(user);

        // const cproject = await getIDBCurrentProject();
        // setCurrentProject(dispatch, cproject);
        const cRoleConfig = await getClientsRoleConfig(user);
        if (cRoleConfig?.status === 401 && cRoleConfig?.data?.message === 'Invalid token') handleLogout();
        else {
          setClientsRoleConfig(dispatch, cRoleConfig);

          const moduleCount =
            roleConfig?.projectModules && Object.values(roleConfig?.projectModules).reduce((a, item) => a + item, 0);
          const releasesCount =
            roleConfig?.releases && Object.values(roleConfig?.releases).reduce((a, item) => a + item, 0);
          const testRunsCount =
            roleConfig?.testRuns && Object.values(roleConfig?.testRuns).reduce((a, item) => a + item, 0);
          getDefaultConfig();
          filterByRoleConfig(sidebarConfig, cRoleConfig, user);

          let currentProject =
            (await getIDBCurrentProject()) || JSON.parse(window.localStorage.getItem(PERSIST_STORE.PROJECT));

          const teamids = currentProject?.team?.map((user) => user._id);
          const isCurrentProject = teamids?.includes(user?._id);

          if (currentProject && !isCurrentProject) {
            setCurrentProject(dispatch, null);
            setSessionObj(PERSIST_STORE.PROJECT);
            setIDBCurrenrProject(null);
            currentProject = null;
          }

          const navConfig = currentProject
            ? await filterByRoleConfig(sidebarProjectConfig, cRoleConfig, user, currentProject)
            : await filterByRoleConfig(sidebarConfig, cRoleConfig, user, currentProject);
          if (!navConfig || navConfig?.length === 0) setFetchRoledata(dispatch, true);
          if (navConfig && navConfig?.length !== 0) setNavConfig(navConfig);
          let configItems = [];
          navConfig?.forEach((configItem) => {
            const items = configItem?.items?.map((item) => item.path);
            configItems = [...configItems, ...items];
          });
          const pathnames = pathname.split('/');
          const checkPath = configItems?.filter(
            (str) =>
              (str.includes(pathnames[2]) || str.includes(pathnames[4]) || pathnames[3] === 'testCaseDetails') &&
              pathnames[2] !== 'details'
          )?.length;

          if (
            !configItems?.includes(pathname) &&
            checkPath === 0 &&
            moduleCount &&
            moduleCount !== 0 &&
            releasesCount &&
            releasesCount !== 0 &&
            testRunsCount &&
            testRunsCount !== 0 &&
            pathnames[2] &&
            pathnames[2] !== 'details' &&
            !['R0001'].includes(user?.role?.roleID)
          ) {
            navigateToLink(PATH_DASHBOARD.project.allProjects);
          } else if (
            configItems?.includes(pathname) ||
            moduleCount !== 0 ||
            releasesCount !== 0 ||
            testRunsCount !== 0
          ) {
            if (pathname.includes('/user/allUsers')) {
              navigateToLink(PATH_DASHBOARD.user.allUsers);
            } else if (pathname.includes('/company/allCompanies')) {
              navigateToLink(PATH_DASHBOARD.company.allCompanies);
            } else if (pathname.includes('/role/allRoles')) {
              navigateToLink(PATH_DASHBOARD.role.allRoles);
            } else if (pathname.includes('/genai/ai-test-cases')) {
              navigateToLink(PATH_DASHBOARD.genai.testCases);
            } else if (
              !currentProject &&
              !pathname.includes('/details/') &&
              !pathname.includes('/project/') &&
              !pathname.includes('/user/') &&
              !pathname.includes('/company/') &&
              !pathname.includes('/role/') &&
              !pathname.includes('archivedProjects') &&
              !pathname.includes('auditLog') &&
              !['R0001', 'R0002'].includes(user?.role?.roleID)
            ) {
              navigateToLink(PATH_DASHBOARD.details.home);
            }
          }

          if (pathname.includes('configurator') && defaultRoleConfig?.components)
            setRoleConfig(dispatch, defaultRoleConfig?.components[0]);
          else setUserRoleConfig(cRoleConfig);
        }
      }
    };
    initialize();
    if (roleConfig) {
      setIndexedDBObject(IndexedDB.ROLE, INDEXEDDB_KEYS.ROLE_CONFIG, roleConfig);
    }
  }, [
    dispatch,
    pathname,
    currentUser,
    currentProject,
    defaultRoleConfig,
    clientsRoleConfig,
    projectList,
    getDefaultConfig,
    isOpenSidebar,
    navigate,
    navigateToLink,
    onCloseSidebar,
    roleConfig,
    setUserRoleConfig,
    user,
    handleLogout,
    navConfig,
    fetchRoleData
  ]);

  const getTitle = () => {
    let text = 'All Projects';
    if (currentProject?.name) text = currentProject?.name;
    else if (!currentProject && currentUser?.role?.roleID === USER_ROLES.ADMIN) text = 'Admin';
    return text;
  };

  const renderContent = (
    <Scrollbar
      sx={{
        height: 1,
        backgroundColor: '#fff',
        '& .simplebar-content': {
          height: 1,
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <Stack
        spacing={3}
        sx={{
          px: 2.5,
          pt: 3,
          pb: 2,
          ...(isCollapse && {
            alignItems: 'center'
          })
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box component={RouterLink} to={getUrl(PATH_DASHBOARD.details.home)} sx={{ display: 'inline-flex' }}>
            <img src={mainlogo} alt="Logo" />
          </Box>
        </Stack>

        {isCollapse ? (
          <MyAvatar sx={{ mx: 'auto', mb: 2 }} src={currentProject?.avatarUrl || 'All Projects'} />
        ) : (
          <AccountStyle>
            <MyAvatar src={currentProject?.avatarUrl || 'All Projects'} />
            <Box sx={{ ml: 2 }}>
              <Typography variant="subtitle2" sx={{ color: 'text?.primary' }}>
                {getTitle()}
              </Typography>
            </Box>
          </AccountStyle>
        )}
      </Stack>

      {currentUser && navConfig && <NavSection navConfig={navConfig} isShow={!isCollapse} />}

      <Box sx={{ flexGrow: 1 }} />
    </Scrollbar>
  );

  return (
    <RootStyle
      sx={{
        width: {
          lg: isCollapse ? COLLAPSE_WIDTH : DRAWER_WIDTH
        },
        ...(collapseClick && {
          position: 'absolute'
        })
      }}
    >
      <MHidden width="lgUp">
        <Drawer
          open={isOpenSidebar}
          onClose={onCloseSidebar}
          PaperProps={{
            sx: { width: DRAWER_WIDTH }
          }}
        >
          {renderContent}
        </Drawer>
      </MHidden>

      <MHidden width="lgDown">
        <Drawer
          open
          variant="persistent"
          onMouseEnter={onHoverEnter}
          onMouseLeave={onHoverLeave}
          PaperProps={{
            sx: {
              width: DRAWER_WIDTH,
              bgcolor: 'background.default',
              ...(isCollapse && {
                width: COLLAPSE_WIDTH
              }),
              ...(collapseHover && {
                borderRight: 0,
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)', // Fix on Mobile
                boxShadow: (theme) => theme.customShadows.z20,
                bgcolor: (theme) => alpha(theme.palette.background.default, 0.88)
              })
            }
          }}
        >
          {renderContent}
        </Drawer>
      </MHidden>
    </RootStyle>
  );
}
