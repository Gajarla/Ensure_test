// material
import { styled } from '@mui/material/styles';
import PropTypes from 'prop-types';
import { Card, Typography } from '@mui/material';
// utils

// ----------------------------------------------------------------------

const RootStyle = styled(Card)(({ theme }) => ({
  boxShadow: 'none',
  textAlign: 'center',
  padding: theme.spacing(5, 0),
  color: theme.palette.info.darker,
  backgroundColor: theme.palette.info.lighter
}));

// ----------------------------------------------------------------------

AnalyticsReleaseDuration.propTypes = {
  TOTAL: PropTypes.object
};

export default function AnalyticsReleaseDuration({ TOTAL }) {
  return (
    <RootStyle>
      <Typography variant="h3">{TOTAL}</Typography>
      <Typography variant="subtitle1" sx={{ opacity: 0.72 }}>
        Duration
      </Typography>
    </RootStyle>
  );
}
