const url = {
  wsHost: 'ws://localhost:5000/websockets',
  host: process.env.REACT_APP_API_BASE_URL,
  jenkis: 'http://73.135.240.210:8088',
  reportPortal: 'http://73.135.240.210:9080',
  JENKINS_HEADERS: {
    Authorization: `Basic SmFua2luc0FkbWluOjExM2ZlYmQ0NWY0NDIzNzNhMTdhNzA4Y2Y3YTlhNmU3Zjg`,
    'Jenkins-Crumb': `b48293e46d642cafc82fbd933b02bb5b7bfde657da925c6ea04e2c93c9d1a0aa`
  }
};

export default url;
