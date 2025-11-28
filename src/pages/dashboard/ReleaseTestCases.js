import { useRef, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSpring, animated } from 'react-spring';
// material
import { Container, Grid, Card, CardHeader, Collapse, Button, Box, Tooltip, InputLabel } from '@mui/material';
// redux
// import { TreeView, TreeItem } from '@mui/lab';
import { TreeView, TreeItem } from '@mui/x-tree-view';
import { alpha, styled } from '@mui/material/styles';
import fileTextOutline from '@iconify/icons-eva/file-text-outline';
import refreshFill from '@iconify/icons-eva/refresh-fill';
import { Icon } from '@iconify/react';
import { useDispatch, useSelector } from '../../redux/store';
import {
  setModuleData,
  setReleaseTestNodes,
  setUntestedTestNodes,
  setGraphTestCases,
  setCurrentGraphTestCounts,
  setExecutionDuration,
  setFetchReleaseData
} from '../../redux/slices/release';
import { getRowsSuccess, getTestCaseEvidences, setCurrentTestRun } from '../../redux/slices/testRun';
import { setPageConfig, setTestCasesConfig } from '../../redux/slices/role';
import { getDefectList } from '../../redux/slices/defect';
// api
import { getReleaseStatus } from '../../_apis_/release';
import { getTestRunStatus } from '../../_apis_/testRun';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import { Block } from '../components-overview/Block';
import DataGridCustom from '../components-overview/material-ui/data-grid/DataGridCustom';
import TestCasesGraph from './TestCasesGraph';
import LoadingScreen from '../../components/LoadingScreen';
import { IndexedDB, INDEXEDDB_KEYS, EXCLUDE_KEYS } from '../../Constants';
import { setIndexedDBObject } from '../../main';
import { setSessionObj } from '../../utils/jwt';

// ----------------------------------------------------------------------

const TreeViewStyle = styled(TreeView)({
  height: 240,
  flexGrow: 1,
  maxWidth: 400
});

// TransitionComponent for TreeItem animation
TransitionComponent.propTypes = {
  in: PropTypes.bool
};
function TransitionComponent(props) {
  const style = useSpring({
    from: {
      opacity: 0,
      transform: 'translate3d(20px,0,0)'
    },
    to: {
      opacity: props.in ? 1 : 0,
      transform: `translate3d(${props.in ? 0 : 20}px,0,0)`
    }
  });
  return (
    <animated.div style={style}>
      <Collapse {...props} />
    </animated.div>
  );
}

// Corrected StyledTreeItem styled component
const StyledTreeItem = styled((props) => <TreeItem {...props} TransitionComponent={TransitionComponent} />)(
  ({ theme }) => ({
    iconContainer: {
      '& .close': {
        opacity: 0.3
      }
    },
    group: {
      marginLeft: 15,
      paddingLeft: 18,
      borderLeft: `1px dashed ${alpha(theme.palette.text.primary, 0.4)}`
    },
    label: {
      whiteSpace: 'nowrap',
      width: 'auto',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      fontSize: '1rem !important',
      lineHeight: '2 !important',
      fontWeight: '500 !important'
    }
  })
);

// ----------------------------------------------------------------------

