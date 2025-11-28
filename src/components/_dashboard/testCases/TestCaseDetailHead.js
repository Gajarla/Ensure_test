// material
import {
  Avatar,
  AvatarGroup,
  Grid,
  Stack,
  Typography,
  TextField,
  Button,
  Chip,
  Paper,
  Card,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress
} from '@mui/material';
import PropTypes from 'prop-types';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { useTheme, styled } from '@mui/material/styles';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { sample } from 'lodash';
import { useEffect, useState } from 'react';

import { ExpandMore } from '@mui/icons-material';
import Slider from 'react-slick';
import moment from 'moment/moment';
import { useDispatch, useSelector } from '../../../redux/store';
import { PATH_DASHBOARD } from '../../../routes/paths';
import { getTestCaseDetails } from '../../../redux/slices/testRun';

import Label from '../../Label';
import './screenShots.css';
import { openInNewTab } from '../../../utils/images';
import TestCaseScreenShotsUpload from './TestCaseScreenShotsUpload';
import { IndexedDB, INDEXEDDB_KEYS } from '../../../Constants';
import { getIndexedDBObject } from '../../../main';
import { setFetchReleaseData } from '../../../redux/slices/release';
import { setFetchModuleData } from '../../../redux/slices/module';
import { getSessionObj } from '../../../utils/jwt';
import { setPageConfig, setTestCasesConfig } from '../../../redux/slices/role';
import { STATUS_CODES as STATUS } from '../../../Constants';

// ----------------------------------------------------------------------

const style = {
  p: 1,
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  bgcolor: '#edeff1',
  '& > *': { m: '3px !important' },
  minHeight: '50px'
};

const RowStyle = styled('div')({
  display: 'flex',
  justifyContent: 'space-between'
});

const STATUS_CODES = STATUS;

SampleNextArrow.propTypes = {
  className: PropTypes.object,
  style: PropTypes.object,
  onClick: PropTypes.object
};

function SampleNextArrow(props) {
  const { className, style, onClick } = props;
  return (
    /* eslint-disable */
    <div className={className} style={{ ...style, display: 'block', background: 'grey' }} onClick={onClick} />
    /* eslint-enable */
  );
}

SamplePrevArrow.propTypes = {
  className: PropTypes.object,
  style: PropTypes.object,
  onClick: PropTypes.object
};

function SamplePrevArrow(props) {
  const { className, style, onClick } = props;
  /* eslint-disable */
  return <div className={className} style={{ ...style, display: 'block', background: 'grey' }} onClick={onClick} />;
  /* eslint-enable */
}

const settings = {
  dots: false,
  autoplay: false,
  infinite: true,
  speed: 500,
  slidesToShow: 1,
  slidesToScroll: 1,
  appendDots: (dots) => <ul>{dots}</ul>,
  nextArrow: <SampleNextArrow />,
  prevArrow: <SamplePrevArrow />
};

// ----------------------------------------------------------------------

TestCaseDetailHead.propTypes = {
  testCase: PropTypes.object,
  testRunId: PropTypes.string,
  moduleId: PropTypes.string,
  setSelectedTestCase: PropTypes.func,
  getTestCaseResults: PropTypes.func,
  getTestStepResults: PropTypes.func
};

