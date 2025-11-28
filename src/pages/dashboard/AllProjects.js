import { filter } from 'lodash';
import { Icon } from '@iconify/react';
import { sentenceCase } from 'change-case';
import { useState, useEffect, useCallback } from 'react';
import plusFill from '@iconify/icons-eva/plus-fill';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
// material
import { useTheme } from '@mui/material/styles';
import {
  Card,
  Table,
  Avatar,
  AvatarGroup,
  Button,
  TableRow,
  TableBody,
  TableCell,
  Container,
  Typography,
  TableContainer,
  TablePagination,
  Tooltip
} from '@mui/material';
// redux
import {
  setCurrentProject,
  setFetchProjectData,
  getEditProject,
  setProjectList,
  setFilteredProjectList,
  setTestCaseSteps,
  setTotalCount,
  setCompanyStatusProjectList
} from '../../redux/slices/project';
import { setFetchModuleData } from '../../redux/slices/module';
import { getCompanyStatusProjectList, getFilteredProjectList, getTestCaseSteps } from '../../_apis_/project';
import { setRoleConfig, setPageConfig } from '../../redux/slices/role';
import { useDispatch, useSelector } from '../../redux/store';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import Label from '../../components/Label';
import Scrollbar from '../../components/Scrollbar';
import SearchNotFound from '../../components/SearchNotFound';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import { ProjectListHead, ProjectListToolbar, ProjectMoreMenu } from '../../components/_dashboard/project/list';
import STATUS from '../../components/_dashboard/project/ProjectStatus';
import LoadingScreen from '../../components/LoadingScreen';
import { getIDBCurrentProject, getIndexedDBObject } from '../../main';
import { IndexedDB, INDEXEDDB_KEYS } from '../../Constants';
import SpinnerOverlay from '../../components/SpinnerOverlay';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  // { id: 'name', label: 'Name', alignRight: false },
  // { id: 'team', label: 'Team', alignRight: false },
  // { id: 'status', label: 'Status', alignRight: false },
  // { id: 'modulesCount', label: 'Modules # ', alignRight: false },
  // { id: 'updatedAt', label: 'Last Activity', alignRight: false },
  // { id: '' }
  { id: 'name', label: 'Name', align: 'left' },
  { id: 'team', label: 'Team', align: 'left' },
  { id: 'status', label: 'Status', align: 'left' },
  { id: 'modulesCount', label: 'Modules # ', align: 'right' },
  { id: 'updatedAt', label: 'Last Activity', align: 'right' },
  { id: '' }
];

// ----------------------------------------------------------------------

