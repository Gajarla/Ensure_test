// material
import { useTheme } from '@mui/material/styles';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Divider,
  Stack,
  TableRow,
  TableBody,
  TableCell,
  TableHead,
  Table,
  TableContainer
} from '@mui/material';
import { format } from 'date-fns';
import { useDispatch, useSelector } from 'react-redux';
import { sentenceCase } from 'change-case';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import arrowIosForwardFill from '@iconify/icons-eva/arrow-ios-forward-fill';
import Label from '../../Label';
import Scrollbar from '../../Scrollbar';
import { PATH_DASHBOARD } from '../../../routes/paths';
import { setFetchReleaseData } from '../../../redux/slices/release';

// ----------------------------------------------------------------------

TestCaseHistory.propTypes = {
  setOpenDetails: PropTypes.bool
};

export default function TestCaseHistory({ setOpenDetails }) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const isLight = theme.palette.mode === 'light';
  const navigate = useNavigate();
  const { appendUrl } = useSelector((state) => state.user);
  const { runHistory } = useSelector((state) => state.testRun.testCaseDetails);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const navigateToLink = (url) => {
    navigate(getUrl(url));
  };

  const handleReleaseClick = (releaseID) => {
    setOpenDetails(false);
    setFetchReleaseData(dispatch, true);
    navigateToLink(`${PATH_DASHBOARD.release.root}/release/${releaseID}/testCases`);
  };

  return (
    <Stack spacing={3} sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Scrollbar>
          <TableContainer sx={{ minWidth: 720 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 240 }}>Release</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>Result</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>Version</TableCell>
                  <TableCell sx={{ minWidth: 120 }}># Run</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>Ran On</TableCell>
                  {/* <TableCell sx={{ minWidth: 120 }}>Ran By</TableCell> */}
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {runHistory &&
                  runHistory.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            sx={{ border: 'none', background: 'none', padding: 0 }}
                            onClick={() => handleReleaseClick(row.releaseID)}
                          >
                            {`${row.releaseName}_${row.jenkinsJobID}`}
                          </Button>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Label
                          variant={isLight ? 'ghost' : 'filled'}
                          color={
                            (row.result.toUpperCase() === 'PASSED' && 'success') ||
                            (row.result.toUpperCase() === 'SKIPPED' && 'skipped') ||
                            'error'
                          }
                        >
                          {sentenceCase(row.result)}
                        </Label>
                      </TableCell>
                      <TableCell> V1 </TableCell>
                      <TableCell>{row.jenkinsJobID}</TableCell>
                      <TableCell>{format(new Date(row.dateStatusLastUpdated), 'MMM dd yyyy, hh:mm a')}</TableCell>
                      {/* <TableCell>
                      <Avatar alt={row.name} src={row.avatar} sx={{ width: '30px', height: '30px' }} />
                      </TableCell> */}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
        <Divider />
        <Box sx={{ p: 2, textAlign: 'right' }}>
          <Button
            to="#"
            size="small"
            color="inherit"
            component={RouterLink}
            endIcon={<Icon icon={arrowIosForwardFill} />}
          >
            View All
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
}
