import { merge } from 'lodash';
import PropTypes from 'prop-types';
import ReactApexChart from 'react-apexcharts';
// material
import { Box, Card, CardHeader } from '@mui/material';
import { useTheme } from '@mui/material/styles';
// utils
import cloneDeep from 'lodash/cloneDeep';
import { BaseOptionChart } from '../../charts';

// ----------------------------------------------------------------------

const category = ['Release'];
const data = [{ data: [0] }];

RunDurationReport.propTypes = {
  categories: PropTypes.object,
  CHART_DATA: PropTypes.object
};

export default function RunDurationReport({ categories, CHART_DATA }) {
  const theme = useTheme();

  // ✅ Dynamic height based on categories
  const baseHeight = 390; // minimum
  const rowHeight = 40; // height per category
  const dynamicHeight = Math.max(baseHeight, (categories?.length || 1) * rowHeight);

  const chartOptions = merge(BaseOptionChart(), {
    // colors: [theme.palette.chart.violet[0]],
    colors: ['#32CD32'],
    tooltip: {
      marker: { show: false },
      custom: ({ series, seriesIndex, dataPointIndex }) => {
        return CHART_DATA && CHART_DATA[0]
          ? `<div style="">${CHART_DATA[seriesIndex]?.data[dataPointIndex]}</div>`
          : ``;
      },
      y: {
        formatter: (seriesName) => seriesName,
        title: { formatter: () => '' }
      }
    },
    plotOptions: {
      bar: { horizontal: true, barHeight: '28%', borderRadius: 2 }
    },
    xaxis: {
      categories: categories || category
    },
    yaxis: {
      labels: {
        style: {
          fontSize: '12px' // increase font size if needed
        },
        maxWidth: 300, // maximum width of label
        truncate: false, // don't truncate
        formatter: (val) => {
          const str = String(val || ''); // ensure it's a string
          if (str.length <= 31) return str;
          return str.match(/.{1,31}/g); // return array for multi-line labels
        }
        // formatter: (val) => {
        //   const str = String(val || '');
        //   // Split by '-' for multi-line labels
        //   return str.includes('-') ? str.split('-') : [str];
        // }
      }
    }
  });

  return (
    <Card>
      <CardHeader title="Run Duration" />
      <Box sx={{ mx: 3 }} dir="ltr">
        <ReactApexChart
          type="bar"
          series={cloneDeep(CHART_DATA) || data}
          options={chartOptions}
          height={dynamicHeight} // 👈 use dynamic height here
        />
      </Box>
    </Card>
  );
}
