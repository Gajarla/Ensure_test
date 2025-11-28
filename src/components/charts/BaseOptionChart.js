// material
// ----------------------------------------------------------------------

export default function BaseOptionChart() {
  return {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      foreColor: '#888'
    },
    tooltip: {
      enabled: true,
      style: {
        fontSize: '12px',
        fontFamily: undefined
      }
    },
    legend: {
      show: true,
      position: 'bottom',
      fontSize: '14px',
      markers: {
        width: 12,
        height: 12,
        radius: 12
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    grid: {
      show: false
    },
    xaxis: {
      labels: {
        show: true,
        rotate: 0,
        trim: true
      }
    },
    yaxis: {
      show: true
    }
  };
}
