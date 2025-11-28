import { filter } from 'lodash';
import { sentenceCase } from 'change-case';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
// material
import { useTheme } from '@mui/material/styles';
import {
  Card,
  Table,
  Avatar,
  AvatarGroup,
  TableRow,
  TableBody,
  TableCell,
  Container,
  Typography,
  TableContainer,
  TablePagination
} from '@mui/material';
// redux
import {
  setCurrentProject,
  getEditProject,
  setProjectList,
  setFilteredProjectList,
  setFetchProjectData
} from '../../redux/slices/project';
import { getFilteredProjectList } from '../../_apis_/project';
import { setRoleConfig, setPageConfig } from '../../redux/slices/role';
import { useDispatch, useSelector } from '../../redux/store';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import Label from '../../components/Label';
import Scrollbar from '../../components/Scrollbar';
import SearchNotFound from '../../components/SearchNotFound';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import {
  ProjectListHead,
  ProjectListToolbar,
  ArchievedProjectMoreMenu
} from '../../components/_dashboard/project/list';
import STATUS from '../../components/_dashboard/project/ProjectStatus';
import LoadingScreen from '../../components/LoadingScreen';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  // { id: 'name', label: 'Name', alignRight: false },
  // { id: 'team', label: 'Team', alignRight: false },
  // { id: 'status', label: 'Status', alignRight: false },
  // { id: 'modulesCount', label: 'Modules #', alignRight: false },
  // { id: 'updatedAt', label: 'Last Activity', alignRight: false },
  // { id: '' }
  { id: 'name', label: 'Name', align: 'left' },
  { id: 'team', label: 'Team', align: 'left' },
  { id: 'status', label: 'Status', align: 'left' },
  { id: 'modulesCount', label: 'Modules # ', align: 'right' },
  { id: 'updatedAt', label: 'Last Activity', align: 'right' },
  { id: '' }
];

// ----------------------------------------------------------------------

