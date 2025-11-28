import { filter, set } from 'lodash';
import { Icon } from '@iconify/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import plusFill from '@iconify/icons-eva/plus-fill';
import briefcaseOutline from '@iconify/icons-eva/briefcase-outline';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
// import axios from 'axios';

// import ReactApexChart from 'react-apexcharts';
// material
import {
  Box,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Table,
  Button,
  TableRow,
  TableBody,
  TableCell,
  Container,
  Stack,
  Typography,
  Tooltip,
  TableContainer,
  TablePagination,
  LinearProgress
} from '@mui/material';
import axios from '../../utils/axiosInstance';
// import { useTheme } from '@mui/material/styles';
import { getExecutingReleasesData } from '../../_apis_/release';

// redux
import {
  setCurrentRelease,
  getDeleteRelease,
  getReleaseListSuccess,
  setReleaseData,
  setFetchReleaseData,
  setTotalCount,
  setReleaseList,
  getReleaseTestRuns
} from '../../redux/slices/release';
import {
  getTestRunListSuccess,
  setCurrentTestRun,
  setFetchTestRunData,
  setTestRunsList
} from '../../redux/slices/testRun';
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
import { ReleaseListHead, ReleaseListToolbar, ReleaseMoreMenu } from '../../components/_dashboard/release/list';
import { setRoleConfig, setPageConfig } from '../../redux/slices/role';
// import STATUS from '../../components/_dashboard/project/ProjectStatus';
// import { fNumber } from '../../utils/formatNumber';
import LoadingScreen from '../../components/LoadingScreen';
import API from '../../services';
import { getSessionObj } from '../../utils/jwt';
import { STATUS, IndexedDB, INDEXEDDB_KEYS, STATUS_COLORS } from '../../Constants';
import { getIDBCurrentUser, getIDBCurrentProject, getIndexedDBObject } from '../../main';
import { allReleasesClearData } from '../../redux/slices/common';
import SpinnerOverlay from '../../components/SpinnerOverlay';
import { release } from 'process';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  // { id: 'releaseName', label: 'Release Name', alignRight: false },
  // {
  //   id: 'status',
  //   label: (
  //     <Box style={{ maxWidth: '200px' }}>
  //       <Typography variant="body2" fontWeight="bold">
  //         Status
  //       </Typography>
  //       <Typography variant="caption" color="text.secondary">
  //         (Total / Passed / Skipped / Failed / Ignored / Warning / Untested)
  //       </Typography>
  //     </Box>
  //   ),
  //   alignRight: false
  // },
  // { id: 'passRate', label: 'Pass %', alignRight: false },
  // { id: 'executionDuration', label: 'Execution time', alignRight: false },
  // { id: 'schedule', label: 'Schedule', alignRight: false },
  // // { id: 'trend', label: ' Trend (Last 10 Runs)', alignRight: false },
  // { id: '' },

  { id: 'releaseName', label: 'Release Name', align: 'left' },
  {
    id: 'status',
    label: (
      <Box style={{ maxWidth: '200px' }}>
        <Typography variant="body2" fontWeight="bold">
          Status
        </Typography>
        <Typography variant="caption" color="text.secondary">
          (Total / Passed / Skipped / Failed / Ignored / Warning / Untested)
        </Typography>
      </Box>
    ),
    align: 'center'
  },
  { id: 'passRate', label: 'Pass %', align: 'center' },
  { id: 'executionDuration', label: 'Execution time', align: 'center' },
  { id: 'schedule', label: 'Schedule', align: 'left' },
  // { id: 'trend', label: ' Trend (Last 10 Runs)', align: 'center' },
  { id: '' }
];
// const CHART_DATA = [{ data: [20, 41, 63, 33, 28, 35, 50, 46, 11, 26] }];

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
    return filter(array, (_user) => _user.releaseName.toLowerCase().indexOf(query.toLowerCase()) !== -1);
  }
  return stabilizedThis?.map((el) => el[0]);
}

