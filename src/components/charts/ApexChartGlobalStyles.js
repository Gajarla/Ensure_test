// ApexChartGlobalStyles.jsx
import React from 'react';
import { GlobalStyles } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export function ApexChartGlobalStyles() {
  const theme = useTheme();

  return (
    <GlobalStyles
      styles={{
        // Tooltip
        '.apexcharts-tooltip, .apexcharts-xaxistooltip': {
          border: '0 !important',
          boxShadow: `${theme.customShadows?.z24} !important`,
          color: `${theme.palette?.text?.primary} !important`,
          borderRadius: `${theme.shape.borderRadiusSm}px !important`,
          backgroundColor: `${theme.palette.background.default} !important`
        },
        '.apexcharts-tooltip-title': {
          border: '0 !important',
          fontWeight: theme.typography.fontWeightBold,
          // eslint-disable-next-line
          backgroundColor: `${theme.palette.grey[500 + '16']} !important`,
          color: theme.palette?.text[theme.palette.mode === 'light' ? 'secondary' : 'primary']
        },
        '.apexcharts-xaxistooltip-bottom:before': {
          borderBottomColor: 'transparent !important'
        },
        '.apexcharts-xaxistooltip-bottom:after': {
          borderBottomColor: `${theme.palette.background.paper} !important`
        },
        // Legend
        '.apexcharts-legend': {
          padding: '0 !important'
        },
        '.apexcharts-legend-series': {
          alignItems: 'center',
          display: 'flex !important'
        },
        '.apexcharts-legend-marker': {
          marginTop: '-2px !important',
          marginRight: '8px !important'
        },
        '.apexcharts-legend-text': {
          lineHeight: '18px',
          textTransform: 'capitalize'
        }
      }}
    />
  );
}
