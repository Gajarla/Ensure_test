import * as Yup from 'yup';
import PropTypes from 'prop-types';
import { useSnackbar } from 'notistack';
import { Icon } from '@iconify/react';
import { useRef, useState } from 'react';
import copyFill from '@iconify/icons-eva/copy-fill';
import editFill from '@iconify/icons-eva/edit-fill';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useFormik } from 'formik';
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
  ListItemText,
  Stack,
  TextField,
  Typography
} from '@mui/material';
// routes
import { PATH_DASHBOARD } from '../../../../routes/paths';
import { getCloneRelease } from '../../../../redux/slices/release';
import { useDispatch, useSelector } from '../../../../redux/store';
import API from 'src/services';
import axios from 'axios';
import { getSessionObj } from '../../../../utils/jwt';

// ----------------------------------------------------------------------

ProjectMoreMenu.propTypes = {
  pageConfig: PropTypes.object,
  onDelete: PropTypes.func,
  onClickRun: PropTypes.func,
  releaseId: PropTypes.string
};

const cogs = {
  width: 1920,
  height: 1792,
  body: '<path fill="currentColor" d="M896 896q0-106-75-181t-181-75t-181 75t-75 181t75 181t181 75t181-75t75-181m768 512q0-52-38-90t-90-38t-90 38t-38 90q0 53 37.5 90.5t90.5 37.5t90.5-37.5t37.5-90.5m0-1024q0-52-38-90t-90-38t-90 38t-38 90q0 53 37.5 90.5T1536 512t90.5-37.5T1664 384m-384 421v185q0 10-7 19.5t-16 10.5l-155 24q-11 35-32 76q34 48 90 115q7 11 7 20q0 12-7 19q-23 30-82.5 89.5T999 1423q-11 0-21-7l-115-90q-37 19-77 31q-11 108-23 155q-7 24-30 24H547q-11 0-20-7.5t-10-17.5l-23-153q-34-10-75-31l-118 89q-7 7-20 7q-11 0-21-8q-144-133-144-160q0-9 7-19q10-14 41-53t47-61q-23-44-35-82l-152-24q-10-1-17-9.5T0 987V802q0-10 7-19.5T23 772l155-24q11-35 32-76q-34-48-90-115q-7-11-7-20q0-12 7-20q22-30 82-89t79-59q11 0 21 7l115 90q34-18 77-32q11-108 23-154q7-24 30-24h186q11 0 20 7.5t10 17.5l23 153q34 10 75 31l118-89q8-7 20-7q11 0 21 8q144 133 144 160q0 8-7 19q-12 16-42 54t-45 60q23 48 34 82l152 23q10 2 17 10.5t7 19.5m640 533v140q0 16-149 31q-12 27-30 52q51 113 51 138q0 4-4 7q-122 71-124 71q-8 0-46-47t-52-68q-20 2-30 2t-30-2q-14 21-52 68t-46 47q-2 0-124-71q-4-3-4-7q0-25 51-138q-18-25-30-52q-149-15-149-31v-140q0-16 149-31q13-29 30-52q-51-113-51-138q0-4 4-7q4-2 35-20t59-34t30-16q8 0 46 46.5t52 67.5q20-2 30-2t30 2q51-71 92-112l6-2q4 0 124 70q4 3 4 7q0 25-51 138q17 23 30 52q149 15 149 31m0-1024v140q0 16-149 31q-12 27-30 52q51 113 51 138q0 4-4 7q-122 71-124 71q-8 0-46-47t-52-68q-20 2-30 2t-30-2q-14 21-52 68t-46 47q-2 0-124-71q-4-3-4-7q0-25 51-138q-18-25-30-52q-149-15-149-31V314q0-16 149-31q13-29 30-52q-51-113-51-138q0-4 4-7q4-2 35-20t59-34t30-16q8 0 46 46.5t52 67.5q20-2 30-2t30 2q51-71 92-112l6-2q4 0 124 70q4 3 4 7q0 25-51 138q17 23 30 52q149 15 149 31" />'
};