export default function ReleasesList() {
  const navigate = useNavigate();
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { appendUrl } = useSelector((state) => state.user);
  const { currentProject } = useSelector((state) => state.project);
  const { releaseList, totalCount } = useSelector((state) => state.release);
  const { roleConfig, pageConfig } = useSelector((state) => state.role);
  const { testRunList, fetchTestRunsData } = useSelector((state) => state.testRun);
  const { licenseExpired } = useSelector((state) => state.license);
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState('desc');
  const [selected, setSelected] = useState([]);
  const [orderBy, setOrderBy] = useState('createdAt');
  const [filterName, setFilterName] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  // const theme = useTheme();
  const [isLoading, setIsloading] = useState(false);
  const [fetchRoleConfig, setFetchRoleConfig] = useState(true);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [isSpinnerLoading, setIsSpinnerLoading] = useState(false);
  const [openMessage, setOpenMessage] = useState(false);
  const searchedWithApi = useRef(false);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const navigateToLink = (url) => {
    navigate(getUrl(url));
  };

  const handleClose = () => {
    setOpenMessage(false);
    navigateToLink(PATH_DASHBOARD.module.allModules);
  };

  // const TrendChartOptions = {
  //   colors: [theme.palette?.primary.light],
  //   chart: { sparkline: { enabled: true } },
  //   plotOptions: { bar: { columnWidth: '68%', borderRadius: 2 } },
  //   labels: ['1', '2', '3', '4', '5', '6', '7', '8'],
  //   tooltip: {
  //     x: { show: false },
  //     y: {
  //       formatter: (seriesName) => fNumber(seriesName),
  //       title: {
  //         formatter: () => ''
  //       }
  //     },
  //     marker: { show: false }
  //   }
  // };

  const getReleaseList = useCallback(
    async (orderBy, order, rowsPerPage, page, showLoadingScreen, searchTerm) => {
      if (showLoadingScreen) {
        setIsloading(true);
      } else {
        setIsSpinnerLoading(true);
      }
      try {
        const projectSerialized = await getIDBCurrentProject();
        if (projectSerialized && projectSerialized._id) {
          const data = await axios({
            method: 'get',
            url: API.releases.getReleaseByPID(projectSerialized._id, orderBy, order, rowsPerPage, page, searchTerm),
            headers: {
              Authorization: `Bearer ${getSessionObj('accessToken')}`
            }
          });
          const releases = data?.data?.response;
          if (data?.data?.status == 204) setOpenMessage(true);
          const totalCount = data?.data?.totalCount;
          setTotalCount(dispatch, totalCount);

          if (releases instanceof Array) {
            dispatch(getReleaseListSuccess(releases));
          } else {
            dispatch(getReleaseListSuccess([]));
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
        // dispatch(slice.actions.hasError(error));
      }
      setReleaseData(dispatch, null);
      // setIsloading(false);
    },
    [dispatch]
  );

  // useCallback hook
  // Prevents unnecessary re-creation of functions which are written inside useEffect hook

  const getExecutingReleases = useCallback(
    async (releaseIds) => {
      let resultList = [];
      try {
        resultList = await getExecutingReleasesData(releaseIds);
        resultList = resultList?.data;
        if (resultList !== undefined && resultList.length > 0) {
          const updatedReleaseList = releaseList.map((release) => {
            const matchingResult = resultList.find((result) => result._id === release._id);
            if (matchingResult) {
              const obj = {
                ...release,
                total: matchingResult.total,
                untested: matchingResult.untested,
                passed: matchingResult.passed,
                skipped: matchingResult.skipped,
                failed: matchingResult.failed,
                percentage: matchingResult.percentage,
                executionDuration: matchingResult.executionDuration,
                jobRunningStatus: matchingResult.runningStatus
              };
              return obj;
            }
            return release;
          });
          dispatch(getReleaseListSuccess(updatedReleaseList));
          // setReleaseData(dispatch, updatedReleaseList);
        }
      } catch (error) {
        console.log(error);
      }
    },
    [dispatch, releaseList]
  );

  useEffect(() => {
    if (roleConfig && Object.keys(roleConfig)?.length !== 0) setPageConfig(dispatch, roleConfig?.releases);
  }, [dispatch, roleConfig]);

  useEffect(() => {
    setShowLoadingScreen(true);
    getReleaseList(orderBy, order, rowsPerPage, page, true, '');
  }, [dispatch, getReleaseList]);

  // useEffect(() => {
  //   if (fetchRoleConfig) {
  //     allReleasesClearData(dispatch);
  //     setCurrentTestRun(dispatch, null);
  //     setRoleConfig(dispatch, null);
  //     setFetchRoleConfig(false);
  //   }
  // }, [dispatch, fetchRoleConfig]);

  useEffect(() => {
    const fetchRoleConfigData = async () => {
      if (fetchRoleConfig) {
        allReleasesClearData(dispatch);
        setCurrentTestRun(dispatch, null);
        const roleConfig = await getIndexedDBObject(IndexedDB.ROLE, INDEXEDDB_KEYS.ROLE_CONFIG);
        setRoleConfig(dispatch, roleConfig);
        setFetchRoleConfig(false);
      }
    };
    fetchRoleConfigData();
  }, [dispatch, fetchRoleConfig]);

  // The below hook is used for refreshing the respective releases
  // of which test runs are getting execeuted in Jira

  useEffect(() => {
    const interval = setInterval(() => {
      const executingReleases = releaseList
        ?.filter(
          (release) =>
            release.jobRunningStatus &&
            !['completed', 'aborted', 'manual'].includes(release.jobRunningStatus?.toLowerCase())
        )
        .map((release) => release._id);
      if (executingReleases?.length !== 0) {
        getExecutingReleases(executingReleases);
      }
    }, process.env.REACT_APP_TESTRUNS_SCREEN_REFRESH_TIME);

    // Cleanup function to clear the interval when component is unmounting
    return () => {
      clearInterval(interval);
    };
  }, [getExecutingReleases, releaseList]);

  const handleReleaseClick = (releaseId) => {
    const release = releaseList?.filter((release) => release._id === releaseId)[0];
    setCurrentRelease(dispatch, release);
    setFetchReleaseData(dispatch, true);
    navigateToLink(`${PATH_DASHBOARD.release.root}/release/${releaseId}/testCases`);
  };

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    const ord = isAsc ? 'desc' : 'asc';
    setOrder(ord);
    setOrderBy(property);
    getReleaseList(property, ord, rowsPerPage, page, false, filterName);
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = releaseList.map((n) => n.name);
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    setReleaseData(dispatch, null);
    getReleaseList(orderBy, order, rowsPerPage, newPage, false, filterName);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    // setPage(0);
    setReleaseData(dispatch, null);
    // Handling edge cases of pagination results
    // 1. If total count of releases is less than rows per page
    // 2. If current page releases count is less than rows per page
    if (totalCount < event.target.value || releaseList?.length < event.target.value) {
      const resetPage = 0;
      setPage(resetPage);
      getReleaseList(orderBy, order, event.target.value, resetPage, false, filterName);
    } else getReleaseList(orderBy, order, event.target.value, page, false, filterName);
  };

  const handleFilterByName = (event) => {
    setFilterName(event.target.value);
    setPage(0);
    setReleaseData(dispatch, null);
    if (event.target.value.length >= 3) {
      getReleaseList(orderBy, order, rowsPerPage, page, false, event.target.value);
      searchedWithApi.current = true;
    }
    if (event.target.value.length == 0 && searchedWithApi.current) {
      const resetPage = 0;
      setPage(resetPage);
      getReleaseList(orderBy, order, rowsPerPage, resetPage, false, '');
      searchedWithApi.current = false;
    }
  };

  const handleRunRelease = (releaseId) => {
    getRunRelease(releaseId);
    // navigateToLink(PATH_DASHBOARD.testRuns.allTestRuns);
    // getReleaseTestRuns(dispatch, releaseId);
  };

  const getReleaseTestRunVersion = async (id) => {
    const data = { releaseId: id };
    const response = await axios({
      method: 'post',
      url: `${API.testRun.getReleaseTestRunVersion}`,
      data,
      headers: {
        Authorization: `Bearer ${getSessionObj('accessToken')}`
      }
    });
    return response?.data?.message?.data?.version;
  };

  const getRunRelease = async (id) => {
    try {
      const currentUser = await getIDBCurrentUser();
      const version = await getReleaseTestRunVersion(id);
      const projectSerialized = await getIDBCurrentProject();
      const data = {
        email: currentUser.email,
        company: currentUser.company,
        version,
        projectID: projectSerialized?._id,
        video: roleConfig?.testRunsTestCases?.video
      };
      setIsSpinnerLoading(true);
      await axios({
        method: 'post',
        url: `${API.testRun.createJob(id)}`,
        data,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      }).then(async (response) => {
        getTestRunList();
        setFetchTestRunData(dispatch, true);
        setIsSpinnerLoading(false);
        navigateToLink(PATH_DASHBOARD.testRuns.allTestRuns);
      });
    } catch (error) {
      setIsSpinnerLoading(false);
      // dispatch(slice.actions.hasError(error));
    }
  };

  const getTestRunList = async () => {
    try {
      const projectSerialized = await getIDBCurrentProject();
      if (projectSerialized && projectSerialized._id) {
        await axios(
          {
            method: 'get',
            url: API.testRun.getAllJobsByPID(projectSerialized._id, 'createdAt', 'desc', '10', '0'),
            headers: {
              Authorization: `Bearer ${getSessionObj('accessToken')}`
            }
          }.then(async (response) => {
            dispatch(getTestRunListSuccess(response.data));
            setFetchTestRunData(dispatch, true);
          })
        );
      }
    } catch (error) {
      // dispatch(slice.actions.hasError(error));
    }
  };

  const handleDeleteRelease = (releaseId) => {
    getDeleteRelease(dispatch, releaseId);
    setReleaseData(dispatch, null);
    // getReleaseList(orderBy, order, rowsPerPage, page, false);
  };

  const filteredReleases = applySortFilter(releaseList, getComparator(order, orderBy), filterName);

  const emptyRows = page > 0 ? Math.max(0, rowsPerPage - filteredReleases.length) : 0;

  const isUserNotFound = filteredReleases?.length === 0;

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading="All Releases"
          links={[{ name: 'Releases', href: getUrl(PATH_DASHBOARD.release.allReleases) }, { name: 'All Releases' }]}
          info="A release is a collection of modules and test cases."
          action={
            pageConfig?.create &&
            !STATUS.includes(currentProject?.status) &&
            !licenseExpired && (
              <Button
                variant="contained"
                component={RouterLink}
                to={getUrl(PATH_DASHBOARD.release.newRelease)}
                startIcon={<Icon icon={plusFill} />}
              >
                New Release
              </Button>
            )
          }
        />
        {isLoading && <LoadingScreen />}
        {!isLoading && (
          <Card>
            <ReleaseListToolbar
              numSelected={selected.length}
              filterName={filterName}
              onFilterName={handleFilterByName}
            />
            <SpinnerOverlay loading={isSpinnerLoading} />
            <Scrollbar>
              <TableContainer sx={{ minWidth: 800 }}>
                <Table>
                  <ReleaseListHead
                    order={order}
                    orderBy={orderBy}
                    headLabel={TABLE_HEAD}
                    rowCount={filteredReleases?.length}
                    numSelected={selected.length}
                    onRequestSort={handleRequestSort}
                    onSelectAllClick={handleSelectAllClick}
                  />
                  <TableBody>
                    {/* <SpinnerOverlay loading={isSpinnerLoading} /> */}
                    {filteredReleases?.map((row) => {
                      const {
                        _id,
                        releaseName,
                        passed,
                        failed,
                        skipped,
                        ignored,
                        warning,
                        untested,
                        total,
                        percentage,
                        executionDuration,
                        schedule,
                        updatedAt
                      } = row;
                      const isItemSelected = selected.indexOf(releaseName) !== -1;

                      return (
                        <TableRow
                          hover
                          key={_id}
                          tabIndex={-1}
                          role="checkbox"
                          selected={isItemSelected}
                          aria-checked={isItemSelected}
                        >
                          <TableCell component="th" scope="row" align="left" padding="none" sx={{ maxWidth: 200 }}>
                            <Box
                              sx={{
                                alignItems: 'left',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <Box sx={{ ml: 2 }}>
                                <Tooltip title={releaseName}>
                                  <Typography
                                    variant="subtitle2"
                                    color="#0045ff"
                                    style={{ textDecoration: 'none', cursor: 'pointer' }}
                                    onClick={() => handleReleaseClick(_id)}
                                    sx={{ display: 'flex', alignItems: 'left', gap: 1, minWidth: 0 }}
                                  >
                                    <Icon icon={briefcaseOutline} width={18} height={18} />

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
                                      {releaseName}
                                    </Box>
                                  </Typography>{' '}
                                </Tooltip>

                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                  {format(new Date(updatedAt), 'MMM dd yyyy, hh:mm a')}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>

                          <TableCell align="center">
                            <Table style={{ padding: 'none' }}>
                              <TableRow>
                                <TableCell
                                  style={{
                                    padding: '5px 10px',
                                    backgroundColor: STATUS_COLORS['TOTAL'].light,
                                    color: STATUS_COLORS['TOTAL'].highlight,
                                    borderTopLeftRadius: '12px' /* round top-left */,
                                    borderBottomLeftRadius: '12px'
                                  }}
                                >
                                  <Tooltip title={'Total'}>{total}</Tooltip>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  style={{
                                    padding: '5px 10px',
                                    backgroundColor: STATUS_COLORS['PASSED'].light,
                                    color: STATUS_COLORS['PASSED'].highlight
                                  }}
                                >
                                  <Tooltip title={'Passed'}>{passed}</Tooltip>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{
                                    padding: '5px 10px',
                                    backgroundColor: STATUS_COLORS['SKIPPED'].light,
                                    color: STATUS_COLORS['SKIPPED'].highlight
                                  }}
                                >
                                  <Tooltip title={'Skipped'}>{skipped}</Tooltip>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  style={{
                                    padding: '5px 10px',
                                    backgroundColor: STATUS_COLORS['FAILED'].light,
                                    color: STATUS_COLORS['FAILED'].highlight
                                  }}
                                >
                                  <Tooltip title={'Failed'}>{failed}</Tooltip>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  style={{
                                    padding: '5px 10px',
                                    backgroundColor: STATUS_COLORS['IGNORED'].light,
                                    color: STATUS_COLORS['IGNORED'].highlight
                                  }}
                                >
                                  <Tooltip title={'Ignored'}>{ignored}</Tooltip>
                                </TableCell>
                                <TableCell
                                  style={{
                                    padding: '5px 10px',
                                    backgroundColor: STATUS_COLORS['WARNING'].light,
                                    color: STATUS_COLORS['WARNING'].highlight
                                  }}
                                >
                                  <Tooltip title={'Warning'}>{warning}</Tooltip>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  style={{
                                    padding: '5px 10px',
                                    backgroundColor: STATUS_COLORS['UNTESTED'].light,
                                    color: STATUS_COLORS['UNTESTED'].highlight,
                                    borderTopRightRadius: '12px' /* round top-left */,
                                    borderBottomRightRadius: '12px'
                                  }}
                                >
                                  <Tooltip title={'Untested'}>{untested}</Tooltip>
                                </TableCell>
                              </TableRow>
                            </Table>
                            {/* <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <p>
                                {total} {' / '}
                              </p>
                              <p>
                                {passed} {' / '}
                              </p>
                              <p>
                                {skipped} {' / '}
                              </p>
                              <p>
                                {failed}
                                {' / '}
                              </p>

                              <p>
                                {ignored}
                                {' / '}
                              </p>

                              <p>
                                {warning}
                                {' /'}
                              </p>
                              <p>{untested}</p>
                            </Box> */}
                          </TableCell>
                          <TableCell align="center" sx={{ width: 180 }}>
                            <Stack direction="column" alignItems="center" sx={{ px: 2, width: 1, height: 1 }}>
                              <Typography variant="caption" sx={{ width: 90, ml: 1 }}>
                                {/* ({fPercentage(56, 56)}) */} {percentage} %
                              </Typography>
                              <LinearProgress
                                value={percentage}
                                variant="determinate"
                                label={percentage}
                                color={
                                  (percentage < 30 && 'error') ||
                                  (percentage > 30 && percentage < 70 && 'warning') ||
                                  'primary'
                                }
                                sx={{ width: 1, height: 6 }}
                              />
                            </Stack>
                          </TableCell>
                          <TableCell align="center">{executionDuration}</TableCell>
                          <TableCell align="left">{schedule?.replace(' ', '_')}</TableCell>
                          {/* <TableCell align="left">
                            <ReactApexChart
                              type="bar"
                              series={CHART_DATA}
                              options={TrendChartOptions}
                              width={100}
                              height={50}
                            />
                          </TableCell> */}
                          {(pageConfig?.delete || pageConfig?.clone || pageConfig?.run) &&
                            !licenseExpired &&
                            !STATUS.includes(currentProject?.status) && (
                              <TableCell align="center">
                                <ReleaseMoreMenu
                                  pageConfig={pageConfig}
                                  onDelete={() => handleDeleteRelease(_id)}
                                  onClickRun={() => handleRunRelease(_id)}
                                  releaseId={_id}
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
        <Dialog
          open={openMessage}
          onClose={handleClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">No Modules found</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              <br /> No modules found in this project. Please create a module to proceed.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>OK</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Page>
  );
}
