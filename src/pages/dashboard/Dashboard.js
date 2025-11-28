import { merge, cloneDeep } from 'lodash';
import { Icon } from '@iconify/react';
import { useState, useEffect, useCallback } from 'react';
import plusFill from '@iconify/icons-eva/plus-fill';
import { Link as RouterLink } from 'react-router-dom';

// material
import { useTheme } from '@mui/material/styles';
import { Card, Grid, Box, Stack, Button, Container, Typography } from '@mui/material';
// redux
import ReactApexChart from 'react-apexcharts';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from '../../redux/store';
import { fNumber } from '../../utils/formatNumber';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import { BaseOptionChart } from '../../components/charts';
import TestEnsure from '../../layouts/TestEnsure.jpg';
import AllProjectsIcon from '../../layouts/AllProjectsIcon.svg';
import AllReleasesIcon from '../../layouts/AllReleasesIcon.svg';
import { setCurrentProject, setProjectList, setFilteredProjectList } from '../../redux/slices/project';
import { getFilteredProjectList } from '../../_apis_/project';
import STATUS from '../../components/_dashboard/project/ProjectStatus';
import { getIDBCurrentProject, getIndexedDBObject } from '../../main';
import { setPageConfig, setRoleConfig, setFetchRoledata, setRolesList } from '../../redux/slices/role';
import { IndexedDB, INDEXEDDB_KEYS, USER_ROLES } from '../../Constants';

const legendData = { total: 35, passed: 30, failed: 1, skipped: 4, untested: 0, blocked: 0 };

const CHART_DATA = [30, 1, 0, 0, 4];

const getPercentage = (passed, total) => parseInt((passed / total) * 100, 10);

const getRemaining = (passed, total) => parseInt(total - passed, 10);

Legend.propTypes = {
  label: PropTypes.string,
  number: PropTypes.number,
  total: PropTypes.number,
  color: PropTypes.string
};

function Legend({ label, number, total, color }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: '8px !important' }}>
      <Box
        sx={{
          width: 15,
          height: 15,
          bgcolor: 'grey.50016',
          borderRadius: 0.75,
          ...{
            bgcolor: color
          }
        }}
      />
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle2" style={{ fontSize: '0.7rem' }}>
          {number}
          &nbsp;
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            mt: 0,
            display: 'flex',
            alignItems: 'center',
            color: 'text.secondary',
            fontSize: '0.5rem'
          }}
        >
          {total === 0 ? 0 : parseInt((number / total) * 100, 10)}% set to be {label}
        </Typography>
      </Box>
    </Stack>
  );
}