function descendingComparator(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

function getComparator(order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function applySortFilter(array, comparator, query) {
  const stabilizedThis = array?.map((el, index) => [el, index]);
  stabilizedThis?.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  if (query) {
    return filter(array, (_user) => _user.name.toLowerCase().indexOf(query.toLowerCase()) !== -1);
  }
  return stabilizedThis?.map((el) => el[0]);
}

export default function AllProjects() {
  const navigate = useNavigate();
  const { themeStretch } = useSettings();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentUser, appendUrl } = useSelector((state) => state.user);
  const { totalProjects, projectList, filterProjects, fetchProjectData, totalCount } = useSelector(
    (state) => state.project
  );
  const { roleConfig, pageConfig } = useSelector((state) => state.role);
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState('desc');
  const [selected, setSelected] = useState([]);
  const [orderBy, setOrderBy] = useState('createdAt');
  const [filterName, setFilterName] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsloading] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [fetchRoleConfig, setFetchRoleConfig] = useState(true);
  const [isSpinnerLoading, setIsSpinnerLoading] = useState(false);
  const { licenseExpired } = useSelector((state) => state.license);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const navigateToLink = (url) => {
    navigate(getUrl(url));
  };

  const filterUnArchivedProjects = useCallback(async () => {
    if (fetchProjectData) {
      setFetchProjectData(dispatch, false);

      if (showLoadingScreen) {
        setIsloading(true);
      } else {
        setIsSpinnerLoading(true);
      }
      const data = await getFilteredProjectList(
        STATUS.UNARCHIVED,
        currentUser?.company?._id,
        orderBy,
        order,
        rowsPerPage,
        page
      );
      const projects = data?.data;
      const totalCount = data?.totalCount;

      // Fetching All Active status projects in a company and
      // setting the values in the below variable
      // const allActiveCompanyProjects = await getCompanyStatusProjectList(
      //   currentUser?.company?._id,
      //   STATUS.ACTIVE,
      //   rowsPerPage
      // );
      setProjectList(dispatch, projects);
      setTotalCount(dispatch, totalCount);
      setFilteredProjectList(dispatch, projects);

      const currentProject = await getIDBCurrentProject();
      const project = projects?.find((project) => project._id === currentProject?._id);
      const allProject = projectList?.find((project) => project._id === currentProject?._id);
      if (!project && !allProject) {
        setCurrentProject(dispatch, null);
        // setRoleConfig(dispatch, null);
        // setFetchRoledata(dispatch, true);
      }
      if (showLoadingScreen) {
        setIsloading(false);
      } else {
        setIsSpinnerLoading(false);
      }
    }
  }, [dispatch, currentUser, fetchProjectData, projectList]);

  const handleProjectClick = async (projectId) => {
    // setFetchRoledata(dispatch, true);
    const project = filterProjects?.filter((project) => project._id === projectId)[0];
    setCurrentProject(dispatch, project);
    // setRoleConfig(dispatch, null);

    const testCaseSteps = await getTestCaseSteps(currentUser?.company?._id, project?._id);
    setTestCaseSteps(dispatch, testCaseSteps);
    const moduleCount =
      roleConfig?.projectModules && Object.values(roleConfig?.projectModules).reduce((a, item) => a + item, 0);
    const releasesCount = roleConfig?.releases && Object.values(roleConfig?.releases).reduce((a, item) => a + item, 0);
    const testRunsCount = roleConfig?.testRuns && Object.values(roleConfig?.testRuns).reduce((a, item) => a + item, 0);
    if (moduleCount !== 0) {
      setFetchModuleData(dispatch, true);
      navigateToLink(PATH_DASHBOARD.module.allModules);
    } else if (releasesCount !== 0) navigateToLink(PATH_DASHBOARD.release.allReleases);
    else if (testRunsCount !== 0) navigateToLink(PATH_DASHBOARD.testRuns.allTestRuns);
  };

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
    saveDataChanges();
    filterUnArchivedProjects();
    setShowLoadingScreen(false);
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = filterProjects.map((n) => n.name);
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    saveDataChanges();
    filterUnArchivedProjects();
    setShowLoadingScreen(false);
  };

  const saveDataChanges = (event) => {
    // setProjectList(dispatch, null);
    // setFilteredProjectList(dispatch, null);
    setFetchProjectData(dispatch, true);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
    saveDataChanges();
    filterUnArchivedProjects();
    setShowLoadingScreen(false);
  };

  const handleFilterByName = (event) => {
    setFilterName(event.target.value);
    setPage(0);
  };

  const handleDeleteProject = (projectId) => {
    const ids = [];
    const moduleIds = [];
    const project = filterProjects?.filter((project) => project._id === projectId)[0];
    project?.team?.map((data) => {
      ids.push(data._id);
      return null;
    });
    project?.modules?.map((data) => {
      moduleIds.push(data._id);
      return null;
    });
    const formData = {
      name: project.name,
      description: project.description,
      status: STATUS.ARCHIVED,
      company: project.company,
      team: ids,
      modules: moduleIds,
      createdBy: project.createdBy
    };
    getEditProject(dispatch, formData, projectId);
    setFetchProjectData(dispatch, true);
    filterUnArchivedProjects();
    setShowLoadingScreen(true);
    setCurrentProject(dispatch, null);
    // setRoleConfig(dispatch, null);
  };

  const filteredProjects = applySortFilter(projectList, getComparator(order, orderBy), filterName);

  const isUserNotFound = filteredProjects?.length === 0;

  const activeProjects = filteredProjects?.filter((project) => project.status !== STATUS.ARCHIVED);
  const emptyRows = page > 0 ? Math.max(0, rowsPerPage - activeProjects?.length) : 0;
  useEffect(() => {
    setProjectList(dispatch, activeProjects);
    setFilteredProjectList(dispatch, activeProjects);
    setFetchProjectData(dispatch, true);
  }, [dispatch]);

  useEffect(() => {
    const fetchRoleConfigData = async () => {
      if (fetchRoleConfig) {
        const roleConfig = await getIndexedDBObject(IndexedDB.ROLE, INDEXEDDB_KEYS.ROLE_CONFIG);
        setRoleConfig(dispatch, roleConfig);
        setFetchRoleConfig(false);
      }
    };
    fetchRoleConfigData();
  }, [dispatch, fetchRoleConfig]);

  useEffect(() => {
    if (roleConfig && Object.keys(roleConfig)?.length !== 0) setPageConfig(dispatch, roleConfig?.projects);
  }, [dispatch, roleConfig]);

  useEffect(() => {
    filterUnArchivedProjects();
    setShowLoadingScreen(true);
  }, [filterUnArchivedProjects]);

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading="All Projects"
          links={[{ name: 'Projects', href: getUrl(PATH_DASHBOARD.project.allProjects) }, { name: 'All Projects' }]}
          info="A project is a collection of related modules and test cases."
          action={
            pageConfig?.create &&
            !licenseExpired && (
              <Button
                variant="contained"
                component={RouterLink}
                to={getUrl(`${PATH_DASHBOARD.project.newProject}`)}
                startIcon={<Icon icon={plusFill} />}
              >
                New Project
              </Button>
            )
          }
        />

        {isLoading && <LoadingScreen />}
        {!isLoading && (
          <Card>
            <ProjectListToolbar
              numSelected={selected.length}
              filterName={filterName}
              onFilterName={handleFilterByName}
            />
            <SpinnerOverlay loading={isSpinnerLoading} />
            <Scrollbar>
              <TableContainer sx={{ minWidth: 800 }}>
                <Table>
                  <ProjectListHead
                    order={order}
                    orderBy={orderBy}
                    headLabel={TABLE_HEAD}
                    rowCount={activeProjects?.length}
                    numSelected={selected.length}
                    onRequestSort={handleRequestSort}
                    onSelectAllClick={handleSelectAllClick}
                  />
                  <TableBody>
                    {/* <SpinnerOverlay loading={isSpinnerLoading} /> */}
                    {activeProjects?.map((row) => {
                      const { _id, name, team, status, modulesCount, updatedAt } = row;
                      const isItemSelected = selected.indexOf(name) !== -1;
                      return (
                        <TableRow
                          hover
                          key={_id}
                          tabIndex={-1}
                          role="checkbox"
                          selected={isItemSelected}
                          aria-checked={isItemSelected}
                        >
                          <TableCell component="th" scope="row" align="left" padding="none" sx={{ width: '30%' }}>
                            <Typography
                              variant="subtitle2"
                              noWrap
                              color="#0045ff"
                              style={{ textDecoration: 'none', cursor: 'pointer' }}
                              onClick={() => handleProjectClick(_id)}
                            >
                              {name}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ width: '20%' }}>
                            <AvatarGroup
                              max={4}
                              sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}
                              style={{ flexDirection: 'row' }}
                            >
                              {team?.map((person) => (
                                <Tooltip
                                  title={`${person?.firstName} ${person?.lastName}`}
                                  key={`${person?.firstName} ${person?.lastName}`}
                                >
                                  <Avatar
                                    key={person?.firstName}
                                    alt={person?.firstName}
                                    src={person?.avatarUrl || person?.firstName}
                                  />
                                </Tooltip>
                              ))}
                            </AvatarGroup>
                          </TableCell>
                          <TableCell align="left" sx={{ width: '10%' }}>
                            <Label
                              variant={theme.palette.mode === 'light' ? 'ghost' : 'filled'}
                              color={(status === STATUS.CLOSED && 'error') || 'success'}
                            >
                              {sentenceCase(status)}
                            </Label>
                          </TableCell>
                          <TableCell align="right" sx={{ width: '10%' }}>
                            <b>{modulesCount}</b>
                          </TableCell>
                          <TableCell align="right" sx={{ width: '25%' }}>
                            {format(new Date(updatedAt), 'MMM dd yyyy, hh:mm a')}
                          </TableCell>

                          {(pageConfig?.edit || pageConfig?.delete) && !licenseExpired && (
                            <TableCell align="right" sx={{ width: '5%' }}>
                              <ProjectMoreMenu
                                pageConfig={pageConfig}
                                onDelete={() => handleDeleteProject(_id)}
                                projectId={_id}
                              />
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                    {emptyRows > 0 && (
                      <TableRow style={{ height: 53 * emptyRows }}>
                        <TableCell colSpan={6} />
                      </TableRow>
                    )}
                  </TableBody>
                  {isUserNotFound && (
                    <TableBody>
                      <TableRow>
                        <TableCell align="center" colSpan={6} sx={{ py: 3 }}>
                          <SearchNotFound searchQuery={filterName} />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  )}
                </Table>
              </TableContainer>
            </Scrollbar>

            <TablePagination
              rowsPerPageOptions={[10, 15, 25, 30]}
              component="div"
              count={totalCount || 0}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Card>
        )}
      </Container>
    </Page>
  );
}