export default function ProjectMoreMenu({ pageConfig, onDelete, onClickRun, releaseId }) {
  const ref = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { appendUrl } = useSelector((state) => state.user);
  const { releaseList } = useSelector((state) => state.release);
  const [isOpen, setIsOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [option, setOption] = useState();
  const [releaseExists, setReleaseExists] = useState(false);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const navigateToLink = (url) => {
    navigate(getUrl(url));
  };

  const handleClickOpen = () => {
    setIsOpen(false);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const NewReleaseSchema = Yup.object().shape({
    name: Yup.string().required('Release Name is required')
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: ''
    },
    validationSchema: NewReleaseSchema,
    onSubmit: async (values, { setSubmitting, resetForm, setErrors }) => {
      try {
        setSubmitting(false);

        resetForm();
        enqueueSnackbar('Release clone is success', { variant: 'success' });
        navigateToLink(PATH_DASHBOARD.release.allReleases);
      } catch (error) {
        setSubmitting(false);
        setErrors(error);
      }
    }
  });

  const { values, errors, touched, setFieldValue, getFieldProps } = formik;

  const handleReleaseNameChange = async (event) => {
    const { value } = event.target;
    setFieldValue('name', value);
    const release = releaseList?.find((release) => release.releaseName.toLowerCase() === value.toLowerCase());
    if (release) {
      setReleaseExists(true);
    } else setReleaseExists(false);
  };

  const handleAgreeClick = async () => {
    if (option === 'run') {
      // // Checking for license validity while creating test runs
      // if (process.env.REACT_APP_SLICENSE_APPLICABLE === 'true') {
      //   const response = await axios.post(
      //     API.auth.validateLicense,
      //     {},
      //     {
      //       headers: {
      //         Authorization: `Bearer ${getSessionObj('accessToken')}`
      //       }
      //     }
      //   );
      //   if (response?.data?.status === 200) onClickRun();
      //   if (response?.data?.status === 403) {
      //     let message = response.data.errorMessage;
      //     enqueueSnackbar(message, { variant: 'error' });
      //   }
      // } else
      onClickRun();
    } else if (option === 'clone') {
      const releaseName = values.name;
      if (!releaseExists) {
        getCloneRelease(dispatch, releaseId, releaseName);
        enqueueSnackbar('Release clone is success', { variant: 'success' });
      }
    } else if (option === 'delete') {
      onDelete();
    }
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
        {pageConfig?.run && (
          <MenuItem
            sx={{ color: 'text.secondary' }}
            onClick={() => {
              setOption('run');
              handleClickOpen();
            }}
          >
            <ListItemIcon>
              {/* <Box component={CustomSvgIcon} sx={{ width: 16, height: 16, ml: 1 }} /> */}
              <Icon icon={cogs} width={24} height={24} />
              {/* <CustomSvgIcon /> */}
            </ListItemIcon>
            <ListItemText primary="Run" primaryTypographyProps={{ variant: 'body2' }} />
          </MenuItem>
        )}

        {pageConfig?.edit && (
          <MenuItem
            sx={{ color: 'text.secondary' }}
            component={RouterLink}
            to={getUrl(`${PATH_DASHBOARD.release.root}/${releaseId}/edit`)}
          >
            <ListItemIcon>
              <Icon icon={editFill} width={24} height={24} />
            </ListItemIcon>
            <ListItemText primary="Edit" primaryTypographyProps={{ variant: 'body2' }} />
          </MenuItem>
        )}

        {pageConfig?.clone && (
          <MenuItem
            sx={{ color: 'text.secondary' }}
            onClick={() => {
              setOption('clone');
              handleClickOpen();
            }}
          >
            <ListItemIcon>
              <Icon icon={copyFill} width={24} height={24} />
            </ListItemIcon>
            <ListItemText primary="Clone Release" primaryTypographyProps={{ variant: 'body2' }} />
          </MenuItem>
        )}

        {pageConfig?.delete && (
          <MenuItem
            sx={{ color: 'error.main' }}
            onClick={() => {
              setOption('delete');
              handleClickOpen();
            }}
          >
            <ListItemIcon>
              <Icon icon={trash2Outline} width={24} height={24} />
            </ListItemIcon>
            <ListItemText primary="Delete" primaryTypographyProps={{ variant: 'body2' }} />
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {option === 'run' && <Typography align="center">Release Info</Typography>}
          {option === 'clone' && <Typography align="center">Clone Release</Typography>}
          {option === 'delete' && <Typography align="center">Are you sure you want to delete Release?</Typography>}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {releaseExists && (
              <>
                <br />
                Release exists with this name
                <br />
              </>
            )}
            <br />
            {option === 'run' && <Typography align="center">Do you want to Run Release?</Typography>}
            {option === 'clone' && (
              <Stack>
                <TextField
                  fullWidth
                  label="Release Name"
                  size="small"
                  value={values.name}
                  {...getFieldProps('name')}
                  onChange={handleReleaseNameChange}
                  error={Boolean(touched.name && errors.name) || releaseExists}
                  helperText={touched.name && errors.name}
                />
              </Stack>
            )}
            {option === 'delete' && <Typography align="center">This will delete Release</Typography>}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{option === 'clone' ? 'Cancel' : 'Disagree'}</Button>
          <Button
            onClick={() => {
              handleClose();
              handleAgreeClick();
              // onDelete();
            }}
            autoFocus
            disabled={(option === 'clone' && values.name?.length === 0) || releaseExists}
          >
            {option === 'clone' ? 'Save' : 'Agree'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
