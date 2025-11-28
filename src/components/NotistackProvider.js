import PropTypes from 'prop-types';
import { forwardRef } from 'react';
import { SnackbarProvider, useSnackbar } from 'notistack';
import { Icon } from '@iconify/react';
import closeFill from '@iconify/icons-eva/close-fill';
// Icons for different variants
import checkmarkCircle2Fill from '@iconify/icons-eva/checkmark-circle-2-fill';
import alertTriangleFill from '@iconify/icons-eva/alert-triangle-fill';
import alertCircleFill from '@iconify/icons-eva/alert-circle-fill';
import infoFill from '@iconify/icons-eva/info-fill';

// MUI
import { Box, IconButton } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// ----------------------------------------------------------------------

const variantIcons = {
  success: checkmarkCircle2Fill,
  error: alertCircleFill,
  warning: alertTriangleFill,
  info: infoFill
};

const CustomSnackbarContent = forwardRef((props, ref) => {
  const { id, message, variant } = props;
  const theme = useTheme();
  const { closeSnackbar } = useSnackbar();

  const icon = variantIcons[variant] || infoFill;
  const color = theme.palette[variant]?.main || theme.palette.info.main;
  const backgroundColor = alpha(color, 0.16);

  return (
    <Box
      ref={ref}
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2,
        py: 1.5,
        borderRadius: 1,
        bgcolor: theme.palette.background.paper,
        boxShadow: theme.shadows[8],
        maxWidth: 400,
        color: theme.palette.text.primary
      }}
    >
      <Box
        component="span"
        sx={{
          mr: 1.5,
          width: 40,
          height: 40,
          display: 'flex',
          borderRadius: 1.5,
          alignItems: 'center',
          justifyContent: 'center',
          color,
          bgcolor: backgroundColor
        }}
      >
        <Icon icon={icon} width={24} height={24} />
      </Box>

      <Box sx={{ flexGrow: 1 }}>{message}</Box>

      <IconButton size="small" onClick={() => closeSnackbar(id)} sx={{ color: theme.palette.text.secondary }}>
        <Icon icon={closeFill} width={20} height={20} />
      </IconButton>
    </Box>
  );
});

CustomSnackbarContent.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  message: PropTypes.node,
  variant: PropTypes.string
};

NotistackProvider.propTypes = {
  children: PropTypes.node
};

export default function NotistackProvider({ children }) {
  return (
    <SnackbarProvider
      maxSnack={5}
      autoHideDuration={3000}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      Components={{
        success: CustomSnackbarContent,
        error: CustomSnackbarContent,
        warning: CustomSnackbarContent,
        info: CustomSnackbarContent
      }}
    >
      {children}
    </SnackbarProvider>
  );
}
