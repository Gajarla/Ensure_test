import { filter } from 'lodash';
import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
// material
import {
  Card,
  Table,
  Stack,
  Avatar,
  AvatarGroup,
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  DialogContentText,
  TableRow,
  TableBody,
  TableCell,
  Container,
  Typography,
  TableContainer,
  TablePagination,
  Tooltip
} from '@mui/material';
// redux
import { getUserList } from '../../redux/slices/user';
import { setAuditLogs } from '../../redux/slices/auditLog';

import { getAuditLogs } from '../../_apis_/project';
import { useDispatch, useSelector } from '../../redux/store';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import Scrollbar from '../../components/Scrollbar';
import SearchNotFound from '../../components/SearchNotFound';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import { ProjectListHead } from '../../components/_dashboard/project/list';
import STATUS from '../../components/_dashboard/project/ProjectStatus';
import LoadingScreen from '../../components/LoadingScreen';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'collection', label: 'Resource', alignRight: false },
  { id: 'action', label: 'Action', alignRight: false },
  { id: 'object', label: 'Object', alignRight: false },
  { id: 'oldValue', label: 'Old Value', alignRight: false },
  { id: 'newValue', label: 'New Value', alignRight: false },
  { id: 'user', label: 'Author', alignRight: false },
  { id: 'updatedAt', label: 'Time', alignRight: false },
  { id: '' }
];

// ----------------------------------------------------------------------

const DATE_OBJECTS = ['updatedAt'];

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
    return filter(array, (_user) => _user.collectionName.toLowerCase().indexOf(query.toLowerCase()) !== -1);
  }
  return stabilizedThis?.map((el) => el[0]);
}

