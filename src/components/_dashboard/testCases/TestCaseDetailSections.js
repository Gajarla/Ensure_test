import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';

// material
import { Card, Grid, Tab, Box, Divider } from '@mui/material';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { useDispatch, useSelector } from '../../../redux/store';
// import { TestCaseComments, TestCaseHistory, TestCaseDefects } from '.';
import TestCaseComments from './TestCaseComments';
import TestCaseHistory from './TestCaseHistory';
import TestCaseDefects from './TestCaseDefects';
import { getIndexedDBObject } from '../../../main';
import { IndexedDB, INDEXEDDB_KEYS } from '../../../Constants';
import { getSessionObj } from '../../../utils/jwt';
import { setPageConfig, setTestCasesConfig } from '../../../redux/slices/role';
// ----------------------------------------------------------------------

TestCaseDetailSections.propTypes = {
  posts: PropTypes.array,
  setOpenDetails: PropTypes.bool,
  testCase: PropTypes.string
};

// const TestCaseComments = () => <div>Comments test</div>;
// const TestCaseHistory = () => <div>History test</div>;
// const TestCaseDefects = () => <div>Defects test</div>;

export default function TestCaseDetailSections({ posts, setOpenDetails, testCase }) {
  const [value, setValue] = useState('1');
  const dispatch = useDispatch();
  const { roleConfig, testCasesConfig } = useSelector((state) => state.role);
  const isModule = getSessionObj(INDEXEDDB_KEYS.CURRENT_MODULE);

  const handleChangeTab = (event, newValue) => {
    setValue(newValue);
  };

  // console.log('isModule', isModule);
  // console.log('testCasesConfig:', testCasesConfig);
  // console.log('Card, Grid, Tab, Box, Divider', Card);
  // console.log('Card, Grid, Tab, Box, Divider', Grid);
  // console.log('Card, Grid, Tab, Box, Divider', Box);
  // console.log('Card, Grid, Tab, Box, Divider', Divider);
  // console.log('TabContext, TabList, TabPanel', TabContext);
  // console.log('TabContext, TabList, TabPanel', TabList);
  // console.log('TabContext, TabList, TabPanel', TabPanel);

  useEffect(() => {
    const fetchData = async () => {
      if (!testCasesConfig) {
        const localRelease = await getIndexedDBObject(IndexedDB.RELEASE, INDEXEDDB_KEYS.CURRENT_RELEASE);
        if (localRelease) {
          setPageConfig(dispatch, roleConfig?.releases);
          setTestCasesConfig(dispatch, roleConfig?.releaseTestCases);
        }
        const localTestRun = await getIndexedDBObject(IndexedDB.TESTRUN, INDEXEDDB_KEYS.CURRENT_TESTRUN);
        if (localTestRun) {
          setPageConfig(dispatch, roleConfig?.testRuns);
          setTestCasesConfig(dispatch, roleConfig?.testRunsTestCases);
        }
      }
    };

    fetchData();
  }, [dispatch, testCasesConfig]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={12}>
        <Card>
          <TabContext value={value}>
            <Box sx={{ px: 3, bgcolor: 'background.neutral' }}>
              <TabList onChange={handleChangeTab}>
                {(isModule || testCasesConfig?.comments) && <Tab disableRipple value="1" label="Comments" />}
                {(isModule || testCasesConfig?.runHistory) && <Tab disableRipple value="2" label="Run History" />}
                {(isModule || testCasesConfig?.changeLog) && <Tab disableRipple value="3" label="Change Log" />}
                {(isModule || testCasesConfig?.issues) && <Tab disableRipple value="4" label="Issues" />}
              </TabList>
            </Box>

            <Divider />
            {(isModule || testCasesConfig?.comments) && (
              <TabPanel value="1">
                <Box sx={{ p: 2 }}>
                  <TestCaseComments posts={posts} />
                </Box>
              </TabPanel>
            )}
            {(isModule || testCasesConfig?.runHistory) && (
              <TabPanel value="2">
                <Box sx={{ p: 2 }}>
                  <TestCaseHistory posts={posts} setOpenDetails={setOpenDetails} />
                </Box>
              </TabPanel>
            )}
            {(isModule || testCasesConfig?.changeLog) && (
              <TabPanel value="3">
                <Box sx={{ p: 3 }}>Change Log</Box>
              </TabPanel>
            )}
            {(isModule || testCasesConfig?.issues) && (
              <TabPanel value="4">
                <Box sx={{ p: 3 }}>
                  <TestCaseDefects posts={posts} setOpenDetails={setOpenDetails} testCase={testCase} />
                </Box>
              </TabPanel>
            )}
          </TabContext>
        </Card>
      </Grid>
    </Grid>
  );
}
