import PropTypes from 'prop-types';
import { useDropzone } from 'react-dropzone';
// material
import { styled } from '@mui/material/styles';
import { Box, Typography, Button, Dialog, DialogContent, DialogContentText, DialogActions } from '@mui/material';
// utils
import { useState } from 'react';
//
import { UploadIllustration } from '../../assets';
// import axios from '../../utils/axios';
import axios from '../../utils/axiosInstance';
import url from '../../URL';
// ----------------------------------------------------------------------

const DropZoneStyle = styled('div')(({ theme }) => ({
  outline: 'none',
  overflow: 'hidden',
  textAlign: 'center',
  position: 'relative',
  alignItems: 'center',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: theme.spacing(0, 0),
  borderRadius: theme.shape.borderRadius,
  transition: theme.transitions.create('padding'),
  backgroundColor: '#edf6fc', // theme.palette.background.neutral,
  boxShadow: '0 0 1px #32749e',
  opacity: 0.85,
  '&:hover': {
    opacity: 1,
    cursor: 'pointer'
  },
  [theme.breakpoints.up('md')]: { textAlign: 'left', flexDirection: 'row' }
}));

const FilePreview = styled('div')(() => ({
  textAlign: 'center',
  textDecoration: 'underline',
  color: '#fff' // #0a66b7'
}));

const FileInput = styled('div')(() => ({
  display: 'flex'
}));

// ----------------------------------------------------------------------

UploadSingleFile.propTypes = {
  error: PropTypes.bool,
  isEdit: PropTypes.bool,
  fileType: PropTypes.string,
  moduleID: PropTypes.string,
  filePath: PropTypes.string,
  fileName: PropTypes.string,
  file: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  sx: PropTypes.object
};

UploadSingleFile.propTypes = {
  onDelete: PropTypes.func,
  onReplace: PropTypes.func
};

export default function UploadSingleFile({
  error,
  isEdit,
  onDelete,
  onReplace,
  fileType,
  filePath,
  fileName,
  moduleID,
  file,
  sx,
  ...other
}) {
  const [openDialog, setOpenDialog] = useState(false);
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    multiple: false,
    // ...other
    accept: other.accept,
    onDrop: other.onDrop
  });

  const getFile = async () => {
    let response = null;
    try {
      response = await axios.get(`${url.host}/api/projects/downloadModule/${moduleID}/${fileType}/`, {
        responseType: 'blob'
      });
      if (response) {
        const blob = new Blob([response.data]);
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filePath;
        link.click();
      }
    } catch (err) {
      console.log(response.data);
    }
  };

  const browseFile = (event) => {
    event.stopPropagation();
    onReplace();
  };

  const deleteFile = (event) => {
    event.stopPropagation();
    setOpenDialog(true);
  };
  const handleDelete = () => {
    onDelete();
    setOpenDialog(false);
  };
  const handleClose = () => {
    setOpenDialog(false);
  };
  return (
    <Box sx={{ ...sx, width: '100%', height: '150px' }}>
      <DropZoneStyle
        {...getRootProps()}
        sx={{
          ...(isDragActive && { opacity: 0.72 }),
          ...((isDragReject || error) && {
            color: 'error.main',
            borderColor: 'error.light',
            bgcolor: 'error.lighter'
          })
        }}
      >
        {!file && isEdit && (
          <FilePreview
            onClick={(event) => {
              event.stopPropagation();
              getFile();
            }}
          >
            <span>{filePath}</span>
          </FilePreview>
        )}
        <FileInput>
          <input {...getInputProps()} />
          <UploadIllustration sx={{ marginLeft: '10px', height: '120px', width: '120px' }} />
          <Box
            sx={{
              p: 2,
              ml: { md: 2 },
              paddingLeft: '0px',
              width: '100%',
              height: '140px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {file || fileName ? (
              <div
                style={{
                  width: '100%',
                  padding: '10px 0px 0px 0px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                <filePath>{file?.name || fileName}</filePath>
                <div
                  style={{
                    paddingTop: '20px',
                    width: '150px',
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between'
                  }}
                >
                  <Button
                    sx={{
                      backgroundColor: '#32749e',
                      height: '28px',
                      padding: '5px 10px',
                      color: '#fff'
                    }}
                    onClick={browseFile}
                  >
                    Replace
                  </Button>
                  {file?.name || fileName ? (
                    <Button
                      sx={{
                        backgroundColor: '#32749e',
                        height: '28px',
                        padding: '5px 10px',
                        color: '#fff'
                      }}
                      onClick={deleteFile}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <Typography variant="body2" sx={{ color: '#000', fontSize: '16px', fontWeight: 'bold' }}>
                Drop files here OR click&nbsp;
                <Typography
                  variant="body2"
                  component="span"
                  sx={{
                    color: '#000',
                    fontWeight: 'bold',
                    textDecoration: 'underline'
                  }}
                >
                  Browse
                </Typography>
              </Typography>
            )}
          </Box>
        </FileInput>
      </DropZoneStyle>
      {/* fileRejections.length > 0 && <ShowRejectionItems /> */}
      <Dialog
        open={openDialog}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            <br />
            Are you sure want to delete this file ?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDelete}>Yes</Button>
          <Button onClick={handleClose}>No</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
