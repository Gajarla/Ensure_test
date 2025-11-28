// SpinnerOverlay.js
import React from 'react';
import { CircularProgress, Box } from '@mui/material';

export default function SpinnerOverlay({ loading }) {
  if (!loading) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        bgcolor: 'rgba(255, 255, 255, 0.6)',
        zIndex: (theme) => theme.zIndex.modal + 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <CircularProgress size={48} />
    </Box>
  );
}
