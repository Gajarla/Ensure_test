import { useState, useEffect } from 'react';
import { merge } from 'lodash';
import ReactApexChart from 'react-apexcharts';
import PropTypes from 'prop-types';
import { useSpring, animated } from 'react-spring';
// material
import { Grid, Card, Collapse, Box, Typography, Stack } from '@mui/material';
// redux
import { styled, useTheme } from '@mui/material/styles';
import { useSelector } from '../../redux/store';
import Scrollbar from '../../components/Scrollbar';
// components
import { fNumber } from '../../utils/formatNumber';
import { BaseOptionChart } from '../../components/charts';

// ----------------------------------------------------------------------

const ModuleInfoCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2.3, 2.5),
  backgroundColor: '#f4f6f8'
}));

// ----------------------------------------------------------------------

TransitionComponent.propTypes = {
  in: PropTypes.bool
};

function TransitionComponent(props) {
  const style = useSpring({
    from: {
      opacity: 0,
      transform: 'translate3d(20px,0,0)'
    },
    to: {
      opacity: props.in ? 1 : 0,
      transform: `translate3d(${props.in ? 0 : 20}px,0,0)`
    }
  });
  return (
    <animated.div style={style}>
      <Collapse {...props} />
    </animated.div>
  );
}

const CHART_DATA = [20, 10, 50, 10, 10];

// ----------------------------------------------------------------------

Legend.propTypes = {
  label: PropTypes.string,
  number: PropTypes.number,
  total: PropTypes.number,
  color: PropTypes.string
};

function Legend({ label, number, total, color }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: '8px !important' }}>
      <Box
        sx={{
          width: 25,
          height: 25,
          bgcolor: 'grey.50016',
          borderRadius: 0.75,
          ...{
            bgcolor: color
          }
        }}
      />
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle2">
          {number}
          &nbsp;
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            mt: 0,
            display: 'flex',
            alignItems: 'center',
            color: 'text.secondary'
          }}
        >
          {total === 0 ? 0 : parseInt((number / total) * 100, 10)}% set to be {label}
        </Typography>
      </Box>
    </Stack>
  );
}

TestCasesGraph.propTypes = {
  executionDuration: PropTypes.string
};

export default function TestCasesGraph({ executionDuration }) {
  const theme = useTheme();
  const [chartData, setChartData] = useState([]);
  const [legendData, setLegendData] = useState();
  const { currentGraphTestCounts } = useSelector((state) => state.release);

  const chartOptions = merge(BaseOptionChart(), {
    colors: ['#229A16', '#F44B25', '#9A9B9C', '#16ABC5', '#42A5F5', '#FFD73F', '#FF9800'],
    labels: ['Passed', 'Failed', 'Untested', 'Blocked', 'Skipped', 'Ignored', 'Warning'],
    stroke: { colors: [theme.palette.background.paper], width: 0 },
    legend: { show: false },
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
      pie: { donut: { labels: { show: false } } }
    },
    chart: {
      id: 'testCaseCounts'
    }
  });

  useEffect(() => {
    const legendData = {};
    legendData.passed = parseInt(currentGraphTestCounts?.passed, 10);
    legendData.failed = parseInt(currentGraphTestCounts?.failed, 10);
    legendData.untested = parseInt(currentGraphTestCounts?.untested, 10);
    legendData.blocked = parseInt(currentGraphTestCounts?.blocked, 10);
    legendData.skipped = parseInt(currentGraphTestCounts?.skipped, 10);
    legendData.ignored = parseInt(currentGraphTestCounts?.ignored, 10);
    legendData.warning = parseInt(currentGraphTestCounts?.warning, 10);
    legendData.total = parseInt(currentGraphTestCounts?.total, 10);
    setLegendData(legendData);
    const chartData = [
      parseInt(currentGraphTestCounts?.passed, 10),
      parseInt(currentGraphTestCounts?.failed, 10),
      parseInt(currentGraphTestCounts?.untested, 10),
      parseInt(currentGraphTestCounts?.blocked, 10),
      parseInt(currentGraphTestCounts?.skipped, 10),
      parseInt(currentGraphTestCounts?.ignored, 10),
      parseInt(currentGraphTestCounts?.warning, 10)
    ];
    setChartData(chartData);
  }, [currentGraphTestCounts]);

  useEffect(() => {
    chartOptions.chart.id = Math.random;
  }, [chartOptions]);

  const getPercentage = (passed, total) => parseInt((passed / total) * 100, 10);

  const getRemaining = (passed, total) => parseInt(total - passed, 10);

  return (
    <>
      <ModuleInfoCard>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={12} md={12}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Run Status
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <ReactApexChart
              type="pie"
              series={chartData || CHART_DATA}
              options={chartOptions}
              height={320}
              width={320}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Scrollbar>
              <Stack spacing={3} sx={{ p: 3 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '1.2rem', fontWeight: '700', lineHeight: '1' }}>
                    {getPercentage(legendData?.passed, legendData?.total)}% Completed
                    {executionDuration ? `(${executionDuration})` : ''}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      ml: 1,
                      display: 'flex',
                      alignItems: 'center',
                      color: 'text.secondary'
                    }}
                  >
                    {getRemaining(legendData?.passed, legendData?.total)} of {legendData?.total} remaining
                  </Typography>
                </Box>
                <Legend label="Passed" number={legendData?.passed} total={legendData?.total} color="#36AB51" />
                <Legend label="Failed" number={legendData?.failed} total={legendData?.total} color="#F44B25" />
                <Legend label="Untested" number={legendData?.untested} total={legendData?.total} color="#9A9B9C" />
                <Legend label="Skipped" number={legendData?.skipped} total={legendData?.total} color="#42A5F5" />
                <Legend label="Ignored" number={legendData?.ignored} total={legendData?.total} color="#FFD700" />
                <Legend label="Warning" number={legendData?.warning} total={legendData?.total} color="#FF9800" />
              </Stack>
            </Scrollbar>
          </Grid>
        </Grid>
      </ModuleInfoCard>
    </>
  );
}