export default function TestCaseDetailHead({
  testCase,
  testRunId,
  moduleId,
  setSelectedTestCase,
  getTestCaseResults,
  getTestStepResults,
  setDefaultStepStatus
}) {
  const { pathname } = useLocation();
  const dispatch = useDispatch();
  const isTestCaseDetails = pathname.includes('testCaseDetails');
  // const { rows } = useSelector((state) => state.testRun);
  const { appendUrl } = useSelector((state) => state.user);
  const { currentModule } = useSelector((state) => state.module);
  const testCaseResults = useSelector((state) => state.testRun.testCaseEvidences);
  const testCaseDetails = useSelector((state) => state.testRun.testCaseDetails);
  const { roleConfig, pageConfig, testCasesConfig } = useSelector((state) => state.role);
  const [caseEvidencesFetched, setCaseEvidencesFetched] = useState(false);
  const evidencesFetched = useSelector((state) => state.testRun.testCaseEvidencesFetched);
  const currentFunction = useSelector((state) => state.testRun.currentFunction);
  const testCaseEvidencesFetched = useSelector((state) => state.testRun.testCaseEvidencesFetched);
  const testStepResults = useSelector((state) => state.testRun.testStepEvidences);
  const isModule = pathname.includes('module') || currentFunction.includes('module') || currentModule;
  const [localRelease, setLocalRelease] = useState();
  const [localTestRun, setLocalTestRun] = useState();
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const [testCaseStatus, setTestCaseStatus] = useState();

  const handleClickOpen = () => {
    setOpen(true);
  };

  useEffect(() => {
    setCaseEvidencesFetched(evidencesFetched);
  }, [evidencesFetched]);

  useEffect(() => {
    const intialize = async () => {
      if (url.length === 0) {
        const localModule =
          (await getIndexedDBObject(IndexedDB.MODULE, INDEXEDDB_KEYS.CURRENT_MODULE)) ||
          JSON.parse(getSessionObj(INDEXEDDB_KEYS.CURRENT_MODULE));
        if (localModule) {
          setUrl(`${PATH_DASHBOARD.testCase.testCasesByModule}/module/${localModule._id}`);
          if (!pageConfig) {
            setPageConfig(dispatch, roleConfig?.projectModules);
            setTestCasesConfig(dispatch, null);
          }
        }
        const localRelease =
          (await getIndexedDBObject(IndexedDB.RELEASE, INDEXEDDB_KEYS.CURRENT_RELEASE)) ||
          JSON.parse(getSessionObj(INDEXEDDB_KEYS.CURRENT_RELEASE));
        if (localRelease) {
          setLocalRelease(localRelease);
          setUrl(`${PATH_DASHBOARD.release.root}/release/${localRelease._id}/testCases`);
          if (!pageConfig) {
            setPageConfig(dispatch, roleConfig?.releases);
            setTestCasesConfig(dispatch, roleConfig?.releaseTestCases);
          }
        }
        const localTestRun =
          (await getIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_TESTRUN)) ||
          JSON.parse(getSessionObj(INDEXEDDB_KEYS.CURRENT_TESTRUN));
        if (localTestRun) {
          setLocalTestRun(localTestRun);
          setUrl(`${PATH_DASHBOARD.testRuns.root}/testRuns/${localTestRun._id}/testCases`);
          if (!pageConfig) {
            setPageConfig(dispatch, roleConfig?.testRuns);
            setTestCasesConfig(dispatch, roleConfig?.testRunsTestCases);
          }
        }
      }
    };
    intialize();
  }, [url, roleConfig]);

  useEffect(() => {
    setTestCaseStatus(testCaseDetails?.status);
  }, [testCaseDetails?.status]);

  useEffect(() => {
    getTestCaseResults(testCase?.testCaseResultsFile || testCaseDetails?.testCaseResultsFile);
  }, [getTestCaseResults, testCase, testCaseDetails]);

  const handleChangeStatus = (event) => {
    const status = event.target.value;
    const updatedTestCaseDetails = { ...testCaseDetails, selectedTestCaseStatus: status };
    dispatch(getTestCaseDetails(updatedTestCaseDetails));
  };

  return (
    <>
      <Grid container spacing={3}>
        <Grid item xs={12} md={12}>
          <Stack direction="row" alignItems="center">
            <Button
              size="small"
              variant="outlined"
              color="primary"
              component={RouterLink}
              to={getUrl(`${PATH_DASHBOARD.testCase.testcaseDetails}/${testCase?._id}`)}
            >
              {testCase?.testCaseID}
            </Button>
            <Stack
              direction="row"
              spacing={1}
              justifyContent="flex-start"
              flexGrow={1}
              sx={{
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis'
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  color: 'text?.primary',
                  paddingLeft: '1rem',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis'
                }}
              >
                {testCase?.testCaseTitle}
              </Typography>
            </Stack>
            {isTestCaseDetails && (
              <Stack direction="row" alignItems="center">
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  component={RouterLink}
                  to={getUrl(url)}
                  onClick={() => {
                    setFetchReleaseData(dispatch, true);
                    setFetchModuleData(dispatch, true);
                  }}
                >
                  Back
                </Button>
              </Stack>
            )}
          </Stack>
        </Grid>
        <Grid item xs={12} md={12}>
          <Card sx={{ p: 3, bgcolor: '#fff', borderRadius: '5px' }}>
            <Stack spacing={2}>
              <RowStyle>
                <Stack direction="row" alignItems="center">
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                    Priority :
                  </Typography>
                  <Box
                    sx={{
                      mr: 1,
                      ml: 1,
                      width: 14,
                      height: 14,
                      borderRadius: 0.5,
                      bgcolor: 'error.main'
                    }}
                  />
                  <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', color: 'text?.primary' }}>
                    {/* testCase?.priority */}
                    {sample(['P1', 'P2', 'P3'])}
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center">
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                    Last Updated : <span>&nbsp;</span>
                  </Typography>
                  <Typography variant="subtitle2" sx={{ color: 'text?.primary' }}>
                    {isModule
                      ? moment(testCase?.updatedAt || testCase?.createdAt).format('MMM DD yyyy, hh:mm a')
                      : moment(
                          // testCase?.executionEnd || testCaseDetails?.dateStatusLastUpdated || testCase?.createdAt
                          (testCase?.executionEnd > testCaseDetails?.dateStatusLastUpdated && testCase?.executionEnd) ||
                            (testCaseDetails?.dateStatusLastUpdated > testCase?.executionEnd &&
                              testCaseDetails?.dateStatusLastUpdated) ||
                            testCase?.createdAt
                        ).format('MMM DD yyyy, hh:mm a')}
                  </Typography>
                </Stack>
              </RowStyle>
              <RowStyle>
                <Grid item xs={12} md={12}>
                  <Stack spacing={2} sx={{ width: 1 }}>
                    <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                      Tags
                    </Typography>
                  </Stack>
                  <Paper sx={style} key="tag">
                    {testCase?.tags?.map((tag, index) => (
                      <Chip label={tag} key={index} icon={<LocalOfferIcon />} />
                    ))}
                  </Paper>
                </Grid>
              </RowStyle>
              <RowStyle>
                <Grid item xs={12} md={12}>
                  <Stack spacing={2} sx={{ width: 1 }}>
                    <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                      Automated?
                    </Typography>
                  </Stack>
                  <Paper sx={style}>{testCase?.automationStatus ? 'Yes' : 'No'}</Paper>
                </Grid>
              </RowStyle>
              {!isModule && (
                <RowStyle>
                  <Grid item xs={12} md={12}>
                    <Stack spacing={2} sx={{ width: 1 }}>
                      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                        STATUS
                      </Typography>
                    </Stack>
                    <Paper sx={style}>
                      {(localRelease || !roleConfig?.testRuns?.edit) && testCase?.status !== 'UNTESTED' && (
                        <Label
                          variant={isLight ? 'ghost' : 'filled'}
                          color={
                            (testCase?.status === 'FAILED' && 'error') ||
                            (testCase?.status === 'SKIPPED' && 'skipped') ||
                            'success'
                          }
                          sx={{ textTransform: 'capitalize', mx: 'auto' }}
                        >
                          {testCase?.status}
                        </Label>
                      )}
                      {(localRelease || !roleConfig?.testRuns?.edit) && testCase?.status === 'UNTESTED' && (
                        <Label
                          variant="ghost"
                          sx={{ textTransform: 'capitalize', mx: 'auto' }}
                          style={{
                            backgroundColor: '#9A9B9C'
                          }}
                        >
                          {testCase?.status}
                        </Label>
                      )}
                      {localTestRun && roleConfig?.testRuns?.edit && (
                        <TextField
                          select
                          value={testCaseStatus || testCase?.status}
                          SelectProps={{ native: true }}
                          onChange={(event) => {
                            handleClickOpen();
                            handleChangeStatus(event);
                            if (testCase?.testCaseResultsFile) {
                              getTestCaseResults(testCase?.testCaseResultsFile);
                            }
                          }}
                          sx={{
                            '& fieldset': { border: '0 !important' },
                            '& select': {
                              pl: 1,
                              py: 0.5,
                              pr: '20px !important',
                              typography: 'subtitle2'
                            },
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 0.75,
                              bgcolor: 'background.neutral'
                            },
                            '& .MuiNativeSelect-icon': {
                              top: 4,
                              right: 0,
                              width: 20,
                              height: 20
                            }
                          }}
                          name="status"
                          id="status"
                        >
                          {STATUS_CODES.map((option) => (
                            <option key={option.id} value={option.label}>
                              {option.label}
                            </option>
                          ))}
                        </TextField>
                      )}
                    </Paper>
                  </Grid>
                  {testCase?.executionDuration && (
                    <Grid item xs={12} md={12}>
                      <Stack spacing={2} sx={{ width: 1 }}>
                        <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                          Execution duration
                        </Typography>
                      </Stack>
                      <Paper sx={style}>{testCase?.executionDuration}</Paper>
                    </Grid>
                  )}
                </RowStyle>
              )}
            </Stack>
          </Card>
        </Grid>
        <Grid item xs={12} md={12}>
          <Stack spacing={2} sx={{ width: 1 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Description
            </Typography>
            <Typography variant="body2" sx={{ color: 'text?.primary' }}>
              {testCase?.testCaseDescription}
            </Typography>
            {/* Test Case Screenshot */}
            <Stack>
              <AvatarGroup
                max={4}
                sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}
                style={{ flexDirection: 'row' }}
              >
                {/* Searching test case id screenshot in testStepResults on the basis of testCaseDetails */}
                {testStepResults[testCaseDetails.testCaseId]?.map((image) => (
                  <Avatar key="image" alt="image" src={image} onClick={() => openInNewTab(image)} />
                ))}
              </AvatarGroup>
            </Stack>
          </Stack>
        </Grid>
        <Grid item xs={12} md={12}>
          {!isModule && testCasesConfig?.screenshots && !testCaseEvidencesFetched ? (
            <Box sx={{ display: 'flex' }}>{/* <CircularProgress /> */}</Box>
          ) : (
            !isModule &&
            !testCasesConfig?.screenshots &&
            testCaseResults?.length !== 0 && (
              <div>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />} aria-controls="panel1a-content" id="panel1a-header">
                    {!testCaseEvidencesFetched && (
                      <Box sx={{ display: 'flex' }}>
                        <CircularProgress>Test Case Execution Evidence</CircularProgress>
                      </Box>
                    )}
                    {testCaseEvidencesFetched && testCaseResults?.length > 0 && (
                      <Typography>Test Case Execution Evidence</Typography>
                    )}
                    {testCaseEvidencesFetched && testCaseResults?.length === 0 && ''}
                  </AccordionSummary>
                  <AccordionDetails>
                    {!caseEvidencesFetched && (
                      <Box sx={{ display: 'flex' }}>
                        <CircularProgress />
                      </Box>
                    )}
                    {caseEvidencesFetched && testCaseResults?.length > 0 && (
                      <Slider {...settings}>
                        {testCaseResults.map((image, index) => (
                          <Paper elevation={5} key={index}>
                            <img
                              src={image}
                              alt=" "
                              style={{ objectFit: 'contain', objectPosition: 'center', zIndex: 2, cursor: 'pointer' }}
                              onClick={() => openInNewTab(image)}
                              role="presentation"
                            />
                          </Paper>
                        ))}
                      </Slider>
                    )}
                    {caseEvidencesFetched && testCaseResults?.length === 0 && 'No evidence found'}
                  </AccordionDetails>
                </Accordion>
              </div>
            )
          )}
        </Grid>
      </Grid>

      <TestCaseScreenShotsUpload
        testRunId={testRunId}
        testCase={testCase}
        getTestCaseResults={getTestCaseResults}
        setSelectedTestCase={setSelectedTestCase}
        open={open}
        setOpen={setOpen}
      />
    </>
  );
}
