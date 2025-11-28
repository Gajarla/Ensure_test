import PropTypes from 'prop-types';
import { Icon } from '@iconify/react';
import searchFill from '@iconify/icons-eva/search-fill';
// material
import { useTheme, styled } from '@mui/material/styles';
import { Box, Toolbar, OutlinedInput, Link, InputAdornment } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useSelector } from '../../../../redux/store';
import { PATH_DASHBOARD } from '../../../../routes/paths';

// ----------------------------------------------------------------------

const RootStyle = styled(Toolbar)(({ theme }) => ({
  height: 96,
  display: 'flex',
  justifyContent: 'space-between',
  padding: theme.spacing(0, 1, 0, 3)
}));

const SearchStyle = styled(OutlinedInput)(({ theme }) => ({
  width: 240,
  transition: theme.transitions.create(['box-shadow', 'width'], {
    easing: theme.transitions.easing.easeInOut,
    duration: theme.transitions.duration.shorter
  }),
  '&.Mui-focused': { width: 320, boxShadow: theme.customShadows.z8 },
  '& fieldset': {
    borderWidth: `1px !important`,
    borderColor: `${theme.palette.grey[500_32]} !important`
  }
}));

// ----------------------------------------------------------------------

ProjectListToolbar.propTypes = {
  numSelected: PropTypes.number,
  filterName: PropTypes.string,
  onFilterName: PropTypes.func
};

export default function ProjectListToolbar({ numSelected, filterName, onFilterName }) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const { pathname } = useLocation();
  const isArchived = pathname.includes('archived');
  const { appendUrl } = useSelector((state) => state.user);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  return (
    <RootStyle
      sx={{
        ...(numSelected > 0 && {
          color: isLight ? 'primary.main' : 'text?.primary',
          bgcolor: isLight ? 'primary.lighter' : 'primary.dark'
        })
      }}
    >
      <SearchStyle
        value={filterName}
        onChange={onFilterName}
        placeholder="Search project..."
        startAdornment={
          <InputAdornment position="start">
            <Box component={Icon} icon={searchFill} sx={{ color: 'text.disabled' }} />
          </InputAdornment>
        }
      />
      {!isArchived && (
        <Link
          style={{ textDecoration: 'none', cursor: 'pointer' }}
          component={RouterLink}
          to={getUrl(PATH_DASHBOARD.project.archivedProjects)}
        >
          Archived Projects
        </Link>
      )}

      {isArchived && (
        <Link
          style={{ textDecoration: 'none', cursor: 'pointer' }}
          component={RouterLink}
          to={getUrl(PATH_DASHBOARD.project.allProjects)}
        >
          Unarchived Projects
        </Link>
      )}
    </RootStyle>
  );
}