export default function AuditLog() {
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { userList, currentUser } = useSelector((state) => state.user);
  const { auditLogs } = useSelector((state) => state.auditLog);
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState('desc');
  const [selected, setSelected] = useState([]);
  const [orderBy, setOrderBy] = useState('updatedAt');
  const [filterName] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsloading] = useState(false);
  const [open, setOpen] = useState(false);
  const [auditLog, setAuditLog] = useState();

  const getUserName = (email) => {
    const user = userList.find((user) => user.email === email);
    const userName = `${user?.firstName} ${user?.lastName}`;
    return userName;
  };

  const getAuditLog = useCallback(async () => {
    setIsloading(true);
    const aLogs = await getAuditLogs(currentUser?.company?._id);
    aLogs?.map((auditLog) => {
      if (auditLog?.object === 'team') {
        const oldTeam = userList?.filter((user) => auditLog?.oldValue.includes(user._id));
        const newTeam = userList?.filter((user) => auditLog?.newValue.includes(user._id));
        auditLog.oldValue = oldTeam;
        auditLog.newValue = newTeam;
      }
      return auditLog;
    });
    setAuditLogs(dispatch, aLogs);
    setIsloading(false);
  }, [dispatch, currentUser, userList]);

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = auditLogs.map((n) => n.name);
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

  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - auditLogs.length) : 0;

  const filteredProjects = applySortFilter(auditLogs, getComparator(order, orderBy), filterName);

  const isUserNotFound = filteredProjects?.length === 0;

  const activeProjects = filteredProjects?.filter((project) => project.status !== STATUS.ARCHIVED);

  useEffect(() => {
    dispatch(getUserList());
    getAuditLog();
  }, [dispatch, getAuditLog]);

  const handleResourceClick = async (id) => {
    const auditLog = auditLogs?.find((auditLog) => auditLog.id === id);
    setAuditLog(auditLog);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading="Audit Log"
          links={[{ name: 'Audit Log', href: PATH_DASHBOARD.auditLog.auditLog }, { name: 'Audit Log' }]}
          info="A project is a collection of related modules and test cases."
        />

        {isLoading && <LoadingScreen />}
        {!isLoading && (
          <Card>
            {/* <ProjectListToolbar
              numSelected={selected.length}
              filterName={filterName}
              onFilterName={handleFilterByName}
            /> */}

            <Scrollbar>
              <TableContainer sx={{ minWidth: 800 }}>
                <Table>
                  <ProjectListHead
                    order={order}
                    orderBy={orderBy}
                    headLabel={TABLE_HEAD}
                    rowCount={activeProjects?.length}
                    numSelected={selected.length}
                    onRequestSort={handleRequestSort}
                    onSelectAllClick={handleSelectAllClick}
                  />
                  <TableBody>
                    {activeProjects?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => {
                      const { id, user, action, object, collection, oldValue, newValue, updatedAt } = row;
                      // const isItemSelected = selected.indexOf(module) !== -1;

                      return (
                        <>
                          {' '}
                          <TableRow
                            hover
                            key={id}
                            tabIndex={-1}
                            role="checkbox"
                            // selected={isItemSelected}
                            // aria-checked={isItemSelected}
                          >
                            <TableCell component="th" scope="row" padding="none">
                              <Typography
                                variant="subtitle2"
                                noWrap
                                color="#0045ff"
                                style={{ textDecoration: 'none', cursor: 'pointer' }}
                              >
                                <Stack
                                  onClick={() => {
                                    handleResourceClick(id);
                                    setOpen(true);
                                  }}
                                >
                                  {collection}
                                </Stack>
                              </Typography>
                            </TableCell>
                            <TableCell align="left">{action}</TableCell>
                            <TableCell align="left">{object}</TableCell>
                            <TableCell align="left">
                              {object === 'team' && (
                                <AvatarGroup
                                  max={4}
                                  sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}
                                  style={{ flexDirection: 'row' }}
                                >
                                  {oldValue?.map((person) => (
                                    <Tooltip
                                      title={`${person?.firstName} ${person?.lastName}`}
                                      key={`${person?.firstName} ${person?.lastName}`}
                                    >
                                      <Avatar
                                        key={person?.firstName}
                                        alt={person?.firstName}
                                        src={person?.avatarUrl || person?.firstName}
                                      />
                                    </Tooltip>
                                  ))}
                                </AvatarGroup>
                              )}
                              {DATE_OBJECTS.includes(object) && format(new Date(oldValue), 'MMM dd yyyy, hh:mm a')}
                              {object !== 'team' && !DATE_OBJECTS.includes(object) && <b>{oldValue}</b>}
                            </TableCell>
                            <TableCell align="left">
                              {object === 'team' && (
                                <AvatarGroup
                                  max={4}
                                  sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}
                                  style={{ flexDirection: 'row' }}
                                >
                                  {newValue?.map((person) => (
                                    <Tooltip
                                      title={`${person?.firstName} ${person?.lastName}`}
                                      key={`${person?.firstName} ${person?.lastName}`}
                                    >
                                      <Avatar
                                        key={person?.firstName}
                                        alt={person?.firstName}
                                        src={person?.avatarUrl || person?.firstName}
                                      />
                                    </Tooltip>
                                  ))}
                                </AvatarGroup>
                              )}
                              {DATE_OBJECTS.includes(object) && format(new Date(newValue), 'MMM dd yyyy, hh:mm a')}
                              {object !== 'team' && !DATE_OBJECTS.includes(object) && <b>{newValue}</b>}
                            </TableCell>
                            <TableCell align="left">
                              {/* user */}
                              <Tooltip title={getUserName(user)}>
                                <Avatar key={getUserName(user)} alt={getUserName(user)} src={getUserName(user)} />
                              </Tooltip>
                            </TableCell>
                            <TableCell align="left">{format(new Date(updatedAt), 'MMM dd yyyy, hh:mm a')}</TableCell>

                            <TableCell align="right" />
                          </TableRow>
                        </>
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

            <Dialog open={open} onClose={handleClose}>
              <DialogTitle id="simple-dialog-title">Audit Info</DialogTitle>
              <DialogContent>
                <DialogContentText id="alert-dialog-slide-description">
                  {auditLog?.collection === 'projects' && auditLog?.action === 'create' && (
                    <>
                      <br />
                      <TableRow>
                        <TableCell>
                          <b>Project</b>
                        </TableCell>
                        <TableCell>{auditLog?.resource?.name}</TableCell>
                        <TableCell>
                          <b>Description</b>
                        </TableCell>
                        <TableCell>{auditLog?.resource?.description}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <b>Status</b>
                        </TableCell>
                        <TableCell>{auditLog?.resource?.status}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <b>Author</b>
                        </TableCell>
                        <TableCell>{auditLog?.user}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <b>Created At</b>
                        </TableCell>
                        <TableCell>{auditLog?.resource?.createdAt}</TableCell>
                        <TableCell>
                          <b>Updated At</b>
                        </TableCell>
                        <TableCell>{auditLog?.resource?.updatedAt}</TableCell>
                      </TableRow>
                    </>
                  )}
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button variant="contained" onClick={handleClose}>
                  OK
                </Button>
              </DialogActions>
            </Dialog>

            <TablePagination
              rowsPerPageOptions={[10, 15, 25, 30]}
              component="div"
              count={activeProjects?.length}
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
