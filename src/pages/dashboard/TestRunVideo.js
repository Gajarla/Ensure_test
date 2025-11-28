import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
// material
// redux
// import axios from 'axios';

import { Box, Typography, IconButton, Menu, MenuItem } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import axios from '../../utils/axiosInstance';
import API from '../../services';
import { getIDBCurrentUser } from '../../main';
import LoadingScreen from '../../components/LoadingScreen';
import LiveStreamPlayer from './LiveStreamPlayer';
import { INDEXEDDB_KEYS } from '../../Constants';
import { getSessionObj, setSessionObj } from '../../utils/jwt';
import { useSnackbar } from 'notistack';

// ----------------------------------------------------------------------

export default function TestRunVideo() {
  const videoRef = useRef(null);
  const { testRunId } = useParams();
  const [isLoading, setIsloading] = useState(true);
  const [msg, setMsg] = useState();
  const [videoUrl, setVideoUrl] = useState(null);
  const [jenkinsJobName, setJenkinsJobName] = useState(null);
  const [job, setJob] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const { enqueueSnackbar } = useSnackbar();
  // const streamUrl = 'http://localhost:5000/api/releases/stream/Test_Live_video_SalesOrder_1/index.m3u8?bypass=true';

  // menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const getJobInfo = async () => {
    let job = null;
    try {
      const currentUser = await getIDBCurrentUser();
      const api = `${API.testRun.getJob(currentUser._id, testRunId)}`;
      const response = await axios({
        method: 'get',
        url: api,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });
      if (response?.data?.data?.jenkinsJobName) {
        setJenkinsJobName(response?.data?.data?.jenkinsJobName);
        job = response?.data?.data;
        setJob(response?.data?.data);
      }
      if (response?.data?.data?.linuxScreenRecord?.status === 'View') openLinuxRecord();
      else getLiveStreamUrl();

      // if (response?.data?.data?.linuxScreenRecord?.status === 'Live') getLiveStreamUrl();
    } catch (error) {
      console.log('error', error);
    }
    return job;
  };

  const getModuleInfo = async (moduledId) => {
    let module = null;
    try {
      const currentUser = await getIDBCurrentUser();
      const api = `${API.testRun.getModule(currentUser._id, moduledId)}`;
      const response = await axios({
        method: 'get',
        url: api,
        headers: {
          Authorization: `Bearer ${getSessionObj('accessToken')}`
        }
      });

      module = response?.data?.data;

      // if (response?.data?.data?.linuxScreenRecord?.status === 'Live') getLiveStreamUrl();
    } catch (error) {
      console.log('error', error);
    }
    return module;
  };

  const getLiveStreamUrl = async () => {
    console.log('jenkinsJobName', jenkinsJobName);
    if (jenkinsJobName) {
      try {
        const api = `${API.testRun.liveStreamVideo(jenkinsJobName, testRunId)}`;
        console.log('api', api);
        const response = await axios({
          method: 'get',
          url: api,
          headers: {
            Authorization: `Bearer ${getSessionObj('accessToken')}`
          }
        });
        setStreamUrl(api);
        setIsloading(false);
      } catch (error) {
        console.log('error', error);
        setStreamUrl(null);
      }
      getJobInfo();
    }
  };

  const openLinuxRecord = useCallback(async () => {
    const currentUser = await getIDBCurrentUser();
    videoRef?.current?.load();

    setSessionObj(INDEXEDDB_KEYS.CURRENT_TESTRUN, JSON.stringify({ _id: testRunId }));

    // if (job?.linuxScreenRecord?.status === 'View') {
    try {
      const api = `${API.testRun.streamVideo(currentUser._id, testRunId)}?bypass=true`;
      const response = await axios.get(api, {
        headers: {
          Range: 'bytes=0-' // Requesting the entire file from the start
        }
      });
      if (response.data.status === 400) {
        setMsg(response.data.message);
      } else {
        setVideoUrl(api); // Adjust based on API response structure
      }
    } catch (err) {
      // setError('Failed to load video. Please try again.');
      console.error('Error fetching video:', err);
    }
    setIsloading(false);
    // }
  }, [testRunId]);

  useEffect(() => {
    const fetchData = async () => {
      await getJobInfo();
    };
    fetchData();
  }, [openLinuxRecord, jenkinsJobName, videoUrl, job?.linuxScreenRecord?.status]);

  // ✅ Play/Pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
    handleMenuClose();
  };

  // ✅ Download
  const downloadVideo = async () => {
    const job = await getJobInfo();
    const moduleId = job?.testRun[0]?.moduleID;
    const module = await getModuleInfo(moduleId);
    const currentUser = await getIDBCurrentUser();
    const downloadUrl = `${API.testRun.downloadVideo(currentUser._id, testRunId)}?bypass=true`;

    enqueueSnackbar('Download started...', { variant: 'info' });

    // Use fetch + blob to ensure download works even if endpoint requires CORS
    fetch(downloadUrl, { method: 'GET' })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${module?.suiteName}_${job?.jenkinsJobID}.mp4`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        enqueueSnackbar('File downloaded successfully!', { variant: 'success' });
      })
      .catch((err) => {
        console.error('Download failed', err);
        enqueueSnackbar('Unexpected error while downloading file.', { variant: 'error' });
      });

    handleMenuClose();
  };

  // ✅ Picture-in-Picture
  const enablePip = async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP not supported:', err);
    }
    handleMenuClose();
  };

  return (
    <>
      <Typography style={{ textAlign: 'center', fontWeight: '500' }}>{msg}</Typography>
      {isLoading && <LoadingScreen />}
      {!videoUrl && streamUrl && (
        <>
          <div
            style={{
              position: 'absolute',
              width: '90vw',
              height: '90vh',
              objectFit: 'cover',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <h4>Live Stream</h4>
            <LiveStreamPlayer videoUrl={videoUrl} streamUrl={streamUrl} />
          </div>
        </>
      )}

      {!isLoading && videoUrl && (
        <>
          {/* <Box
            component="video"
            src={videoUrl}
            muted
            controls
            preload="auto"
            sx={{
              position: 'absolute',
              width: '90vw',
              height: '90vh',
              objectFit: 'cover',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          /> */}
          <div
            style={{
              position: 'absolute',
              width: '90vw',
              height: '90vh',
              objectFit: 'cover',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              preload="auto"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onContextMenu={(e) => e.preventDefault()} // 🚫 disable native right-click
              controls // ✅ show default controls
              controlsList="nodownload"
            />

            {/* Custom 3-dot menu */}
            <IconButton
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                color: '#fff',
                background: 'linear-gradient(180deg, black, transparent)'
              }}
              onClick={handleMenuOpen}
            >
              <MoreVertIcon />
            </IconButton>

            <Menu anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={handleMenuClose}>
              <MenuItem onClick={downloadVideo}>Download</MenuItem>
            </Menu>
          </div>
        </>
      )}
    </>
  );
}
