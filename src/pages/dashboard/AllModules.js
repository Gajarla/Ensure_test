import { filter } from 'lodash';
import { Icon } from '@iconify/react';
import { useSnackbar } from 'notistack';
import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
// material
import {
  Box,
  Card,
  Table,
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
import plusFill from '@iconify/icons-eva/plus-fill';
import downloadFill from '@iconify/icons-eva/download-fill';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
// import axios from 'axios';
import axios from '../../utils/axiosInstance';
import {
  getDeleteModule,
  getModuleListSuccess,
  setFetchModuleData,
  setModuleList,
  setFilteredModuleList,
  setTotalCount
} from '../../redux/slices/module';
import { getExportModule } from '../../_apis_/module';
import { setRoleConfig, setPageConfig, setTestCasesConfig } from '../../redux/slices/role';
// import { getTestRunList } from '../../redux/slices/testRun';
import { useDispatch, useSelector } from '../../redux/store';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import Scrollbar from '../../components/Scrollbar';
import SearchNotFound from '../../components/SearchNotFound';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import { ModuleListHead, ModuleListToolbar, ModuleMoreMenu } from '../../components/_dashboard/module/list';
import LoadingScreen from '../../components/LoadingScreen';
import API from '../../services';
import { setSessionObj, getSessionObj } from '../../utils/jwt';
import { STATUS, IndexedDB, INDEXEDDB_KEYS } from '../../Constants';
import { getIDBCurrentProject, setIndexedDBObject, getIndexedDBObject } from '../../main';
import { allModulesClearData, exportToExcel } from '../../redux/slices/common';
import SpinnerOverlay from '../../components/SpinnerOverlay';
// ----------------------------------------------------------------------

const TABLE_HEAD = [
  // { id: 'suiteName', label: 'Name', alignRight: false },
  // { id: 'businessProcess', label: 'Business Process', alignRight: false },
  // { id: 'testCaseCount', label: 'Test Cases #', alignRight: false },
  // { id: 'testStepCount', label: 'Test Step #', alignRight: false },
  // { id: 'updatedAt', label: 'Last Activity', alignRight: false },
  // { id: 'action', label: '', alignRight: false }
  { id: 'suiteName', label: 'Name', align: 'left' },
  { id: 'businessProcess', label: 'Business Process', align: 'left' },
  { id: 'testCaseCount', label: 'Test Cases #', align: 'right' },
  { id: 'testStepCount', label: 'Test Steps #', align: 'right' },
  { id: 'updatedAt', label: 'Last Activity', align: 'right' },
  { id: 'action', label: '', align: 'center' }
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
    return filter(array, (_user) => _user.suiteName.toLowerCase().indexOf(query.toLowerCase()) !== -1);
  }
  return stabilizedThis?.map((el) => el[0]);
}

