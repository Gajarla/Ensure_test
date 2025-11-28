import { AuthProvider } from '@descope/react-sdk';
import { useState } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import Render from './Render';
import { store } from './redux/store';

const RenderComponent = () => {
  const [msg, setMsg] = useState({
    userLoggedIn: false
  });

  return (
    <div>
      {/* <pre>{JSON.stringify(msg, undefined, 2)}</pre> */}
      <ReduxProvider store={store}>
        <AuthProvider projectId="P2iJaZw1FV6Zw4oGlLUVCy8LR1k0">
          <Render setMsg={setMsg} msg={msg} />
        </AuthProvider>
      </ReduxProvider>
    </div>
  );
};

// const RenderComponent = () => {
//   console.log('render component working');
//   return <></>;
// };

export default RenderComponent;
