import { filter } from 'lodash';
// material
import {
  Button,
  Grid,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Stack,
  TextField
} from '@mui/material';
// hooks
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import useSettings from '../../hooks/useSettings';
import { PATH_DASHBOARD } from '../../routes/paths';
// components
import Page from '../../components/Page';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import {
  AnalyticsNewUsers,
  AnalyticsBugReports,
  AnalyticsItemOrders,
  AnalyticsWeeklySales,
  AnalyticsReleaseDuration,
  ReleaseStatus,
  CumulativeTrendReport,
  RunDurationReport,
  IssuesTrendReport
} from '../../components/_dashboard/general-analytics';
import { useDispatch, useSelector } from '../../redux/store';
import { setReleaseList, setDashboardData, setFetchReleaseData } from '../../redux/slices/release';
import { getReleaseList, getReleaseInfo } from '../../_apis_/release';
import LoadingScreen from '../../components/LoadingScreen';
import { getIndexedDBObject } from '../../main';
import { IndexedDB, INDEXEDDB_KEYS } from '../../Constants';
import { setSessionObj, getSessionObj } from '../../utils/jwt';
import SpinnerOverlay from '../../components/SpinnerOverlay';

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

// ----------------------------------------------------------------------

export default function ReleaseDashboard() {
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { releaseList } = useSelector((state) => state.release);
  const [localRelease, setLocalRelease] = useState();
  const [localTestRun, setLocalTestRun] = useState();
  const [order] = useState('desc');
  const [orderBy] = useState('createdAt');
  const [filterName] = useState('');
  const { releaseId } = useParams();
  const { appendUrl } = useSelector((state) => state.user);
  const { dashboardData } = useSelector((state) => state.release);
  const [openMessage, setOpenMessage] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState({});
  const [isLoading, setIsloading] = useState(false);
  const [dashboardName, setDashboardName] = useState('Release Dashboard');
  const [isSpinnerLoading, setIsSpinnerLoading] = useState(false);

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
  };

  const getReleases = useCallback(async () => {
    const releaseList = await getReleaseList();
    const filteredReleases = applySortFilter(releaseList, getComparator(order, orderBy), filterName);
    setReleaseList(dispatch, filteredReleases);
  }, [dispatch, filterName, order, orderBy]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      releaseId
    }
  });

  const { values, setFieldValue } = formik;

  const getReleaseInfoData = useCallback(
    async (releaseId) => {
      if (releaseId) {
        setIsSpinnerLoading(true);
        const releaseInfo = await getReleaseInfo(releaseId);
        setIsSpinnerLoading(false);
        if (releaseInfo?.jobNames?.length !== 0) {
          setDashboardData(dispatch, releaseInfo);
          setFieldValue('releaseId', releaseInfo?._id);
          setDashboardName(`${releaseInfo?.releaseName} - Release Dashboard`);
        } else {
          setOpenMessage(true);
        }
      }
    },
    [dispatch, setFieldValue]
  );

  const handleReleaseChange = async (releaseId) => {
    // setFieldValue('releaseId', releaseId);
    const release = releaseList?.find((release) => release._id === releaseId);
    setSelectedRelease(release);
    openReleaseDashboard(releaseId);
    // setOpen(true);
  };

  const goBack = async () => {
    setFetchReleaseData(dispatch, true);
    const release = localRelease || JSON.parse(getSessionObj('localRelease'));
    const testRun = localTestRun || JSON.parse(getSessionObj('localTestRun'));
    setSessionObj('localRelease');
    setSessionObj('localTestRun');
    if (release) {
      navigateToLink(`${PATH_DASHBOARD.release.root}/release/${release._id}/testCases`);
    }
    if (testRun) {
      navigateToLink(`${PATH_DASHBOARD.testRuns.root}/testRuns/${testRun._id}/testCases`);
    }
  };

  const openReleaseDashboard = async (releaseId) => {
    setIsloading(true);
    getReleaseInfoData(releaseId);
    setIsloading(false);
  };

  useEffect(() => {
    setDashboardData(dispatch, null);
  }, [dispatch]);

  useEffect(() => {
    async function fetchData() {
      const release = await getIndexedDBObject(IndexedDB.RELEASE, INDEXEDDB_KEYS.CURRENT_RELEASE);
      setLocalRelease(release);
      if (release) setSessionObj('localRelease', JSON.stringify(release));
      const testRun = await getIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_TESTRUN);
      setLocalTestRun(testRun);
      if (testRun) setSessionObj('localTestRun', JSON.stringify(testRun));
      getReleases();
    }
    fetchData();
    getReleaseInfoData(releaseId);
  }, [dispatch, getReleaseInfoData, getReleases, releaseId]);

  console.log('dashboardData', dashboardData);

  return (
    <Page title="Test Ensure">
      <HeaderBreadcrumbs
        heading={dashboardName}
        links={[{ name: 'Dashboard' }]}
        info="Release dashboard helps you understand the Automation pass rate and script effectivess"
        action={
          <>
            <Button variant="contained" size="small" onClick={goBack}>
              Back
            </Button>{' '}
          </>
        }
      />
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <SpinnerOverlay loading={isSpinnerLoading} />
        <Grid container spacing={3}>
          <Grid item xs={12} sm={3} md={12}>
            <Stack width={450}>
              <TextField
                select
                fullWidth
                size="small"
                // label="Releases"
                value={values.releaseId}
                placeholder="Select Release"
                id="module"
                SelectProps={{ native: true }}
                // onChange={setOpen(true)}
                onChange={(event) => handleReleaseChange(event.target.value)}
              >
                {releaseList?.length === 0 ? <option value="">Select Release</option> : null}
                {releaseList?.length > 0 &&
                  releaseList.map((release) => (
                    <option key={release._id} value={release._id}>
                      {release.releaseName}
                    </option>
                  ))}
              </TextField>
            </Stack>
          </Grid>
          {isLoading && <LoadingScreen />}
          {!isLoading && (
            <>
              <Grid item xs={12} sm={6} md={2.4}>
                <AnalyticsWeeklySales TOTAL={dashboardData?.testCasesCount} />
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <AnalyticsNewUsers TOTAL={dashboardData?.testStepsCount} />
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <AnalyticsItemOrders TOTAL={dashboardData?.testCasesCount} COUNT={dashboardData?.automatedTestCases} />
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <AnalyticsBugReports TOTAL={dashboardData?.testRunsCount} />
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <AnalyticsReleaseDuration TOTAL={dashboardData?.releaseDuration || '0s'} />
              </Grid>

              <Grid item xs={12} md={6} lg={8}>
                {/* {dashboardData?.cummulativeMetrics && (
                  <CumulativeTrendReport
                    categories={dashboardData?.cummulativeMetrics?.categories}
                    CHART_DATA={dashboardData?.cummulativeMetrics?.cumm_chart_data}
                  />
                )} */}

                {dashboardData?.cummulativeMetrics?.categories &&
                  dashboardData?.cummulativeMetrics?.cumm_chart_data && (
                    <CumulativeTrendReport
                      cardHeader="Cumulative Trend - Releases"
                      categories={dashboardData?.cummulativeMetrics?.categories}
                      CHART_DATA={dashboardData?.cummulativeMetrics?.cumm_chart_data}
                    />
                  )}
              </Grid>

              <Grid item xs={12} md={6} lg={4}>
                {/* {dashboardData?.releaseStatusMetrics && (
                  <ReleaseStatus
                    releaseName={dashboardData?.releaseStatusMetrics?.releaseName}
                    CHART_DATA={dashboardData?.releaseStatusMetrics?.releaseStatus}
                  />
                )} */}

                {dashboardData?.releaseStatusMetrics?.releaseName &&
                  dashboardData?.releaseStatusMetrics?.releaseStatus && (
                    <ReleaseStatus
                      releaseName={dashboardData?.releaseStatusMetrics?.releaseName}
                      CHART_DATA={dashboardData?.releaseStatusMetrics?.releaseStatus}
                    />
                  )}
              </Grid>

              {dashboardData?.testRunCummulativeMetrics && (
                <Grid item xs={12} md={6} lg={12}>
                  <CumulativeTrendReport
                    cardHeader="Cumulative Trend - Test Runs"
                    categories={dashboardData?.testRunCummulativeMetrics?.categories}
                    CHART_DATA={dashboardData?.testRunCummulativeMetrics?.cumm_testrun_chart_data}
                  />
                </Grid>
              )}

              <Grid item xs={12}>
                {/* md={6} lg={6}> */}
                {/* {dashboardData?.issuesMetrics && (
                  <IssuesTrendReport
                    categories={dashboardData?.issuesMetrics?.categories}
                    CHART_DATA={dashboardData?.issuesMetrics?.issue_chart_data}
                  />
                )} */}
                <IssuesTrendReport
                  categories={dashboardData?.issuesMetrics?.categories}
                  CHART_DATA={dashboardData?.issuesMetrics?.issue_chart_data}
                />
              </Grid>

              <Grid item xs={12}>
                {/* md={6} lg={6}> */}
                {/* {dashboardData?.durationMetrics && (
                  <RunDurationReport
                    categories={dashboardData?.durationMetrics?.categories}
                    CHART_DATA={dashboardData?.durationMetrics?.duration_chart_data}
                  />
                )} */}
                <RunDurationReport
                  categories={dashboardData?.durationMetrics?.categories}
                  CHART_DATA={dashboardData?.durationMetrics?.duration_chart_data}
                />
              </Grid>
            </>
          )}
        </Grid>
        {/* <Dialog
          open={open}
          onClose={handleClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            Are you sure you want to open {selectedRelease?.releaseName} Release Dashboard?
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              <br /> This will open selected Release Dashboard
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Disagree</Button>
            <Button
              onClick={() => {
                handleClose();
                openReleaseDashboard();
              }}
              autoFocus
            >
              Agree
            </Button>
          </DialogActions>
        </Dialog> */}
        <Dialog
          open={openMessage}
          onClose={handleClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">Dashboard Info?</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              <br /> {selectedRelease?.releaseName} doesn't have any jobs to display dashboard!
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