function descendingComparator(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

function getComparator(order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function applySortFilter(array, comparator, query) {
  const stabilizedThis = array?.map((el, index) => [el, index]);
  stabilizedThis?.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  if (query) {
    return filter(array, (_user) => _user.name.toLowerCase().indexOf(query.toLowerCase()) !== -1);
  }
  return stabilizedThis?.map((el) => el[0]);
}

export default function UserList() {
  const navigate = useNavigate();
  const { themeStretch } = useSettings();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentUser, appendUrl } = useSelector((state) => state.user);
  const { filterProjects, fetchProjectData, archivedRoleConfig } = useSelector((state) => state.project);
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState('desc');
  const [selected, setSelected] = useState([]);
  const [orderBy, setOrderBy] = useState('name');
  const [filterName, setFilterName] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [isLoading, setIsloading] = useState(false);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const navigateToLink = (url) => {
    navigate(getUrl(url));
  };

  const filterArchivedProjects = useCallback(async () => {
    if (fetchProjectData) {
      setFetchProjectData(dispatch, false);
      setIsloading(true);
      const data = await getFilteredProjectList(
        STATUS.ARCHIVED,
        currentUser?.company?._id,
        'createdAt',
        'desc',
        '10',
        '0'
      );
      const projects = data?.data;
      setProjectList(dispatch, projects);
      setFilteredProjectList(dispatch, projects);
      setIsloading(false);
    }
  }, [dispatch, fetchProjectData, currentUser]);

  const filterUnArchivedProjects = async () => {
    const data = await getFilteredProjectList(
      STATUS.UNARCHIVED,
      currentUser?.company?._id,
      'createdAt',
      'desc',
      '10',
      '0'
    );
    const projects = data?.data;
    setProjectList(dispatch, projects);
    setFilteredProjectList(dispatch, projects);
  };

  const handleProjectClick = (projectId) => {
    const project = filterProjects?.filter((project) => project._id === projectId)[0];
    setCurrentProject(dispatch, project);
    setRoleConfig(dispatch, archivedRoleConfig?.components[0]);
    setPageConfig(dispatch, archivedRoleConfig?.components[0]?.projects);
    navigateToLink(PATH_DASHBOARD.module.allModules);
  };

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = filterProjects.map((n) => n.name);
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterByName = (event) => {
    setFilterName(event.target.value);
    setPage(0);
  };

  const handleDeleteProject = (projectId) => {
    // dispatch(deleteProject(userId));
    // getDeleteProject(dispatch, projectId);
    const ids = [];
    const project = filterProjects?.filter((project) => project._id === projectId)[0];
    project?.team?.map((data) => {
      ids.push(data._id);
      return null;
    });
    const formData = {
      name: project.name,
      description: project.description,
      status: STATUS.ARCHIVED,
      company: project.company,
      team: ids,
      modules: project.modules,
      createdBy: project.createdBy
    };
    getEditProject(dispatch, formData, projectId);
    setCurrentProject(dispatch, null);
    setRoleConfig(dispatch, null);
    filterUnArchivedProjects();
  };

  useEffect(() => {
    filterArchivedProjects();
  }, [dispatch, filterArchivedProjects]);

  useEffect(() => {
    setProjectList(dispatch, null);
    setFilteredProjectList(dispatch, null);
    setFetchProjectData(dispatch, true);
  }, [dispatch]);

  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - filterProjects.length) : 0;

  const filteredProjects = applySortFilter(filterProjects, getComparator(order, orderBy), filterName);

  const isUserNotFound = filteredProjects?.length === 0;

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading="Archived Projects"
          links={[
            { name: 'Projects', href: getUrl(PATH_DASHBOARD.project.allProjects) },
            { name: 'Archived Projects' }
          ]}
          info="A project is a collection of related modules and test cases."
        />

        {isLoading && <LoadingScreen />}
        {!isLoading && (
          <Card>
            <ProjectListToolbar
              numSelected={selected.length}
              filterName={filterName}
              onFilterName={handleFilterByName}
            />

            <Scrollbar>
              <TableContainer sx={{ minWidth: 800 }}>
                <Table>
                  <ProjectListHead
                    order={order}
                    orderBy={orderBy}
                    headLabel={TABLE_HEAD}
                    rowCount={filteredProjects?.length}
                    numSelected={selected.length}
                    onRequestSort={handleRequestSort}
                    onSelectAllClick={handleSelectAllClick}
                  />
                  <TableBody>
                    {filteredProjects?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => {
                      const { _id, name, team, status, modulesCount, updatedAt } = row;
                      const isItemSelected = selected.indexOf(name) !== -1;

                      return (
                        <TableRow
                          hover
                          key={_id}
                          tabIndex={-1}
                          role="checkbox"
                          selected={isItemSelected}
                          aria-checked={isItemSelected}
                        >
                          <TableCell component="th" scope="row" align="left" padding="none" sx={{ width: '30%' }}>
                            <Typography
                              variant="subtitle2"
                              noWrap
                              color="#0045ff"
                              style={{ textDecoration: 'none', cursor: 'pointer' }}
                              onClick={() => handleProjectClick(_id)}
                            >
                              {name}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ width: '20%' }}>
                            <AvatarGroup
                              max={4}
                              sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}
                              style={{ flexDirection: 'row' }}
                            >
                              {team?.map((person) => (
                                <Avatar
                                  key={person?.firstName}
                                  alt={person?.firstName}
                                  src={person?.avatarUrl || person?.firstName}
                                />
                              ))}
                            </AvatarGroup>
                          </TableCell>
                          <TableCell align="left" sx={{ width: '10%' }}>
                            <Label
                              variant={theme.palette.mode === 'light' ? 'ghost' : 'filled'}
                              color={(status === STATUS.CLOSED && 'error') || 'success'}
                            >
                              {sentenceCase(status)}
                            </Label>
                          </TableCell>
                          <TableCell align="right" sx={{ width: '10%' }}>
                            {modulesCount}
                          </TableCell>
                          <TableCell align="right" sx={{ width: '25%' }}>
                            {format(new Date(updatedAt), 'MMM dd yyyy, hh:mm a')}
                          </TableCell>

                          <TableCell align="right" sx={{ width: '5%' }}>
                            <ArchievedProjectMoreMenu onDelete={() => handleDeleteProject(_id)} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {emptyRows > 0 && (
                      <TableRow style={{ height: 53 * emptyRows }}>
                        <TableCell colSpan={6} />
                      </TableRow>
                    )}
                  </TableBody>
                  {isUserNotFound && (
                    <TableBody>
                      <TableRow>
                        <TableCell align="center" colSpan={6} sx={{ py: 3 }}>
                          <SearchNotFound searchQuery={filterName} />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  )}
                </Table>
              </TableContainer>
            </Scrollbar>

            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredProjects?.length || 0}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Card>
        )}
      </Container>
    </Page>
  );
}
