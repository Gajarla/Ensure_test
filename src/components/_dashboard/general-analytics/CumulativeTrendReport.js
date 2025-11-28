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
  { name: 'Untested', data: [0] },
  { name: 'Passed', data: [0] },
  { name: 'Skipped', data: [0] },
  { name: 'Failed', data: [0] }
];

CumulativeTrendReport.propTypes = {
  cardHeader: PropTypes.string,
  categories: PropTypes.object,
  CHART_DATA: PropTypes.object
};

export default function CumulativeTrendReport({ cardHeader, categories, CHART_DATA }) {
  const theme = useTheme();

  const cdata = CHART_DATA?.map((cdata) => {
    const data = {};
    data.name = cdata.name;
    data.data = [...cdata.data].reverse();
    return data;
  });

  const chartOptions = merge(BaseOptionChart(), {
    chart: {
      stacked: true,
      zoom: { enabled: true }
    },
    colors: [
      theme.palette.chart.grey[0],
      theme.palette.chart.lightGreen[0],
      STATUS_COLORS.SKIPPED.highlight,
      theme.palette.chart.lightRed[0],
      STATUS_COLORS.IGNORED.highlight,
      STATUS_COLORS.WARNING.highlight
    ],
    legend: { itemMargin: { vertical: 8 }, position: 'right', offsetY: 20 },
    plotOptions: { bar: { columnWidth: '16%' } },
    stroke: { show: false },
    xaxis: {
      // labels: {
      //   rotate: 0
      // },
      // tickPlacement: 'on',
      type: 'String',
      // categories: [
      //   '01/01/2011 GMT',
      //   '01/02/2011 GMT',
      //   '01/03/2011 GMT',
      //   '01/04/2011 GMT',
      //   '01/05/2011 GMT',
      //   '01/06/2011 GMT'
      // ]
      categories: categories ? [...categories].reverse() : categories || category
    }
  });

  return (
    <Card>
      <CardHeader title={cardHeader} />
      <Box sx={{ p: 3, pb: 1 }} dir="ltr">
        <ReactApexChart type="bar" series={cloneDeep(cdata) || data} options={chartOptions} height={364} />
      </Box>
    </Card>
  );
}
