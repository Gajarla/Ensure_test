import PropTypes from 'prop-types';
import { Icon } from '@iconify/react';
import menu2Fill from '@iconify/icons-eva/menu-2-fill';
// material
import { styled } from '@mui/material/styles';
import { Box, Stack, AppBar, Toolbar, IconButton, Typography } from '@mui/material';
// hooks
import useCollapseDrawer from '../../hooks/useCollapseDrawer';
// components
import { MHidden } from '../../components/@material-extend';
import AccountPopover from './AccountPopover';
import { useSelector } from '../../redux/store';
import MyAvatar from '../../components/MyAvatar';

// ----------------------------------------------------------------------

const DRAWER_WIDTH = 280;
const COLLAPSE_WIDTH = 102;

const APPBAR_MOBILE = 54;
const APPBAR_DESKTOP = 74;

const RootStyle = styled(AppBar)(({ theme }) => ({
  boxShadow: 'none',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)', // Fix on Mobile
  // background: 'linear-gradient(to right, #ffff, #6190E8, #A7BFE8);', // alpha(theme.palette.background.default, 0.72),
  background: '#eefcff',
  [theme.breakpoints.up('lg')]: {
    width: `calc(100% - ${DRAWER_WIDTH}px)`
  }
}));

const ToolbarStyle = styled(Toolbar)(({ theme }) => ({
  minHeight: APPBAR_MOBILE,
  [theme.breakpoints.up('lg')]: {
    minHeight: APPBAR_DESKTOP,
    padding: theme.spacing(0, 5)
  }
}));

// ----------------------------------------------------------------------

DashboardNavbar.propTypes = {
  onOpenSidebar: PropTypes.func
};

export default function DashboardNavbar({ onOpenSidebar }) {
  const { isCollapse } = useCollapseDrawer();
  const { currentUser } = useSelector((state) => state.user);
  const { licenseExpired } = useSelector((state) => state.license);

  return (
    <RootStyle
      sx={{
        ...(isCollapse && {
          width: { lg: `calc(100% - ${COLLAPSE_WIDTH}px)` }
        })
      }}
    >
      <ToolbarStyle>
        <MHidden width="lgUp">
          <IconButton onClick={onOpenSidebar} sx={{ mr: 1, color: 'text?.primary' }}>
            <Icon icon={menu2Fill} />
          </IconButton>
        </MHidden>
        {/* License Expiry Message */}
        {licenseExpired && (
          <Stack
            direction="row"
            alignItems="center"
            spacing={{ xs: 0.5, sm: 1.5 }}
            justifyContent="flex-start"
            style={{
              backgroundColor: '#fff',
              padding: '10px 15px 10px 15px',
              borderRadius: '30px',
              marginTop: '15px',
              marginRight: '20px'
            }}
          >
            <Stack direction="column">
              <Stack>
                <Typography
                  style={{
                    color: '#ff0000',
                    margin: '0px',
                    fontSize: '14px',
                    fontWeight: 600,
                    letterSpacing: '0px',
                    lineHeight: '1.75',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  {' ⚠️ License expired. Please renew it to use all features.'}
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Stack
          direction="row"
          alignItems="center"
          spacing={{ xs: 0.5, sm: 1.5 }}
          style={{ backgroundColor: '#fff', padding: '10px 15px 10px 15px', borderRadius: '30px', marginTop: '15px' }}
        >
          <MyAvatar src={currentUser?.avatarUrl} />
          <Stack direction="column">
            <Stack>
              <Typography
                style={{
                  color: '#000000',
                  margin: '0px',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0px',
                  lineHeight: '1.75',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                {currentUser?.firstName}
                {'  '}
                {currentUser?.lastName}
              </Typography>
            </Stack>
            <Stack>
              <Typography
                style={{
                  color: 'rgb(152, 162, 179)',
                  margin: '0px',
                  fontWeight: 400,
                  lineHeight: 1.6,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.75rem'
                }}
              >
                {currentUser?.role?.roleName}
              </Typography>
            </Stack>
          </Stack>
          <AccountPopover />
        </Stack>
      </ToolbarStyle>
    </RootStyle>
  );
}