export default function TestCases() {
  const navigate = useNavigate();
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const isTestRun = pathname.includes('testRuns');
  const { releaseId, testRunId } = useParams();

  // Redux selectors
  const { appendUrl } = useSelector((state) => state.user);
  const { executionDuration, moduleData, fetchReleaseData } = useSelector((state) => state.release);
  const { roleConfig } = useSelector((state) => state.role);
  const { currentTestRun, testRunList } = useSelector((state) => state.testRun);

  // Local states
  const [testCases, setTestCases] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [releaseName, setReleaseName] = useState('Test Cases');
  const [releaseDashboard] = useState(false);

  // Refs
  const testCasesResponse = useRef(null);
  const buttonRef = useRef(null);
  const testRunReleaseId = useRef(null);

  // Helpers
  const getUrl = (url) => {
    if (appendUrl) return `${url}?${appendUrl}`;
    return url;
  };

  const navigateToLink = (url) => {
    navigate(getUrl(url));
  };

  // Dispatch setters with try/catch to avoid crashes
  const setRows = useCallback(
    async (data) => {
      try {
        dispatch(getRowsSuccess(data));
      } catch (error) {
        console.error(error);
      }
    },
    [dispatch]
  );

  const setTotalGraphTestCases = useCallback(
    async (data) => {
      try {
        dispatch(setGraphTestCases(data));
      } catch (error) {
        console.error(error);
      }
    },
    [dispatch]
  );

  const setUpdatedGraphTestCases = useCallback(
    async (data) => {
      try {
        dispatch(setCurrentGraphTestCounts(data));
      } catch (error) {
        console.error(error);
      }
    },
    [dispatch]
  );

  // Handle loading all test cases from module data by module id
  const handleAllTestCases = useCallback(
    (modules, id) => {
      if (!modules) return;

      // Support composite ids for testPlaceholders (e.g. moduleId_testPlaceholderId)
      let moduleId = id;
      let testPlaceholderId = null;
      if (id.includes('_')) {
        [moduleId, testPlaceholderId] = id.split('_');
      }

      const module = modules.find((m) => m._id.toString() === id.toString());
      if (!module) return;

      let allTestCases = [];
      let allTestNodes = [];
      const untestedTestNodes = [];

      if (testPlaceholderId) {
        // Find test placeholder inside module if id contains placeholder part
        const testPlaceholder = module.testPlaceholders?.find((tp) => tp.tpId === testPlaceholderId);
        if (testPlaceholder) {
          allTestCases = module.testNodes || [];
          allTestNodes = module.testNodes || [];
        }
      } else {
        allTestCases = module.testNodes || [];
        allTestNodes = module.testNodes || [];
      }

      setExecutionDuration(dispatch, module.executionDuration);
      setTestCases(allTestCases);
      dispatch(setReleaseTestNodes(allTestNodes));
      dispatch(setUntestedTestNodes(untestedTestNodes));
      setRows(allTestNodes);
      setSelectedModule(module);
      setTotalGraphTestCases(module.graphTestCases);
      setUpdatedGraphTestCases(module.graphTestCases);
    },
    [dispatch, setRows, setTotalGraphTestCases, setUpdatedGraphTestCases]
  );

  // Fetch release or test run status and update store accordingly
  const getReleaseStats = useCallback(async () => {
    let moduleData;
    if (fetchReleaseData) {
      setFetchReleaseData(dispatch, false);
      if (releaseId) moduleData = await getReleaseStatus(releaseId);
      else if (testRunId) {
        moduleData = await getTestRunStatus(testRunId);
        const testRun = testRunList?.find((testRun) => testRun._id === testRunId);
        setCurrentTestRun(dispatch, testRun);
        if (!testRun) {
          setCurrentTestRun(dispatch, {
            _id: moduleData?._id,
            testRun: moduleData?.testRun,
            exportedFilePath: moduleData?.exportedFilePath
          });
        }
      }
      testCasesResponse.current = moduleData;
      if (moduleData?.releaseName) setReleaseName(moduleData?.releaseName);
      setModuleData(dispatch, moduleData?.modules);
      testRunReleaseId.current = moduleData?.releaseId;
    }

    testCasesResponse.current = moduleData;
    if (moduleData?.releaseName) setReleaseName(moduleData?.releaseName);
    // else setReleaseName('Test Cases');
    setModuleData(dispatch, moduleData?.modules || []);
  }, []);

  // Clear IndexedDB and redux states on mount or path change
  const clearSessions = useCallback(() => {
    if (!pathname.includes('testCaseDetails')) {
      setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.TESTSTEP_RESULTS);
      setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.EVIDENCES_FETCHED);
      setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.TESTSTEP_DETAILS);
      setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.TESTSTEP_LOGS);
      setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_FUNCTION);
      setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.TESTCASE_EVIDENCES_FECTHED);
      dispatch(getTestCaseEvidences({ testcaseevidences: [], testCaseEvidencesFetched: false }));
    }
  }, [dispatch, pathname]);

  // Set page config based on role and current page type
  useEffect(() => {
    if (!roleConfig || Object.keys(roleConfig).length === 0) return;

    if (!isTestRun) {
      setPageConfig(dispatch, roleConfig.releases);
      setTestCasesConfig(dispatch, roleConfig.releaseTestCases);
    } else {
      setPageConfig(dispatch, roleConfig.testRuns);
      setTestCasesConfig(dispatch, roleConfig.testRunsTestCases);
    }
  }, [dispatch, roleConfig, isTestRun]);

  useEffect(() => {
    clearSessions();
    setExecutionDuration(dispatch, null);
    getReleaseStats();
  }, [dispatch, getReleaseStats]);

  // Main effect to load data on mount or param changes
  useEffect(() => {
    if (!moduleData) return;

    if (releaseId) {
      handleAllTestCases(moduleData, releaseId);
      setIndexedDBObject(IndexedDB.MODULE, INDEXEDDB_KEYS.CURRENT_MODULE, null);
      setIndexedDBObject(IndexedDB.RELEASE, INDEXEDDB_KEYS.CURRENT_RELEASE, { _id: releaseId });
      setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_TESTRUN, null);
      setSessionObj(INDEXEDDB_KEYS.CURRENT_MODULE, null);
      setSessionObj(INDEXEDDB_KEYS.CURRENT_RELEASE, JSON.stringify({ _id: releaseId }));
      setSessionObj(INDEXEDDB_KEYS.CURRENT_TESTRUN, null);
    } else if (testRunId) {
      handleAllTestCases(moduleData, testRunId);
      setIndexedDBObject(IndexedDB.MODULE, INDEXEDDB_KEYS.CURRENT_MODULE, null);
      setIndexedDBObject(IndexedDB.RELEASE, INDEXEDDB_KEYS.CURRENT_RELEASE, null);
      setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_TESTRUN, { _id: testRunId });
      setSessionObj(INDEXEDDB_KEYS.CURRENT_MODULE, null);
      setSessionObj(INDEXEDDB_KEYS.CURRENT_RELEASE, null);
      setSessionObj(INDEXEDDB_KEYS.CURRENT_TESTRUN, JSON.stringify({ _id: testRunId }));
    }
  }, [moduleData, releaseId, testRunId, handleAllTestCases]);

  // Fetch defect list whenever release or test run changes
  useEffect(() => {
    if (releaseId) {
      getDefectList(dispatch, releaseId, null);
    }
    if (testRunId) {
      getDefectList(dispatch, currentTestRun?.releaseID, testRunId);
    }
  }, [dispatch, releaseId, currentTestRun?.releaseID, testRunId]);

  // Auto refresh test cases based on runningStatus and interval
  useEffect(() => {
    const runningStatuses = ['completed', 'aborted', 'manual'];
    const interval = setInterval(() => {
      if (
        testCasesResponse.current?.runningStatus &&
        !runningStatuses.includes(testCasesResponse.current?.runningStatus?.toLowerCase())
      ) {
        if (buttonRef.current) {
          buttonRef.current.click();
        }
      }
    }, process.env.REACT_APP_TESTCASES_SCREEN_REFRESH_TIME || 30000); // fallback 30s
    return () => clearInterval(interval);
  }, [testCasesResponse]);

  // Open release dashboard page
  const openReleaseDashboard = () => {
    if (currentTestRun) navigateToLink(`${PATH_DASHBOARD.release.root}/${currentTestRun?.releaseID}/releaseDashboard`);
    else {
      if (releaseId) navigateToLink(`${PATH_DASHBOARD.release.root}/${releaseId}/releaseDashboard`);
      // When test cases screen of test runs is reloaded, need releaseId, if navigating to dashboard
      // Redux data wont be available due to reload
      if (testRunReleaseId.current)
        navigateToLink(`${PATH_DASHBOARD.release.root}/${testRunReleaseId.current}/releaseDashboard`);
    }
  };

  // Refresh report handler
  const refreshReport = () => {
    setExecutionDuration(dispatch, null);
    setFetchReleaseData(dispatch, true);
    getReleaseStats();
    if (releaseId) {
      handleAllTestCases(moduleData, releaseId);
      setIndexedDBObject(IndexedDB.MODULE, INDEXEDDB_KEYS.CURRENT_MODULE, null);
      setIndexedDBObject(IndexedDB.RELEASE, INDEXEDDB_KEYS.CURRENT_RELEASE, { _id: releaseId });
      setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_TESTRUN, null);
    } else if (testRunId) {
      handleAllTestCases(moduleData, testRunId);
      setIndexedDBObject(IndexedDB.MODULE, INDEXEDDB_KEYS.CURRENT_MODULE, null);
      setIndexedDBObject(IndexedDB.RELEASE, INDEXEDDB_KEYS.CURRENT_RELEASE, null);
      setIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_TESTRUN, { _id: testRunId });
    }
  };

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading={isTestRun ? 'Test Runs - Test Cases' : 'Release - Test Cases'}
          links={[
            {
              name: isTestRun ? 'Test Runs' : 'All Releases',
              href: isTestRun ? getUrl(PATH_DASHBOARD.testRuns.allTestRuns) : getUrl(PATH_DASHBOARD.release.allReleases)
            },
            { name: releaseName }
          ]}
          info={
            isTestRun
              ? 'Test Runs- This has the details of the the particular test run with the testcase status, screenshots and logs'
              : 'Release-TestCases-This has the details of particular release with number of modules added and the testcases'
          }
          action={
            <>
              <Button
                ref={buttonRef}
                onClick={refreshReport}
                variant="contained"
                size="small"
                startIcon={<Icon icon={refreshFill} />}
              >
                Refresh
              </Button>{' '}
              {/* {pageConfig?.dashboard && ( */}
              <Button
                disabled={releaseDashboard}
                onClick={openReleaseDashboard}
                variant="contained"
                startIcon={<Icon icon={fileTextOutline} />}
                sx={{ backgroundColor: '#0027b7' }}
                size="small"
              >
                Dashboard
              </Button>
              {/* )}{' '} */}
            </>
          }
        />
        {(releaseName === 'Test Cases' || parseInt(testCases?.length, 10) === 0) && <LoadingScreen />}
        {releaseName !== 'Test Cases' && parseInt(testCases?.length, 10) !== 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={12} md={12}>
              <TestCasesGraph executionDuration={executionDuration} />
            </Grid>
            <Grid item xs={12} md={3}>
              <Block title="Modules" sx={{ minHeight: '745px' }}>
                <Grid
                  sx={{
                    overflow: 'hidden',
                    overflowY: `${moduleData?.length > 13 ? 'scroll' : 'hidden'}`,
                    scrollbarWidth: `${moduleData?.length > 13 ? 'thin' : 'none'}`
                  }}
                >
                  <TreeViewStyle defaultExpanded={['1']} defaultSelected="moduleId" style={{ minHeight: '700px' }}>
                    <StyledTreeItem
                      nodeId="1"
                      label="All modules"
                      onClick={() => handleAllTestCases(moduleData, releaseId || testRunId)}
                    >
                      {moduleData?.map(
                        (module) =>
                          module.suiteName && (
                            <StyledTreeItem
                              key={module._id}
                              nodeId={module._id}
                              label={module.suiteName}
                              onClick={() => handleAllTestCases(moduleData, module._id)}
                            >
                              {pathname.includes('release') &&
                                module?.testPlaceholders?.length > 0 &&
                                module?.testPlaceholders.map((tp, index) => {
                                  const tpData = Object.keys(tp)
                                    .filter((key) => !EXCLUDE_KEYS.includes(key))
                                    .map((key) => (
                                      <InputLabel
                                        key={`${key} :${tp[key]}`}
                                        sx={{
                                          '& .MuiInputBase-input': {
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                          }
                                        }}
                                      >{`${key} :${tp[key]}`}</InputLabel>
                                    ));
                                  return (
                                    <Tooltip title={tpData} placement="left-start" key={`${index + 1}`}>
                                      <div>
                                        <StyledTreeItem
                                          key={`${index + 1}`}
                                          nodeId={tp?.tpId}
                                          label={`TestData ${index + 1}`}
                                          onClick={() => handleAllTestCases(moduleData, `${module._id}_${tp?.tpId}`)}
                                        />
                                      </div>
                                    </Tooltip>
                                  );
                                })}
                            </StyledTreeItem>
                          )
                      )}
                    </StyledTreeItem>
                  </TreeViewStyle>
                </Grid>
              </Block>
            </Grid>
            <Grid item xs={12} md={9}>
              <Card sx={{ p: 1 }}>
                <CardHeader
                  title={selectedModule?.suiteName || selectedModule?.moduleName || 'All Modules'}
                  sx={{ mb: 1 }}
                />
                {testCases && (
                  <Box sx={{ height: 720 }}>
                    <DataGridCustom testCases={testCases} />
                  </Box>
                )}
              </Card>
            </Grid>
          </Grid>
        )}
      </Container>
    </Page>
  );
}
