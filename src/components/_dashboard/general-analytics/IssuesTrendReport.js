import { merge } from 'lodash';
import PropTypes from 'prop-types';
import ReactApexChart from 'react-apexcharts';
// material
import { Card, CardHeader, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
//
import cloneDeep from 'lodash/cloneDeep';
import { BaseOptionChart } from '../../charts';
import { STATUS_COLORS } from '../../../../src/Constants';

// ----------------------------------------------------------------------

const category = ['Release'];

const data = [
  { name: 'Failed', data: [0] },
  { name: 'Skipped', data: [0] }
];

IssuesTrendReport.propTypes = {
  categories: PropTypes.object,
  CHART_DATA: PropTypes.object
};

export default function IssuesTrendReport({ categories, CHART_DATA }) {
  const theme = useTheme();

  const cdata = CHART_DATA?.map((cdata) => {
    const data = {};
    data.name = cdata.name;
    data.data = [...cdata.data].reverse();
    return data;
  });

  const chartOptions = merge(BaseOptionChart(), {
    xaxis: {
      type: 'String',

      categories: categories ? [...categories].reverse() : categories || category
    },
    tooltip: { x: { format: 'dd/MM/yy HH:mm' } },
    colors: [
      theme.palette.chart.lightRed[0],
      STATUS_COLORS.SKIPPED.highlight,
      STATUS_COLORS.IGNORED.highlight,
      STATUS_COLORS.WARNING.highlight
    ]
  });

  return (
    <Card>
      <CardHeader title="Issues Trend" />
      <Box sx={{ mt: 3, mx: 3 }} dir="ltr">
        <ReactApexChart type="area" series={cloneDeep(cdata) || data} options={chartOptions} height={364} />
      </Box>
    </Card>
  );
}