export default function Dashboard() {
  const theme = useTheme();
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { currentUser, appendUrl } = useSelector((state) => state.user);
  const { projectList } = useSelector((state) => state.project);
  const { roleConfig, pageConfig } = useSelector((state) => state.role);
  const [executionDuration] = useState('15m');
  const { licenseExpired } = useSelector((state) => state.license);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const filterUnArchivedProjects = useCallback(async () => {
    if (!projectList) {
      const data = await getFilteredProjectList(
        STATUS.UNARCHIVED,
        currentUser?.company?._id,
        'createdAt',
        'desc',
        '10',
        '0'
      );
      const projects = data?.data;
      setProjectList(dispatch, projects);
      setFilteredProjectList(dispatch, projects);
      setRolesList(dispatch, null);
      const currentProject = await getIDBCurrentProject();
      const project = projects?.find((project) => project?._id === currentProject?._id);
      const allProject = projectList?.find((project) => project?._id === currentProject?._id);
      if (!project && !allProject && projectList) {
        setCurrentProject(dispatch, null);
        setRoleConfig(dispatch, null);
        setFetchRoledata(dispatch, true);
      }
    }
    if (!roleConfig) setRoleConfig(dispatch, await getIndexedDBObject(IndexedDB.ROLE, INDEXEDDB_KEYS.ROLE_CONFIG));
  }, [dispatch, currentUser, projectList, roleConfig]);

  useEffect(() => {
    if (roleConfig && Object.keys(roleConfig)?.length !== 0) setPageConfig(dispatch, roleConfig?.projects);
    filterUnArchivedProjects();
  }, [dispatch, filterUnArchivedProjects, roleConfig]);

  // const chartOptions = merge(
  //   cloneDeep(BaseOptionChart(), {
  //     colors: ['#36AB51', '#F44B25', '#9A9B9C', '#16ABC5', '#FFAA00'],
  //     labels: ['Passed', 'Failed', 'Untested', 'Blocked', 'Skipped'],
  //     stroke: { colors: [theme.palette.background.paper], width: 0 },
  //     legend: { show: false },
  //     dataLabels: { enabled: true, dropShadow: { enabled: false } },
  //     tooltip: {
  //       fillSeriesColor: false,
  //       y: {
  //         formatter: (seriesName) => fNumber(seriesName),
  //         title: {
  //           formatter: (seriesName) => `${seriesName}`
  //         }
  //       }
  //     },
  //     plotOptions: {
  //       pie: { donut: { labels: { show: false } } }
  //     },
  //     chart: {
  //       id: 'testCaseCounts'
  //     }
  //   })
  // );

  const chartOptions = merge(
    cloneDeep(BaseOptionChart()), // clone base options first
    {
      colors: ['#36AB51', '#F44B25', '#9A9B9C', '#16ABC5', '#FFAA00'],
      labels: ['Passed', 'Failed', 'Untested', 'Blocked', 'Skipped'],
      stroke: { colors: [theme.palette.background.paper], width: 0 },
      legend: { show: false },
      dataLabels: { enabled: true, dropShadow: { enabled: false } },
      tooltip: {
        fillSeriesColor: false,
        y: {
          formatter: (seriesName) => fNumber(seriesName),
          title: { formatter: (seriesName) => `${seriesName}` }
        }
      },
      plotOptions: { pie: { donut: { labels: { show: false } } } },
      chart: { id: 'testCaseCounts' }
    }
  );

  return (
    <Page title="TestEnsure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={12}>
            <Card>
              <Stack spacing={3} direction="row">
                <Stack style={{ width: '50%', padding: '4%', paddingTop: '9%' }}>
                  <Typography style={{ fontSize: '1.3rem', fontWeight: '700' }}>
                    Hi {currentUser?.firstName},
                  </Typography>
                  <Typography style={{ fontSize: '1.3rem', fontWeight: '700' }}>
                    <Stack direction="row">
                      Welcome to <Stack style={{ color: '#0da84b' }}> Test</Stack>
                      <Stack style={{ color: '#003399' }}>Ensure!</Stack>
                    </Stack>
                  </Typography>
                  <Typography style={{ fontSize: '0.8rem', fontWeight: '200' }}>
                    A comprehensive solution for all your test automation needs
                  </Typography>
                  <Typography style={{ fontSize: '1rem', fontWeight: '600' }}>
                    Experience Worry-Free Test Automation from day one
                  </Typography>
                </Stack>
                <Stack style={{ width: '50%', padding: '2%' }}>
                  <img
                    alt=""
                    src={TestEnsure}
                    style={{
                      borderRadius: '2%',
                      boxShadow: '0 0 10px #919eab'
                    }}
                  />
                </Stack>
              </Stack>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card style={{ height: '100%' }}>
              <Stack style={{ padding: '10%' }}>
                <Stack style={{ flexWrap: 'wrap', alignContent: 'center', padding: '5%' }}>
                  <img alt="" src={AllProjectsIcon} style={{ width: '40%' }} />
                </Stack>
                <Typography style={{ fontSize: '1.2rem', fontWeight: '500' }}>Project Repository</Typography>
                <Typography style={{ textAlign: 'justify', paddingTop: '5%', fontSize: '0.7rem' }}>
                  Streamline and Centralize Your Automated Testing Workflow. Navigate effortlessly through your
                  projects, each hosting a suite of meticulously organized test cases. Initiate your first project today
                  and redefine your testing strategy!{' '}
                </Typography>
                <Stack direction="row" style={{ paddingTop: '5%', display: 'flex', justifyContent: 'space-around' }}>
                  {pageConfig?.create && currentUser?.role?.roleID !== USER_ROLES.ADMIN && !licenseExpired && (
                    <Button
                      variant="contained"
                      style={{ fontSize: 'xx-small' }}
                      size="small"
                      component={RouterLink}
                      to={getUrl(PATH_DASHBOARD.project.newProject)}
                      startIcon={<Icon icon={plusFill} />}
                    >
                      Create Project
                    </Button>
                  )}
                  {pageConfig?.view && currentUser?.role?.roleID !== USER_ROLES.ADMIN && (
                    <Button
                      variant="contained"
                      style={{ backgroundColor: '#DBEFE1', color: '#000000', fontSize: 'xx-small' }}
                      component={RouterLink}
                      to={getUrl(PATH_DASHBOARD.project.allProjects)}
                      startIcon={<img alt="" src={AllProjectsIcon} />}
                    >
                      View Projects
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <Card style={{ height: '100%' }}>
              <Stack direction="row" style={{ padding: '5%' }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Stack direction="column" style={{ paddingTop: '30%' }}>
                      <Stack style={{ alignItems: 'center' }}>
                        <img alt="" src={AllReleasesIcon} style={{ width: '50%' }} />
                      </Stack>
                      <Stack style={{ paddingTop: '10%' }}>
                        <Typography style={{ fontSize: '1.2rem', fontWeight: '600' }}>Latest Release</Typography>
                        <Stack direction="row">
                          <Typography style={{ fontSize: '0.7rem' }}>Project: </Typography>{' '}
                          <Typography style={{ fontSize: '0.7rem', fontWeight: '600' }}>Service Order</Typography>
                        </Stack>
                        <Stack direction="row">
                          <Typography style={{ fontSize: '0.7rem' }}>Release Name: </Typography>{' '}
                          <Typography style={{ fontSize: '0.7rem', fontWeight: '600' }}>Physical Progress</Typography>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={4} style={{ padding: '0%', paddingTop: '5%' }}>
                    <Stack style={{ paddingRight: '20%', paddingTop: '20%' }}>
                      {typeof window !== 'undefined' && CHART_DATA && chartOptions && (
                        <ReactApexChart
                          type="pie"
                          series={CHART_DATA}
                          options={chartOptions}
                          height={220}
                          width={220}
                        />
                      )}
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={4} style={{ padding: '0%', paddingTop: '6%' }}>
                    <Stack style={{ paddingLeft: '6%' }}>
                      {/* <Scrollbar> */}
                      <Stack spacing={3} sx={{ p: 3 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontSize: '0.8rem', fontWeight: '700', lineHeight: '1' }}
                          >
                            {getPercentage(legendData?.passed, legendData?.total)}% Completed
                            {executionDuration ? ` (${executionDuration})` : ''}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              ml: 1,
                              display: 'flex',
                              alignItems: 'center',
                              color: 'text.secondary',
                              fontSize: '0.7rem'
                            }}
                          >
                            {getRemaining(legendData?.passed, legendData?.total)} of {legendData?.total} remaining
                          </Typography>
                        </Box>
                        <Legend label="Passed" number={legendData?.passed} total={legendData?.total} color="#36AB51" />
                        <Legend label="Failed" number={legendData?.failed} total={legendData?.total} color="#F44B25" />
                        <Legend
                          label="Untested"
                          number={legendData?.untested}
                          total={legendData?.total}
                          color="#9A9B9C"
                        />
                        <Legend
                          label="Blocked"
                          number={legendData?.blocked}
                          total={legendData?.total}
                          color="#16ABC5"
                        />
                        <Legend
                          label="Skipped"
                          number={legendData?.skipped}
                          total={legendData?.total}
                          color="#FFAA00"
                        />
                      </Stack>
                      {/* </Scrollbar> */}
                    </Stack>
                  </Grid>
                </Grid>
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Page>
  );
}
