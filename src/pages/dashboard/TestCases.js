import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useSpring, animated } from 'react-spring';
import { Icon } from '@iconify/react';
import plusFill from '@iconify/icons-eva/plus-fill';
import { Container, Grid, Card, CardHeader, Collapse, Button, Box, Typography, Stack, TextField } from '@mui/material';
// import { TreeView } from '@mui/lab';
import { TreeView, TreeItem } from '@mui/x-tree-view';
import { alpha, styled } from '@mui/material/styles';
import { format } from 'date-fns';

import axios from '../../utils/axiosInstance';
import { useDispatch, useSelector } from '../../redux/store';
import { getUserList } from '../../redux/slices/user';
import {
  setCurrentModule,
  getModuleListSuccess,
  setFetchModuleData,
  setTestCasesPageCount,
  setModuleList,
  setTotalCount
} from '../../redux/slices/module';
import { getRowsSuccess, getCurrentFunction } from '../../redux/slices/testRun';

import { PATH_DASHBOARD } from '../../routes/paths';
import useSettings from '../../hooks/useSettings';
import Page from '../../components/Page';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import { Block } from '../components-overview/Block';
// import DataGridCustom1 from '../components-overview/material-ui/data-grid/DataGridCustom1';
import DataGridCustom from '../components-overview/material-ui/data-grid/DataGridCustom';
import { fShortenNumber } from '../../utils/formatNumber';
import API from '../../services';
import { getSessionObj } from '../../utils/jwt';
import { STATUS } from '../../Constants';
import { getIDBCurrentProject } from '../../main';
import LoadingScreen from '../../components/LoadingScreen';
import SpinnerOverlay from '../../components/SpinnerOverlay';

// Styles
const TreeViewStyle = styled(TreeView)({
  height: 480,
  flexGrow: 1,
  maxWidth: 400
});

const TestCasesCard = styled(Card)(({ theme }) => ({
  boxShadow: 'none',
  textAlign: 'center',
  padding: theme.spacing(5, 0),
  color: theme.palette.primary.darker,
  backgroundColor: theme.palette.primary.lighter
}));

const TestCasesStepsCard = styled(Card)(({ theme }) => ({
  boxShadow: 'none',
  textAlign: 'center',
  padding: theme.spacing(5, 0),
  color: theme.palette.primary.darker,
  backgroundColor: theme.palette.info.lighter
}));

const ModuleInfoCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2.3, 2),
  backgroundColor: '#f4f6f8'
}));

const RowStyle = styled('div')({
  display: 'flex',
  justifyContent: 'space-between'
});

// Animated Transition
function TransitionComponent(props) {
  const style = useSpring({
    from: { opacity: 0, transform: 'translate3d(20px,0,0)' },
    to: { opacity: props.in ? 1 : 0, transform: `translate3d(${props.in ? 0 : 20}px,0,0)` }
  });

  return (
    <animated.div style={style}>
      <Collapse {...props} />
    </animated.div>
  );
}

TransitionComponent.propTypes = {
  in: PropTypes.bool
};

// Styled TreeItem
const StyledTreeItem = styled(TreeItem)(({ theme }) => ({
  '& .MuiTreeItem-group': {
    marginLeft: 15,
    paddingLeft: 18,
    borderLeft: `1px dashed ${alpha(theme.palette.text.primary, 0.4)}`
  },
  '& .MuiTreeItem-label': {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: '1rem',
    lineHeight: '2',
    fontWeight: 500
  }
}));

