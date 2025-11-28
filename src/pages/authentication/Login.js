import { Link as RouterLink } from 'react-router-dom';
// material
import { styled } from '@mui/material/styles';
import { Box, Card, Stack, Container, Typography, Button } from '@mui/material';
// routes
// hooks
import useAuth from '../../hooks/useAuth';
// layouts
// components
import Page from '../../components/Page';
import { MHidden } from '../../components/@material-extend';
import { LoginForm } from '../../components/authentication/login';
// import AuthFirebaseSocials from '../../components/authentication/AuthFirebaseSocial';

// import mainlogo from '../../layouts/TE 220124_1_color_200x50.png';
import mainlogo from '../../layouts/TestEnsure_Logo.svg';
// import { theme } from 'antd';
// ----------------------------------------------------------------------

const RootStyle = styled(Page)(({ theme }) => ({
  [theme.breakpoints.up('md')]: {
    display: 'flex'
  }
}));

const SectionStyle = styled(Card)(({ theme }) => ({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  margin: theme.spacing(0, 0, 0, 0),
  // background: 'linear-gradient(to bottom, #ffff, #6190E8, #A7BFE8)',
  // borderRadius: '0 10rem'
  background: '#1DB954',
  borderRadius: '0',
  padding: theme.spacing(12, 0)
}));

const ContentStyle = styled('div')(({ theme }) => ({
  maxWidth: 480,
  margin: 'auto',
  display: 'flex',
  minHeight: '100vh',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: theme.spacing(12, 0)
}));

// ----------------------------------------------------------------------

export default function Login() {
  const { method, login } = useAuth();

  const handleLoginAuth0 = async () => {
    try {
      await login();
    } catch (error) {
      console.error(error);
    }
  };
  const HeaderStyle = styled('header')(({ theme }) => ({
    top: 0,
    zIndex: 9,
    lineHeight: 0,
    width: 'calc(100% - 24px)',
    display: 'flex',
    alignItems: 'center',
    position: 'fixed',
    padding: theme.spacing(3),
    justifyContent: 'space-between',
    [theme.breakpoints.up('md')]: {
      alignItems: 'flex-start',
      padding: theme.spacing(5, 5, 0, 3)
    }
  }));
  return (
    <RootStyle title="Test Ensure">
      <Container maxWidth="md">
        <Stack direction="row" alignItems="center">
          <HeaderStyle>
            <RouterLink to="/">
              <img src={mainlogo} alt="Logo" />
            </RouterLink>
          </HeaderStyle>
        </Stack>
        <ContentStyle>
          <Stack direction="row" alignItems="center" sx={{ mb: 5 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" gutterBottom>
                Sign in to TestEnsure
              </Typography>
              <Typography sx={{ color: 'text.secondary' }}>Enter your details below.</Typography>
            </Box>
          </Stack>

          {/* {method === 'firebase' && <AuthFirebaseSocials />} */}

          {method !== 'auth0' ? (
            <LoginForm />
          ) : (
            <Button fullWidth size="large" type="submit" variant="contained" onClick={handleLoginAuth0}>
              Login
            </Button>
          )}
        </ContentStyle>
      </Container>

      <MHidden width="mdDown">
        <SectionStyle>
          {/* <Stack direction="row" alignItems="center" sx={{ mb: 5 }}>
            <AuthLayout> </AuthLayout>
          </Stack> */}
          <Stack direction="row" alignItems="center" sx={{ margin: '0 auto', textAlign: 'center' }}>
            <Box sx={{ flexGrow: 1, maxWidth: '80%', textAlign: 'center', margin: '0 auto' }}>
              <Typography variant="h3" gutterBottom spacing={3} alignItems="center" sx={{ color: '#fff' }}>
                Simplify and Standardize your entire QA process
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ display: 'flex', maxWidth: '95%', margin: '0 auto' }}>
            {/* <img src="/static/illustrations/illustration_register.png" alt="login" /> */}
            <img src="/static/illustrations/dashboard.svg" alt="login" />
          </Box>
        </SectionStyle>
      </MHidden>
    </RootStyle>
  );
}