export default function ModuleList() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { appendUrl } = useSelector((state) => state.user);
  const { moduleList, filteredModuleList, fetchModuleData, totalcount } = useSelector((state) => state.module);
  const { roleConfig, pageConfig } = useSelector((state) => state.role);
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState('desc');
  const [selected, setSelected] = useState([]);
  const [orderBy, setOrderBy] = useState('createdAt');
  const [filterName, setFilterName] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsloading] = useState(false);
  const [currentProject, setCurrentProject] = useState();
  const [fetchRoleConfig, setFetchRoleConfig] = useState(true);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
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

  const getModuleList = useCallback(async () => {
    try {
      if (fetchModuleData) {
        setFetchModuleData(dispatch, false);
        if (showLoadingScreen) {
          setIsloading(true);
        } else {
          setIsSpinnerLoading(true);
        }
        const projectSerialized = await getIDBCurrentProject();
        if (projectSerialized && projectSerialized._id) {
          const url = API.projects.getModuleListByProjectId(projectSerialized._id, orderBy, order, rowsPerPage, page);
          const response = await axios({
            method: 'get',
            url: API.projects.getModuleListByProjectId(
              projectSerialized._id,
              orderBy,
              order,
              rowsPerPage,
              page,
              false,
              false
            ),
            headers: {
              Authorization: `Bearer ${getSessionObj('accessToken')}`
            }
          });
          const { data } = response;
          const modules = data?.response;
          const totalcount = data?.totalCount;
          modules.sort((a, b) => {
            let value = 0;
            if (a.createdAt.localeCompare(b.createdAt)) value = -1;
            else value = 1;
            return value;
          });
          setModuleList(dispatch, modules);
          // setFilteredModuleList(dispatch, modules);
          setTotalCount(dispatch, totalcount);
          dispatch(getModuleListSuccess(modules));
        }
        if (showLoadingScreen) {
          setIsloading(false);
        } else {
          setIsSpinnerLoading(false);
        }
      }
    } catch (error) {
      if (showLoadingScreen) {
        setIsloading(false);
      }
    }
  }, [dispatch, moduleList, filteredModuleList, fetchModuleData]);

  const getModulesList = useCallback(async () => {
    try {
      const projectSerialized = await getIDBCurrentProject();
      if (projectSerialized && projectSerialized._id) {
        const response = await axios({
          method: 'get',
          url: API.projects.getModuleByProjectId(projectSerialized._id),
          headers: {
            Authorization: `Bearer ${getSessionObj('accessToken')}`
          }
        });
        const { data } = response;
        const modules = data?.response;
        const totalcount = data?.totalCount;
        modules.sort((a, b) => {
          let value = 0;
          if (a.createdAt.localeCompare(b.createdAt)) value = -1;
          else value = 1;
          return value;
        });
        // setModuleList(dispatch, modules);
        setFilteredModuleList(dispatch, modules);
        dispatch(getModuleListSuccess(modules));
      }
    } catch (error) {
      console.log('error', error);
    }
  }, [dispatch, filteredModuleList]);

  useEffect(() => {
    if (roleConfig && Object.keys(roleConfig)?.length !== 0) {
      setPageConfig(dispatch, roleConfig?.projectModules);
      setTestCasesConfig(dispatch, null);
    }
  }, [dispatch, roleConfig]);

  const getCurrentProject = useCallback(async () => {
    setCurrentProject(await getIDBCurrentProject());
  }, []);

  useEffect(() => {
    const fetchRoleConfigData = async () => {
      if (fetchRoleConfig) {
        allModulesClearData(dispatch);
        const roleConfig = await getIndexedDBObject(IndexedDB.ROLE, INDEXEDDB_KEYS.ROLE_CONFIG);
        setRoleConfig(dispatch, roleConfig);
        setFetchRoleConfig(false);
      }
    };
    fetchRoleConfigData();
  }, [dispatch, fetchRoleConfig]);

  useEffect(() => {
    getCurrentProject();
    getModuleList();
    // setShowLoadingScreen(true);
    // getTestRunList(dispatch);
  }, [dispatch, getModuleList]);

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
    saveDataChanges();
    getModuleList();
    setShowLoadingScreen(false);
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = moduleList?.map((n) => n.name);
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    // saveDataChanges();
    // getModuleList();
    setShowLoadingScreen(false);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
    // saveDataChanges();
    // getModuleList();
    setShowLoadingScreen(false);
  };

  const handleFilterByName = (event) => {
    setFilterName(event.target.value);
    setPage(0);
    getModulesList();
    const module = filteredModuleList?.filter((modules) => modules.suiteName.includes(filterName));
  };

  const saveDataChanges = (event) => {
    setFilteredModuleList(dispatch, null);
    setFetchModuleData(dispatch, true);
    setIsloading(false);
  };

  const handleDeleteModule = async (moduleId) => {
    const { response } = await getDeleteModule(dispatch, moduleId);
    if (response?.status === 200) enqueueSnackbar(response?.message, { variant: 'success' });
    if (response?.status === 201) enqueueSnackbar(response?.message, { variant: 'error' });
  };

  const handleSuiteNameClick = (module) => {
    const url = `${PATH_DASHBOARD.testCase.testCasesByModule}/module/${module._id}`;
    setIndexedDBObject(IndexedDB.MODULE, INDEXEDDB_KEYS.CURRENT_MODULE, { _id: module._id });
    setIndexedDBObject(IndexedDB.RELEASE, INDEXEDDB_KEYS.CURRENT_RELEASE, null);
    setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_TESTRUN, null);
    setSessionObj(INDEXEDDB_KEYS.CURRENT_MODULE, JSON.stringify({ _id: module._id }));
    setSessionObj(INDEXEDDB_KEYS.CURRENT_RELEASE, null);
    setSessionObj(INDEXEDDB_KEYS.CURRENT_TESTRUN, null);
    dispatch(getModuleListSuccess(null));
    setFetchModuleData(dispatch, true);
    navigateToLink(url);
  };

  const exportModule = async () => {
    let data = {};
    data.ProjectId = currentProject._id;
    data = await getExportModule(data);
    // downloadExcel(data, `${currentProject.name}_Test_Cases.xlsx`);
    exportToExcel(data, true, `${currentProject.name}_Test_Cases.xlsx`, false);
  };

  // const testCasesCount = (moduleId) => {
  //   let testCasesCount = 0;
  //   if (moduleId === undefined) {
  //     moduleList?.map((module) => {
  //       testCasesCount += module?.testNodes?.length;
  //       return testCasesCount;
  //     });
  //   } else if (moduleId) {
  //     const [module] = moduleList?.filter((module) => module._id === moduleId);
  //     testCasesCount = module?.testNodes?.length;
  //   }
  //   return testCasesCount;
  // };

  // const testCaseStepsCount = (moduleId) => {
  //   let testStepsCount = 0;
  //   if (moduleId === undefined) {
  //     moduleList?.map((module) => {
  //       module?.testNodes?.map((testCase) => {
  //         testStepsCount += testCase?.testNode[0]?.testCaseSteps?.length;
  //         return testStepsCount;
  //       });
  //       return testStepsCount;
  //     });
  //   } else if (moduleId) {
  //     const [module] = moduleList?.filter((module) => module._id === moduleId);
  //     module?.testNodes?.map((testCase) => {
  //       testStepsCount += testCase?.testNode[0]?.testCaseSteps?.length;
  //       return testStepsCount;
  //     });
  //   }
  //   return testStepsCount;
  // };

  const filteredModules = applySortFilter(moduleList, getComparator(order, orderBy), filterName);
  // const emptyRows = page > 0 ? Math.max(0, rowsPerPage - filteredModules.length) : 0;
  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - filteredModules?.length) : 0;
  const isUserNotFound = filteredModules?.length === 0;

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading="All Modules"
          links={[
            { name: currentProject?.name, href: getUrl(PATH_DASHBOARD.module.allModules) },
            { name: 'All Modules' }
          ]}
          info="A Module is a collection of related test cases and test case steps."
          action={
            !licenseExpired && (
              <>
                {pageConfig && pageConfig?.create && !STATUS.includes(currentProject?.status) && (
                  <Button
                    variant="contained"
                    component={RouterLink}
                    to={getUrl(PATH_DASHBOARD.module.newModule)}
                    startIcon={<Icon icon={plusFill} />}
                  >
                    New Module
                  </Button>
                )}
                {'  '}
                <Button
                  variant="contained"
                  // component={RouterLink}
                  // to={PATH_DASHBOARD.module.newModule}
                  onClick={exportModule}
                  disabled={moduleList && moduleList.length === 0}
                  startIcon={<Icon icon={downloadFill} />}
                >
                  Download
                </Button>
              </>
            )
          }
        />
        {isLoading && <LoadingScreen />}
        {!isLoading && (
          <Card>
            <ModuleListToolbar
              numSelected={selected.length}
              filterName={filterName}
              onFilterName={handleFilterByName}
            />
            <SpinnerOverlay loading={isSpinnerLoading} />
            <Scrollbar>
              <TableContainer sx={{ minWidth: 800 }}>
                <Table>
                  <ModuleListHead
                    order={order}
                    orderBy={orderBy}
                    headLabel={TABLE_HEAD}
                    rowCount={filteredModules?.length}
                    numSelected={selected.length}
                    onRequestSort={handleRequestSort}
                    onSelectAllClick={handleSelectAllClick}
                  />
                  <TableBody>
                    {/* <SpinnerOverlay loading={isSpinnerLoading} /> */}
                    {filteredModules?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => {
                      // {filteredModules?.map((row) => {
                      const { _id, suiteName, businessProcess, testCaseCount, testStepCount, updatedAt } = row;
                      const isItemSelected = selected.indexOf(suiteName) !== -1;

                      return (
                        <TableRow
                          hover
                          key={_id}
                          tabIndex={-1}
                          role="checkbox"
                          selected={isItemSelected}
                          aria-checked={isItemSelected}
                        >
                          <TableCell
                            component="th"
                            scope="row"
                            padding="none"
                            align="left"
                            sx={{
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {/* <Typography
                              variant="subtitle2"
                              noWrap
                              color="#0045ff"
                              onClick={() => {
                                handleSuiteNameClick(row);
                              }}
                              style={{ textDecoration: 'none', cursor: 'pointer' }}
                            >
                              {suiteName}
                            </Typography> */}
                            <Tooltip title={suiteName}>
                              <Typography
                                variant="subtitle2"
                                color="#0045ff"
                                style={{ textDecoration: 'none', cursor: 'pointer' }}
                                onClick={() => {
                                  handleSuiteNameClick(row);
                                }}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'left',
                                  justifyContent: 'left',
                                  gap: 1,
                                  minWidth: 0
                                }}
                              >
                                <Box
                                  component="span"
                                  sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'inline-block'
                                    // maxWidth: '60%' // adjust so icon fits
                                  }}
                                >
                                  {suiteName}
                                </Box>
                              </Typography>{' '}
                            </Tooltip>
                          </TableCell>
                          <TableCell align="left">
                            <Tooltip title={businessProcess}>
                              <Typography sx={{ display: 'flex', alignItems: 'left', gap: 1, minWidth: 0 }}>
                                <Box
                                  component="span"
                                  sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'inline-block',
                                    maxWidth: '150px' // adjust so icon fits
                                  }}
                                >
                                  {businessProcess}
                                </Box>
                              </Typography>{' '}
                            </Tooltip>
                          </TableCell>
                          <TableCell align="right">{testCaseCount}</TableCell>
                          <TableCell align="right">{testStepCount}</TableCell>
                          <TableCell align="right">{format(new Date(updatedAt), 'MMM dd yyyy, hh:mm a')}</TableCell>
                          {(pageConfig?.edit || pageConfig?.delete) &&
                            !STATUS.includes(currentProject?.status) &&
                            !licenseExpired && (
                              <TableCell align="right">
                                <ModuleMoreMenu
                                  pageConfig={pageConfig}
                                  onDelete={() => handleDeleteModule(_id)}
                                  moduleId={_id}
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
              count={totalcount || 0}
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
