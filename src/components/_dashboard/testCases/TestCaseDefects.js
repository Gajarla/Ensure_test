// material
import { useTheme } from '@mui/material/styles';
import PropTypes from 'prop-types';
import {
  Avatar,
  Box,
  Button,
  Divider,
  Stack,
  TableRow,
  TableBody,
  TableCell,
  TableHead,
  Table,
  TableContainer,
  Tooltip
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
// import { sentenceCase } from 'change-case';
import { Link as RouterLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import arrowIosForwardFill from '@iconify/icons-eva/arrow-ios-forward-fill';
import Label from '../../Label';
import Scrollbar from '../../Scrollbar';

// ----------------------------------------------------------------------

TestCaseDefects.propTypes = {
  // setOpenDetails: PropTypes.bool
  testCase: PropTypes.string
};

export default function TestCaseDefects({ testCase }) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  // const navigate = useNavigate();
  const { defectList } = useSelector((state) => state.defect);
  const [dList, setDList] = useState(null);

  const handleOpenDefectLink = (url) => {
    window.open(url, '_blank');
  };

  const getDate = (dateString) => {
    const date = new Date(dateString);

    const options = {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    };
    return date.toLocaleDateString('en-ZA', options);
  };

  useEffect(() => {
    if (!dList) {
      const list = defectList?.filter(
        (defect) => defect.testCaseId === testCase?._id || defect.testNodeId === testCase?._id
      );
      setDList(list);
    }
  }, [defectList, testCase?._id, dList]);

  return (
    <Stack spacing={3} sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Scrollbar>
          <TableContainer sx={{ minWidth: 720 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 140 }}>Defect</TableCell>
                  <TableCell sx={{ minWidth: 280 }}>Title</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Status</TableCell>
                  <TableCell sx={{ minWidth: 80 }}>Raised By</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Raised On</TableCell>
                  {/* <TableCell sx={{ minWidth: 120 }}>Ran By</TableCell> */}
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {dList &&
                  dList?.length !== 0 &&
                  dList.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            sx={{ border: 'none', background: 'none', padding: 0 }}
                            onClick={() => handleOpenDefectLink(row?.defectUrl)}
                          >
                            {`${row?.defectTrack?.key}`}
                          </Button>
                        </Stack>
                      </TableCell>
                      <TableCell>{`${row?.summary}`}</TableCell>
                      <TableCell>
                        <Label
                          variant={isLight ? 'ghost' : 'filled'}
                          color={
                            (row.defectStatus === 'To Do' && 'info') ||
                            (row.defectStatus === 'In Progress' && 'warning') ||
                            'success'
                          }
                        >
                          {row.defectStatus}
                        </Label>
                      </TableCell>
                      <TableCell>
                        <Tooltip
                          title={`${row?.createdBy?.firstName} ${row?.createdBy?.lastName}`}
                          key={`${row?.createdBy?.firstName} ${row?.createdBy?.lastName}`}
                        >
                          <Avatar
                            key={row?.createdBy?.firstName}
                            alt={row?.createdBy?.firstName}
                            src={row?.createdBy?.avatarUrl || row?.createdBy?.firstName}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell>{getDate(row.createdAt)}</TableCell>
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
