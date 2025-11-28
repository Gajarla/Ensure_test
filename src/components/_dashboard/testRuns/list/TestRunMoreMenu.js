import PropTypes from 'prop-types';
import { Icon } from '@iconify/react';
import { useRef, useState } from 'react';
import editFill from '@iconify/icons-eva/edit-fill';
import activityFill from '@iconify/icons-eva/activity-fill';
import { Link as RouterLink } from 'react-router-dom';
import trash2Outline from '@iconify/icons-eva/trash-2-outline';
import moreVerticalFill from '@iconify/icons-eva/more-vertical-fill';
// material
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Menu,
  MenuItem,
  IconButton,
  ListItemIcon,
  ListItemText
} from '@mui/material';
// routes
import { PATH_DASHBOARD } from '../../../../routes/paths';
import { useSelector, useDispatch } from '../../../../redux/store';
import { setFetchReleaseData } from '../../../../redux/slices/release';

// ----------------------------------------------------------------------

TestRunMoreMenu.propTypes = {
  pageConfig: PropTypes.object,
  testRunId: PropTypes.string,
  jenkinsJobName: PropTypes.string,
  jenkinsJobID: PropTypes.string,
  getReRunJob: PropTypes.func,
  getStopJob: PropTypes.func,
  runningStatus: PropTypes.string
};

export default function TestRunMoreMenu({
  pageConfig,
  testRunId,
  jenkinsJobName,
  jenkinsJobID,
  getReRunJob,
  getStopJob,
  runningStatus
}) {
  const ref = useRef(null);
  const dispatch = useDispatch();
  const { appendUrl } = useSelector((state) => state.user);
  const [isOpen, setIsOpen] = useState(false);
  const [open, setOpen] = useState(false);
  // const [isOpenStop, setIsOpenStop] = useState(false);
  const [openStop, setOpenStop] = useState(false);

  const getUrl = (url) => {
    let newUrl = url;
    if (url.includes('testCases')) setFetchReleaseData(dispatch, true);
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const handleClickOpen = () => {
    setIsOpen(false);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleClickOpenStop = () => {
    setIsOpen(false);
    setOpenStop(true);
  };

  const handleCloseStop = () => {
    setOpenStop(false);
  };

  return (
    <>
      <IconButton ref={ref} onClick={() => setIsOpen(true)}>
        <Icon icon={moreVerticalFill} width={20} height={20} />
      </IconButton>

      <Menu
        open={isOpen}
        anchorEl={ref.current}
        onClose={() => setIsOpen(false)}
        PaperProps={{
          sx: { width: 200, maxWidth: '100%' }
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {pageConfig?.releaseDetails && (
          <MenuItem
            component={RouterLink}
            to={getUrl(`${PATH_DASHBOARD.testRuns.root}/testRuns/${testRunId}/testCases`)}
            sx={{ color: 'text.secondary' }}
          >
            <ListItemIcon>
              <Icon icon={editFill} width={24} height={24} />
            </ListItemIcon>
            <ListItemText primary="Release Details" primaryTypographyProps={{ variant: 'body2' }} />
          </MenuItem>
        )}
        {pageConfig?.reRun && jenkinsJobName && (runningStatus === 'Completed' || runningStatus === 'Aborted') && (
          <MenuItem
            sx={{ color: 'text.secondary' }}
            onClick={() => {
              handleClickOpen();
            }}
          >
            <ListItemIcon>
              <Icon icon={activityFill} width={24} height={24} />
            </ListItemIcon>
            <ListItemText primary="Re Run" primaryTypographyProps={{ variant: 'body2' }} />
          </MenuItem>
        )}

        {pageConfig?.stopRun &&
          (jenkinsJobName || (jenkinsJobID && jenkinsJobID !== 'TODO')) &&
          runningStatus &&
          runningStatus !== 'Completed' &&
          // runningStatus !== 'In Queue' &&
          runningStatus !== 'Aborted' && (
            <MenuItem
              sx={{ color: 'error.main' }}
              onClick={() => {
                handleClickOpenStop();
              }}
            >
              <ListItemIcon>
                <Icon icon={trash2Outline} width={24} height={24} />
              </ListItemIcon>
              <ListItemText primary="Stop Run" primaryTypographyProps={{ variant: 'body2' }} />
            </MenuItem>
          )}
      </Menu>

      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Are you sure you want to re run the Job?</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            <br />
            This will rerun the Job
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Disagree</Button>
          <Button
            onClick={() => {
              getReRunJob();
              handleClose();
            }}
            autoFocus
          >
            Agree
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openStop}
        onClose={handleCloseStop}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Are you sure you want to stop the Job?</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            <br />
            This will stop the Job
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStop}>Disagree</Button>
          <Button
            onClick={() => {
              getStopJob();
              handleCloseStop();
            }}
            autoFocus
          >
            Agree
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
