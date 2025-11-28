import { merge } from 'lodash';
import ReactApexChart from 'react-apexcharts';
//
import BaseOptionChart from './BaseOptionChart';

// ----------------------------------------------------------------------

const CHART_DATA = [
  { name: 'Product A', data: [44, 55, 41, 67, 22, 43] },
  { name: 'Product B', data: [13, 23, 20, 8, 13, 27] },
  { name: 'Product C', data: [11, 17, 15, 15, 21, 14] },
  { name: 'Product D', data: [21, 7, 25, 13, 22, 8] }
];

export default function ChartColumnStacked() {
  const chartOptions = merge(BaseOptionChart(), {
    chart: {
      stacked: true,
      zoom: { enabled: true }
    },
    plotOptions: { bar: { columnWidth: '10%' } },
    stroke: { show: false },
    xaxis: {
      type: 'datetime',
      categories: ['01/01/2011 GMT', '01/02/2011 GMT', '01/03/2011 GMT']
    }
  });

  return <ReactApexChart type="bar" series={CHART_DATA} options={chartOptions} height={320} />;
}
