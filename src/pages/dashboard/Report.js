import { useEffect, useState, useRef } from 'react';
import { Form, FormikProvider, useFormik } from 'formik';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import {
  Autocomplete,
  Button,
  Card,
  Chip,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography,
  FormControlLabel,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import axios from 'axios';
import { Page } from '@react-pdf/renderer';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { exportRelasesWithTestCases } from '../../redux/slices/common';
import SpinnerOverlay from '../../components/SpinnerOverlay';
import { useSelector } from '../../redux/store';
import { getIDBCurrentUser, getIDBCurrentProject } from '../../main';
import API from '../../services';
import { getSessionObj } from '../../utils/jwt';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import { PATH_DASHBOARD } from '../../routes/paths';
import useSettings from '../../hooks/useSettings';

import { findVal } from '../../utils/objRecursiveSearch';

export default function Report() {
  let releaseListIds = [];
  const releaseNamesFromAPI = [];
  const releaseTestRunDetails = useRef([]);
  const releaseSummaryObjects = useRef([]);
  const [releaseNames, setReleaseNames] = useState([]);
  const [sendingType, setSendingType] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [releasesExists, setReleasesExists] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpinnerLoading, setIsSpinnerLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const [message, setMessage] = useState('No releases found');
  const { licenseExpired } = useSelector((state) => state.license);

  const [pdfUrl, setPdfUrl] = useState('');
  pdfMake.addVirtualFileSystem(pdfFonts);

  const { appendUrl } = useSelector((state) => state.user);
  const { themeStretch } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    fetchReleases();
  }, []);

  useEffect(() => {
    setDialogOpen(!releasesExists);
  }, [releasesExists]);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      releaseList: [],
      testRun: true,
      testCases: false,
      testCaseSteps: false,
      testCaseStepStatus: false
    },
    validateOnChange: true,
    onSubmit: async (values, { setSubmitting, resetForm, setErrors }) => {
      try {
        setSubmitting(false);
      } catch (error) {
        setSubmitting(false);
        setErrors(error);
      }
    }
  });

  const { values, handleSubmit, setFieldValue } = formik;

  useEffect(() => {
    if (values.releaseList.length === 0) {
      // Set default values aginst below formik fields when releaseList becomes empty
      setFieldValue('testCases', false);
      setFieldValue('testCaseSteps', false);
      setFieldValue('testCaseStepStatus', false);
    }
  }, [values.releaseList]);

  useEffect(() => {
    generatePDF(true); // This runs whenever toggle values change against buttons
  }, [values.testCases, values.testCaseSteps, values.testCaseStepStatus]);

  const fetchReleases = async () => {
    const projectSerialized = await getIDBCurrentProject();
    try {
      const releases = await axios({
        method: 'get',
        url: `${API.releases.getReleaseByPID2(projectSerialized?._id)}`,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
      if (releases?.status === 200 && Array.isArray(releases.data?.response)) {
        if (releases.data?.response?.length > 0) {
          releases.data?.response?.forEach((release) => {
            // Pushing only the releases which has a test run against them
            if (release.testRunVersion) {
              releaseListIds.push(release._id);
            }
          });
          if (releaseListIds.length !== 0) {
            const releaseTestRuns = await axios({
              method: 'get',
              url: `${API.releases.getExecutingReleasesData(releaseListIds, false)}`,
              headers: {
                Authorization: `Bearer ${getSessionObj('accessToken')}`
              }
            });
            releaseTestRunDetails.current = releaseTestRuns?.data?.data;
            releaseListIds = [];
            releaseTestRunDetails?.current.forEach((release) => {
              // Pushing only the releases which have completed status against automated test runs
              // and manual status against manual test runs
              if (
                release.runningStatus.toLowerCase() === 'completed' ||
                release.runningStatus.toLowerCase() === 'manual'
              ) {
                releaseListIds.push(release._id);
                releaseNamesFromAPI.push(release.releaseName);
              }
            });
            if (releaseNamesFromAPI.length !== 0) setReleaseNames(releaseNamesFromAPI);
          }
        } else {
          // Setting state variable only after getting the getReleaseByPID API response
          // to open dialog box when there are no releases
          setReleasesExists(false);
          setMessage('No releases found');
        }
      } else {
        setMessage('Failed to Load');
      }
    } catch (error) {
      setMessage('Failed to Load');
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTestCases = async (releases) => {
    let jobIds = [];
    const testCasesData = [];
    try {
      const commonReleases = releases;
      commonReleases.forEach((release) => {
        if (Array.isArray(release.latestJobIds)) jobIds = [...jobIds, ...release.latestJobIds];
        else jobIds.push(release.latestJobIds);
      });
      if (jobIds.length !== 0) {
        const testRunDetails = await axios({
          method: 'get',
          url: `${API.releases.getMultiTestRunStatus(jobIds)}`,
          headers: {
            Authorization: `Bearer ${getSessionObj('accessToken')}`
          }
        });
        const allTestCases = testRunDetails?.data;
        const mergedReleases = mergeByReleaseName(allTestCases);
        mergedReleases.forEach((release) => {
          let obj = {};
          const finalObj = [];
          const { testNodes } = release;
          testNodes.forEach((testNode) => {
            const { testCaseSteps, testStepStatuses } = testNode;
            const steps = [];
            const stepStatuses = [];
            const stepNum = [];
            let k = 0;
            testCaseSteps.forEach((testCaseStep) => {
              const step = findVal(testCaseStep, 'testStepDescription');
              if (step !== undefined) {
                steps.push(step);
                k += 1;
                stepNum.push(k);
                const stepStatus = testStepStatuses.find((status) => status._id === testCaseStep._id);
                // If test case is untested, test case steps will not have any status against them
                // In that case, manually setting untested status against test case steps

                // ?? is the nullish coalescing operator
                // it only kicks in if the left side is null or undefined
                stepStatuses.push(stepStatus?.status ?? 'UNTESTED');
              }
            });
            obj = {
              testCaseId: testNode.testCaseID,
              testCaseTitle: testNode.testCaseTitle,
              testCaseDescription: testNode.testCaseDescription,
              testCaseStatus: testNode.status,
              testCaseExecutionDuration: testNode.executionDuration,
              testCaseSteps: steps,
              testCaseStepStatus: stepStatuses,
              testCaseStepNumbers: stepNum
            };
            finalObj.push(obj);
          });
          testCasesData.push({ releaseName: release.releaseName, testCases: finalObj });
        });
        return testCasesData;
      }
    } catch (error) {
      console.log(error);
      return error;
    }
  };

  // Combine testNodes attribute, which comprises of testcase along with test case steps
  // on the basis of release name
  const mergeByReleaseName = (input) => {
    const merged = {};

    input.forEach(({ data }) => {
      const { releaseName, modules } = data;
      const module = Array.isArray(modules) && modules[1];

      if (module && Array.isArray(module.testNodes)) {
        if (!merged[releaseName]) {
          merged[releaseName] = [];
        }
        merged[releaseName].push(...module.testNodes);
      }
    });

    return Object.entries(merged).map(([releaseName, testNodes]) => ({
      releaseName,
      testNodes
    }));
  };

  const sendReportToEmail = async (reportType) => {
    setIsSpinnerLoading(true);
    setSendingType(reportType);
    const userOptionSelection = {
      testCases: values.testCases,
      testCaseSteps: values.testCaseSteps,
      testCaseStepStatus: values.testCaseStepStatus
    };
    const user = await getIDBCurrentUser();
    let fileNameExt;
    let base64Data;
    try {
      if (reportType === 'pdf') {
        base64Data = await new Promise((resolve, reject) => {
          pdfMake.createPdf(generatePDF(false)).getBase64((data) => {
            resolve(data);
          });
        });
        fileNameExt = 'TestResults.pdf';
      } else {
        base64Data = await blobToBase64(
          await exportRelasesWithTestCases(releaseSummaryObjects.current, 'mail', userOptionSelection)
        );
        fileNameExt = 'TestResults.xlsx';
      }
      const response = await axios({
        method: 'post',
        url: API.testRun.getAttachmentByEmail,
        data: JSON.stringify({
          to: user.email,
          subject: 'Your Recently Generated Report',
          text: 'Please find your Document attached.',
          userName: `${user.firstName} ${user.lastName}`,
          base64: base64Data,
          fileName: fileNameExt,
          doc: reportType
        }),
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.status === 200) enqueueSnackbar('Mail sent successfully', { variant: 'success' });
      else enqueueSnackbar('Mail sending failed', { variant: 'error' });
    } catch (error) {
      console.log('error', error);
    } finally {
      setSendingType(null);
      setIsSpinnerLoading(false);
    }
  };

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'PASSED':
        return 'green';
      case 'FAILED':
        return 'red';
      case 'SKIPPED':
        return 'orange';
      case 'IGNORED':
        return 'gray';
      case 'WARNING':
        return 'yellow';
      default:
        return 'black';
    }
  };

  const handleReleaseSelectionChange = async (selectedReleases) => {
    // const releaseSummaryObjectList = [];
    releaseSummaryObjects.current = [];
    const releaseSummaryData = [];
    // Filter releases based on selectedReleases array
    const filteredReleases = releaseTestRunDetails.current.filter((release) =>
      selectedReleases.includes(release.releaseName)
    );
    setIsSpinnerLoading(true);
    const testCasesDetails = await fetchTestCases(filteredReleases);
    setIsSpinnerLoading(false);

    filteredReleases.forEach((release) => {
      const obj = {
        releaseName: release.releaseName,
        executionStart: moment(release.executionStart).format('MMMM Do YYYY, h:mm:ss A') || '',
        executionEnd: moment(release.executionEnd).format('MMMM Do YYYY, h:mm:ss A') || '',
        executionDuration: release.executionDuration,
        total: release.total,
        passed: release.passed,
        failed: release.failed,
        skipped: release.skipped,
        untested: release.untested,
        ignored: release?.ignored || 0,
        warning: release?.warning || 0,
        blocked: release?.blocked || 0
      };
      releaseSummaryObjects.current.push(obj);
      // releaseSummaryObjectList.push(obj);
      releaseSummaryData.push(obj);
    });
    // Pushing testCases data into releaseSummaryObjects so that they are
    // made visible in the pdf preivew
    if (testCasesDetails) {
      releaseSummaryData.forEach((release) => {
        const match = testCasesDetails.find((testCase) => testCase.releaseName === release.releaseName);
        if (match) {
          release.testCases = match.testCases;
        }
      });
      releaseSummaryObjects.current = [];
      releaseSummaryObjects.current.push(...releaseSummaryData);
      generatePDF(true);
      // releaseSummaryObjectList.length = 0;
      // releaseSummaryObjectList.push(...releaseSummaryData);
      // generatePDF(true, releaseSummaryObjectList);
    }
  };

  // Function used in generatePDF function to merge test case steps against a test case
  const buildTestCaseRowsWithMerge = (testCases, values) => {
    const rows = [];

    const headerRow = [];
    if (values.testCases) {
      headerRow.push('Test Case ID', 'Title', 'Description', 'Status', 'Execution Duration');
    }
    if (values.testCaseSteps) headerRow.push('Step No', 'Test Step Description');
    if (values.testCaseStepStatus) headerRow.push('Test Step Status');

    rows.push(headerRow);

    testCases.forEach((tc) => {
      const stepNos = tc.testCaseStepNumbers || [];
      const stepDescs = tc.testCaseSteps || [];
      const stepStatuses = tc.testCaseStepStatus || [];

      const stepsCount = Math.max(stepNos.length, stepDescs.length, stepStatuses.length, 1);
      const rowSpan = stepsCount;

      for (let i = 0; i < stepsCount; i += 1) {
        const isFirstRow = i === 0;
        const row = [];

        // Only push test case columns if testCases toggle is on
        if (values.testCases) {
          if (isFirstRow) {
            row.push(
              { text: tc.testCaseId || '', rowSpan },
              { text: tc.testCaseTitle || '', rowSpan },
              { text: tc.testCaseDescription || '', rowSpan },
              { text: tc.testCaseStatus || '', rowSpan, color: getStatusColor(tc.testCaseStatus), bold: true },
              { text: tc.testCaseExecutionDuration || '', rowSpan }
            );
          } else {
            row.push('', '', '', '', '');
          }
        }

        // Conditionally push step data
        if (values.testCaseSteps) {
          row.push(stepNos[i] || '', stepDescs[i] || '');
        }

        if (values.testCaseStepStatus) {
          row.push({
            text: stepStatuses[i] || '',
            color: getStatusColor(stepStatuses[i]),
            italics: true
          });
        }

        rows.push(row);
      }
    });

    return rows;
  };

  // Parameter to the function is provided simply to avoid
  // re-render of the screen when clicking on "Email PDF Report" button
  const generatePDF = (regenerateBlob) => {
    const docContent = [];
    releaseSummaryObjects.current.forEach((release, index) => {
      if (index !== 0) {
        docContent.push({ text: '', pageBreak: 'before' });
      }

      docContent.push(
        { text: 'Release Summary', style: 'header' },
        {
          table: {
            widths: ['*', '*'],
            body: [
              ['Release Name', release.releaseName],
              ['Execution Start', release.executionStart],
              ['Execution End', release.executionEnd],
              ['Execution Duration', release.executionDuration],
              ['Total', release.total],
              ['Passed', release.passed],
              ['Failed', release.failed],
              ['Skipped', release.skipped],
              ['Ignored', release.ignored],
              ['Warning', release.warning],
              ['Untested', release.untested],
              ['Blocked', release.blocked]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 20]
        }
      );

      // Include Test Cases Summary only if testCases is enabled
      if (values.testCases) {
        const columnCount =
          (values.testCases ? 5 : 0) + (values.testCaseSteps ? 2 : 0) + (values.testCaseStepStatus ? 1 : 0);

        docContent.push(
          { text: 'Test Cases Summary', style: 'subheader' },
          {
            table: {
              headerRows: 1,
              widths: Array(columnCount).fill('auto'),
              body: buildTestCaseRowsWithMerge(release.testCases, values)
            },
            layout: 'lightHorizontalLines'
          }
        );
      }
    });

    const docDefinition = {
      pageOrientation: 'landscape',
      content: docContent,
      styles: {
        header: {
          fontSize: 20,
          bold: true,
          marginBottom: 10
        },
        subheader: {
          fontSize: 14,
          bold: true,
          margin: [0, 10, 0, 5]
        }
      }
    };

    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    if (regenerateBlob) {
      pdfDocGenerator.getBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      });
    }

    return docDefinition;
  };

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading="Report"
          links={[{ name: 'Releases', href: getUrl(PATH_DASHBOARD.release.allReleases) }, { name: 'Report' }]}
          info="Generate a PDF Report that will be sent through email, which conatins Release and Test Run Details."
        />
        <FormikProvider value={formik}>
          <Form noValidate autoComplete="off" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={12}>
                <Card sx={{ p: 3 }}>
                  <Stack spacing={3}>
                    <Stack spacing={2} sx={{ width: 1 }}>
                      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                        Select Releases
                      </Typography>
                      <Stack>
                        <Autocomplete
                          name="releases"
                          id="releases"
                          multiple
                          disabled={licenseExpired}
                          options={Array.isArray(releaseNames) ? releaseNames : []} // array of strings
                          loading={isLoading}
                          getOptionLabel={(option) => option} // since options are strings
                          isOptionEqualToValue={(option, value) => option === value} // compare strings directly
                          value={values.releaseList}
                          onChange={(event, newValue) => {
                            setFieldValue('releaseList', newValue); // stores selected string values
                            handleReleaseSelectionChange(newValue); // Call a custom function with the new selected values
                          }}
                          renderTags={(value, getTagProps) =>
                            value.map((releaseName, index) => (
                              <Chip key={releaseName} label={releaseName} {...getTagProps({ index })} />
                            ))
                          }
                          renderInput={(params) => <TextField {...params} label="Select Releases" />}
                          noOptionsText={isLoading ? '' : message}
                        />
                      </Stack>
                      {values.releaseList && values.releaseList.length > 0 && (
                        <>
                          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                            Select the below to include in the report
                          </Typography>
                          <Stack direction="row" spacing={3} alignItems="flex-start">
                            <Stack spacing={1} alignItems="flex-start">
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked
                                    disabled
                                    sx={{
                                      '& .MuiSwitch-thumb': {
                                        color: 'primary.main'
                                      },
                                      '& .MuiSwitch-track': {
                                        backgroundColor: 'primary.main',
                                        opacity: 1
                                      },
                                      '&.Mui-checked .MuiSwitch-thumb': {
                                        color: 'primary.main'
                                      },
                                      '&.Mui-checked .MuiSwitch-track': {
                                        backgroundColor: 'primary.main',
                                        opacity: 1
                                      },
                                      '&.Mui-disabled.Mui-checked .MuiSwitch-track': {
                                        backgroundColor: 'primary.main',
                                        opacity: 1
                                      }
                                    }}
                                  />
                                }
                                label={
                                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                    Test Run
                                  </Typography>
                                }
                                sx={{ mx: 0 }}
                              />
                            </Stack>

                            <Stack spacing={2} direction="row">
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={values.testCases}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      setFieldValue('testCases', isChecked);
                                      if (!isChecked) {
                                        setFieldValue('testCaseSteps', false);
                                        setFieldValue('testCaseStepStatus', false);
                                      }
                                    }}
                                  />
                                }
                                label={
                                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                    Test Cases
                                  </Typography>
                                }
                                sx={{ mx: 0 }}
                              />
                              <FormControlLabel
                                control={
                                  <Switch
                                    disabled={!values.testCases}
                                    checked={values.testCaseSteps}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      setFieldValue('testCaseSteps', isChecked);
                                      if (!isChecked) {
                                        // Automatically turn off "status" if "testCaseSteps" is turned off
                                        setFieldValue('testCaseStepStatus', false);
                                      }
                                    }}
                                  />
                                }
                                label={
                                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                    Test Case Steps
                                  </Typography>
                                }
                                sx={{ mx: 0 }}
                              />
                              <FormControlLabel
                                control={
                                  <Switch
                                    disabled={!values.testCaseSteps}
                                    checked={values.testCaseStepStatus}
                                    onChange={(e) => {
                                      setFieldValue('testCaseStepStatus', e.target.checked);
                                    }}
                                  />
                                }
                                label={
                                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                    Test Case Step Status
                                  </Typography>
                                }
                                sx={{ mx: 0 }}
                              />
                            </Stack>
                          </Stack>
                          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                            PDF Preview
                          </Typography>
                          <Stack>
                            <SpinnerOverlay loading={isSpinnerLoading} />
                            {pdfUrl && (
                              <iframe
                                title="PDF Preview"
                                src={`${pdfUrl}#zoom=100`}
                                width="100%"
                                height="600px"
                                style={{ border: '1px solid #ccc', marginTop: '20px' }}
                              />
                            )}
                          </Stack>
                          {/* {!licenseExpired && ( */}
                          <Stack direction="row" spacing={2}>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => sendReportToEmail('pdf')}
                              disabled={!!sendingType} // !! is a double NOT operator. It forces any value to become a boolean.
                            >
                              {sendingType === 'pdf' ? 'Sending...' : 'Email PDF Report'}
                            </Button>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => sendReportToEmail('excel')}
                              disabled={!!sendingType}
                            >
                              {sendingType === 'excel' ? 'Sending...' : 'Email Excel Report'}
                            </Button>
                          </Stack>
                          {/* )} */}
                        </>
                      )}
                    </Stack>
                  </Stack>
                </Card>
              </Grid>
            </Grid>
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
              <DialogTitle style={{ marginBottom: '16px' }}>No Releases against Project</DialogTitle>
              <DialogContent>
                <span role="img" aria-label="warning" style={{ color: 'red', fontWeight: 'bold' }}>
                  ⚠️
                </span>{' '}
                <span style={{ fontWeight: 'bold', color: 'red' }}>Please navigate back to Releases screen.</span>
              </DialogContent>

              <DialogActions>
                <Button
                  onClick={() => {
                    setDialogOpen(false);
                    setTimeout(() => {
                      navigate(PATH_DASHBOARD.release.allReleases);
                    }, 300); // Wait 300ms before navigating
                  }}
                  color="secondary"
                >
                  Ok
                </Button>
              </DialogActions>
            </Dialog>
          </Form>
        </FormikProvider>
      </Container>
    </Page>
  );
}
