// material
import { styled } from '@mui/material/styles';
import PropTypes from 'prop-types';
import { Card, Typography } from '@mui/material';
// utils
import { fPercentage } from '../../../utils/formatNumber';

// ----------------------------------------------------------------------

const RootStyle = styled(Card)(({ theme }) => ({
  boxShadow: 'none',
  textAlign: 'center',
  padding: theme.spacing(5, 0),
  color: theme.palette.warning.darker,
  backgroundColor: theme.palette.warning.lighter
}));

// ----------------------------------------------------------------------

AnalyticsItemOrders.propTypes = {
  TOTAL: PropTypes.object,
  COUNT: PropTypes.object
};

export default function AnalyticsItemOrders({ TOTAL, COUNT }) {
  return (
    <RootStyle>
      <Typography variant="h3">{fPercentage(COUNT, TOTAL)}</Typography>
      <Typography variant="subtitle1" sx={{ opacity: 0.72 }}>
        Automated Cases %
      </Typography>
    </RootStyle>
  );
}