export default function TestCases() {
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { moduleId } = useParams();
  const { userList, appendUrl, currentUser } = useSelector((state) => state.user);
  const { currentProject } = useSelector((state) => state.project);
  const { moduleList, currentModule, fetchModuleData, testCasesPageCount } = useSelector((state) => state.module);
  const { pageConfig } = useSelector((state) => state.role);

  const [testCases, setTestCases] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [testCasesCount, setTestCasesCount] = useState(0);
  const [testStepsCount, setTestStepsCount] = useState(0);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [isLoading, setIsloading] = useState(true);
  const [isSpinnerLoading, setIsSpinnerLoading] = useState(false);

  const [modulesFetched, setModulesFetched] = useState(false);
  const [testCasesFetched, setTestCasesFetched] = useState(false);

  const getUrl = (url) => (appendUrl ? `${url}?${appendUrl}` : url);

  const setRows = useCallback(
    (data) => {
      dispatch(getRowsSuccess(data));
    },
    [dispatch]
  );

  const handleModuleClick = useCallback(
    (event, moduleId, moduleList, showLoadingScreen) => {
      if (showLoadingScreen) {
        setIsloading(true);
      } else {
        setIsSpinnerLoading(true);
      }
      const [module] = moduleList?.filter((module) => module._id === moduleId);
      setSelectedModule(module);
      setCurrentModule(dispatch, module);
      setTestCasesCount(module?.testNodes?.length);
      setPage(1);
      getTestCaseList(module._id, '1');

      if (showLoadingScreen) {
        setIsloading(false);
      } else {
        setIsSpinnerLoading(false);
      }
    },
    [dispatch]
  );

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    setIsSpinnerLoading(true);
    getTestCaseList(currentModule._id, newPage);
  };

  const getTestCaseList = useCallback(
    async (moduleID, page, showLoadingScreen) => {
      try {
        if (showLoadingScreen) setIsloading(true);
        else setIsSpinnerLoading(true);
        const projectSerialized = await getIDBCurrentProject();
        if (projectSerialized && projectSerialized._id) {
          const response = await axios({
            method: 'get',
            url: API.projects.getTestCasesByModuleId(
              projectSerialized._id,
              moduleID,
              'createdAt',
              'desc',
              rowsPerPage,
              page,
              true,
              false
            ),
            headers: {
              Authorization: `Bearer ${getSessionObj('accessToken')}`
            }
          });
          const { data } = response;
          const module = data?.response;
          const testCasesPageCount = module?.totalpages;
          const testCaseCount = module?.testCaseCount;
          const testStepCount = module?.testStepCount;
          setSelectedModule(module);
          setCurrentModule(dispatch, module);
          setTestCasesPageCount(dispatch, testCasesPageCount);
          const testCases = module?.testNodes;
          const newTestCasesObj = testCases?.map((testCase) => ({
            ...testCase?.testNode[0],
            suiteName: module?.suiteName,
            moduleId: module?._id,
            id: testCase._id,
            createdAt: module?.createdAt,
            updatedAt: module?.updatedAt,
            status: 'UNTESTED'
          }));
          setTestCases(newTestCasesObj);
          setRows(newTestCasesObj);
          setTestCasesCount(testCaseCount);
          setTestStepsCount(testStepCount);
          setTestCasesFetched(true);
        }
        if (showLoadingScreen && modulesFetched) setIsloading(false);
        else setIsSpinnerLoading(false);
      } catch (error) {
        setIsSpinnerLoading(false);
      }
    },
    [dispatch, setRows]
  );

  const handleAllTestCases = useCallback(
    async (event, moduleList, showLoadingScreen) => {
      if (showLoadingScreen) setIsloading(true);
      else setShowLoadingScreen(true);
      let allTestCases = [];

      if (moduleList) {
        dispatch(getCurrentFunction('module'));
        moduleList?.forEach((module) => {
          const { testNodes } = module;
          const newTestCasesObj = testNodes?.map((testCase) => ({
            ...testCase?.testNode[0],
            suiteName: module?.suiteName,
            moduleId: module?._id,
            id: testCase._id,
            createdAt: module?.createdAt,
            updatedAt: module?.updatedAt,
            status: 'UNTESTED'
          }));
          if (newTestCasesObj) allTestCases = [...allTestCases, ...newTestCasesObj];
        });
        const testStepCount = allTestCases?.map((testCase) => testCase?.testCaseSteps?.length);

        let total = testStepCount.reduce((a, b) => a + b, 0);
        if (isNaN(total)) {
          total = moduleList?.reduce((sum, module) => {
            return sum + (module?.testStepCount || 0);
          }, 0);
        }
        setTestCases(allTestCases);
        setRows(allTestCases);
        setSelectedModule(null);
        setTestCasesCount(allTestCases?.length);
        setTestStepsCount(total);

        if (!event && moduleId) {
          setShowLoadingScreen(true);
          handleModuleClick('', moduleId, moduleList, true);
        }
      }
      if (showLoadingScreen && testCasesFetched) setIsloading(false);
      else setIsSpinnerLoading(false);
    },
    [dispatch, handleModuleClick, moduleId, setRows, setTestStepsCount]
  );

  const getModulesList = useCallback(async (showLoadingScreen) => {
    try {
      if (fetchModuleData) {
        const projectSerialized = await getIDBCurrentProject();
        if (projectSerialized && projectSerialized._id) {
          if (showLoadingScreen) setIsloading(true);
          else setIsSpinnerLoading(true);
          const response = await axios({
            method: 'get',
            url: API.projects.getModuleByProjectId(projectSerialized._id, true, false),
            headers: {
              Authorization: `Bearer ${getSessionObj('accessToken')}`
            }
          });

          const { data } = response;
          data?.response?.sort((a, b) => {
            let value = 0;
            if (a.createdAt.localeCompare(b.createdAt)) value = -1;
            else value = 1;
            return value;
          });
          setFetchModuleData(dispatch, false);
          dispatch(getModuleListSuccess(data?.response));
          // handleAllTestCases(null, data?.response);
          setModulesFetched(true);
          // getTestCaseList(moduleId, '1', true);

          const resp = await axios({
            method: 'get',
            url: API.projects.getTestCasesByModuleId(
              projectSerialized._id,
              moduleId,
              'createdAt',
              'desc',
              rowsPerPage,
              page,
              true,
              false
            ),
            headers: {
              Authorization: `Bearer ${getSessionObj('accessToken')}`
            }
          });
          const mdata = resp?.data;
          const module = mdata?.response;
          const testCasesPageCount = module?.totalpages;
          const testCaseCount = module?.testCaseCount;
          const testStepCount = module?.testStepCount;
          setSelectedModule(module);
          setCurrentModule(dispatch, module);
          setTestCasesPageCount(dispatch, testCasesPageCount);
          const testCases = module?.testNodes;
          const newTestCasesObj = testCases?.map((testCase) => ({
            ...testCase?.testNode[0],
            suiteName: module?.suiteName,
            moduleId: module?._id,
            id: testCase._id,
            createdAt: module?.createdAt,
            updatedAt: module?.updatedAt,
            status: 'UNTESTED'
          }));
          setTestCases(newTestCasesObj);
          setRows(newTestCasesObj);
          setTestCasesCount(testCaseCount);
          setTestStepsCount(testStepCount);
          setTestCasesFetched(true);

          if (showLoadingScreen) setIsloading(false);
          else setIsSpinnerLoading(false);
        }
      }
    } catch (error) {
      setIsSpinnerLoading(false);
      // dispatch(slice.actions.hasError(error));
    } finally {
      setIsloading(false);
    }
  }, []);

  const getUpdatedBy = (id, type) => {
    const module = moduleList?.find((mod) => mod._id === id);
    const user = userList?.find((u) => u._id === (module?.updatedBy || module?.createdBy));

    if (type === 'name')
      return user ? `${user.firstName} ${user.lastName}` : `${currentUser.firstName} ${currentUser.lastName}`;
    if (type === 'date')
      return format(new Date(module?.updatedAt || module?.createdAt || Date.now()), 'MMM dd yyyy, hh:mm a');
    return '';
  };

  // Fetching data
  useEffect(() => {
    getModulesList(true);
    dispatch(getUserList());
    // handleAllTestCases(null, moduleList, true);
    // setShowLoadingScreen(true);
    // getTestCaseList(moduleId, '1', true);
  }, [dispatch, getModulesList]);

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading="Test Cases"
          links={[
            { name: currentProject?.name, href: getUrl(PATH_DASHBOARD.module.allModules) },
            { name: currentModule?.suiteName || 'Module Name', href: getUrl(PATH_DASHBOARD.module.allModules) },
            { name: 'Test Cases' }
          ]}
          info="Test modules help organize test cases in a structured way using folders and subfolders."
          action={
            pageConfig?.create &&
            !STATUS.includes(currentProject?.status) && (
              <Button
                variant="contained"
                component={RouterLink}
                to={PATH_DASHBOARD.module.newModule}
                startIcon={<Icon icon={plusFill} />}
              >
                New Module
              </Button>
            )
          }
        />
        {isLoading && <LoadingScreen />}
        {!isLoading && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Block title="Modules" sx={{ minHeight: '900px' }}>
                <Grid
                  sx={{
                    overflow: 'hidden',
                    overflowY: `${moduleList?.length > 13 ? 'scroll' : 'hidden'}`,
                    scrollbarWidth: `${moduleList?.length > 13 ? 'thin' : 'none'}`
                  }}
                >
                  <TreeViewStyle defaultExpanded={['1']} defaultSelected={moduleId} style={{ minHeight: '850px' }}>
                    <StyledTreeItem
                      nodeId="1"
                      label="All modules"
                      onClick={(event) => handleAllTestCases(event, moduleList)}
                    >
                      {moduleList &&
                        moduleList?.map((module) => (
                          <StyledTreeItem
                            key={module._id}
                            nodeId={module._id}
                            label={module.suiteName}
                            onClick={(event) => handleModuleClick(event, module._id, moduleList, true)}
                          />
                        ))}
                    </StyledTreeItem>
                  </TreeViewStyle>
                </Grid>
              </Block>
            </Grid>

            <Grid item xs={12} md={9}>
              <Grid container spacing={2} sx={{ mb: 1 }}>
                <Grid item xs={12} sm={6} md={6}>
                  <ModuleInfoCard>
                    <Stack spacing={1}>
                      <RowStyle>
                        <Stack direction="row" alignItems="center">
                          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                            Module Name :
                          </Typography>
                          <Typography
                            variant="subtitle2"
                            sx={{ textTransform: 'capitalize', color: 'text.primary', ml: 1 }}
                          >
                            {selectedModule?.suiteName || 'All Modules'}
                          </Typography>
                        </Stack>
                      </RowStyle>
                      <RowStyle>
                        <Stack direction="row" alignItems="center">
                          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                            Test Data :
                          </Typography>
                          <Typography variant="subtitle2" sx={{ color: 'text.primary', ml: 1 }}>
                            {selectedModule?.suiteName ? `${selectedModule?.suiteName}.xlsx` : 'All Modules'}
                          </Typography>
                        </Stack>
                      </RowStyle>
                      <RowStyle>
                        <Stack direction="row" alignItems="center">
                          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                            Last Updated At :
                          </Typography>
                          <Typography
                            variant="subtitle2"
                            sx={{ textTransform: 'capitalize', color: 'text.primary', ml: 1 }}
                          >
                            {getUpdatedBy(selectedModule?._id, 'date')}
                          </Typography>
                        </Stack>
                      </RowStyle>
                      <RowStyle>
                        <Stack direction="row" alignItems="center">
                          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                            Last Updated By :
                          </Typography>
                          <Typography
                            variant="subtitle2"
                            sx={{ textTransform: 'capitalize', color: 'text.primary', ml: 1 }}
                          >
                            {getUpdatedBy(selectedModule?._id, 'name')}
                          </Typography>
                        </Stack>
                      </RowStyle>
                    </Stack>
                  </ModuleInfoCard>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TestCasesCard>
                    <Typography variant="h3">{fShortenNumber(testCasesCount)}</Typography>
                    <Typography variant="subtitle2" sx={{ opacity: 0.72 }}>
                      Test Cases
                    </Typography>
                  </TestCasesCard>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TestCasesStepsCard>
                    <Typography variant="h3">
                      {selectedModule?.testStepCount || fShortenNumber(testStepsCount)}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ opacity: 0.72 }}>
                      Test Case Steps
                    </Typography>
                  </TestCasesStepsCard>
                </Grid>
              </Grid>
              <Card sx={{ p: 1 }}>
                <CardHeader title={selectedModule?.suiteName || 'All Modules'} sx={{ mb: 1 }} />
                <Box sx={{ height: 720 }}>
                  <SpinnerOverlay loading={isSpinnerLoading} />
                  {testCases && (
                    // <DataGridCustom1
                    <DataGridCustom
                      testCases={testCases || []}
                      count={testCasesPageCount || 0}
                      page={page}
                      rowsPerPage={rowsPerPage}
                      onPageChange={handleChangePage}
                    />
                  )}
                </Box>
              </Card>
            </Grid>
          </Grid>
        )}
      </Container>
    </Page>
  );
}
