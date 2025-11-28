import { merge } from 'lodash';
import ReactApexChart from 'react-apexcharts';
import PropTypes from 'prop-types';
// material
import { useTheme, styled } from '@mui/material/styles';
import { Card, CardHeader } from '@mui/material';
// utils
import cloneDeep from 'lodash/cloneDeep';
import { fNumber } from '../../../utils/formatNumber';
//
import { BaseOptionChart } from '../../charts';
import { STATUS_COLORS } from '../../../../src/Constants';

// ----------------------------------------------------------------------

const CHART_HEIGHT = 372;
const LEGEND_HEIGHT = 72;

const ChartWrapperStyle = styled('div')(({ theme }) => ({
  height: CHART_HEIGHT,
  marginTop: theme.spacing(5),
  '& .apexcharts-canvas svg': { height: CHART_HEIGHT },
  '& .apexcharts-canvas svg,.apexcharts-canvas foreignObject': {
    overflow: 'visible'
  },
  '& .apexcharts-legend': {
    height: LEGEND_HEIGHT,
    alignContent: 'center',
    position: 'relative !important',
    borderTop: `solid 1px ${theme.palette.divider}`,
    top: `calc(${CHART_HEIGHT - LEGEND_HEIGHT}px) !important`
  }
}));

// ----------------------------------------------------------------------

const data = [0, 0, 0, 0];

ReleaseStatus.propTypes = {
  releaseName: PropTypes.string,
  CHART_DATA: PropTypes.object
};

export default function ReleaseStatus({ releaseName, CHART_DATA }) {
  const theme = useTheme();

  const chartOptions = merge(BaseOptionChart(), {
    colors: [
      theme.palette.chart.lightGreen[0],
      theme.palette.chart.grey[0],
      theme.palette.chart.lightRed[0],
      STATUS_COLORS.SKIPPED.highlight,
      STATUS_COLORS.IGNORED.highlight,
      STATUS_COLORS.WARNING.highlight
    ],
    labels: ['Passed', 'Untested', 'Failed', 'Skipped', 'Ignored', 'Warning'],
    stroke: { colors: [theme.palette.background.paper] },
    legend: { floating: true, horizontalAlign: 'center' },
    dataLabels: { enabled: true, dropShadow: { enabled: false } },
    tooltip: {
      fillSeriesColor: false,
      y: {
        formatter: (seriesName) => fNumber(seriesName),
        title: {
          formatter: (seriesName) => `${seriesName}`
        }
      }
    },
    plotOptions: {
      pie: { donut: { labels: { show: !CHART_DATA } } }
    }
  });

  return (
    <Card>
      <CardHeader title={releaseName ? `${releaseName} - Release Status` : 'Release Status'} />
      <ChartWrapperStyle dir="ltr">
        <ReactApexChart type="pie" series={cloneDeep(CHART_DATA) || data} options={chartOptions} height={310} />
      </ChartWrapperStyle>
    </Card>
  );
}
