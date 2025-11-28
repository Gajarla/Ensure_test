import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

const LiveStreamPlayer = ({ streamUrl }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null); // keep reference to Hls instance

  useEffect(() => {
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('accessToken')}`);
        }
      });
      hlsRef.current = hls; // store instance
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (e, data) => {
        console.error('HLS.js error:', data);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
    }

    // ✅ cleanup
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  return (
    <div className="p-4">
      <video
        ref={videoRef}
        controls
        autoPlay
        muted
        onEnded={() => console.log('Video ended')}
        style={{
          position: 'absolute',
          width: '90vw',
          height: '90vh',
          objectFit: 'cover',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      />
    </div>
  );
};

export default LiveStreamPlayer;
