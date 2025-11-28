import { filter } from 'lodash';
import { Icon } from '@iconify/react';
import { sentenceCase } from 'change-case';
import { useState, useEffect } from 'react';
import plusFill from '@iconify/icons-eva/plus-fill';
import { Link as RouterLink } from 'react-router-dom';
// material
import { useTheme } from '@mui/material/styles';
import {
  Card,
  Table,
  Stack,
  Avatar,
  Button,
  TableRow,
  TableBody,
  TableCell,
  Container,
  Typography,
  TableContainer,
  TablePagination
} from '@mui/material';
// redux
import { useDispatch, useSelector } from '../../redux/store';
import { getUserList, getDeleteUser } from '../../redux/slices/user';
import { setRoleConfig, setRolesList } from '../../redux/slices/role';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import Label from '../../components/Label';
import Scrollbar from '../../components/Scrollbar';
import SearchNotFound from '../../components/SearchNotFound';
import LoadingScreen from '../../components/LoadingScreen';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import { UserListHead, UserListToolbar, UserMoreMenu } from '../../components/_dashboard/user/list';
import { getIndexedDBObject } from '../../main';
import { IndexedDB, INDEXEDDB_KEYS } from '../../Constants';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Name', alignRight: false },
  { id: 'email', label: 'Email', alignRight: false },
  { id: 'role', label: 'Role', alignRight: false },
  { id: 'status', label: 'Status', alignRight: false },
  { id: 'company', label: 'Company', alignRight: false },
  // { id: 'defecttrack', label: 'Defect Tracking Enabled', alignRight: false },
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
    return filter(
      array,
      (_user) =>
        _user.firstName?.toLowerCase().indexOf(query.toLowerCase()) !== -1 ||
        _user.lastName?.toLowerCase().indexOf(query.toLowerCase()) !== -1
    );
  }
  return stabilizedThis?.map((el) => el[0]);
}

export default function UserList() {
  const { themeStretch } = useSettings();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentUser, userList, appendUrl } = useSelector((state) => state.user);
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('name');
  const [filterName, setFilterName] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [isLoading, setIsloading] = useState(false);
  const [fetchRoleConfig, setFetchRoleConfig] = useState(true);
  const { licenseExpired } = useSelector((state) => state.license);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  useEffect(() => {
    setIsloading(true);
    dispatch(getUserList());
    setIsloading(false);
    setRolesList(dispatch, null);
  }, [dispatch]);

  // useEffect(() => {
  //   if (fetchRoleConfig) {
  //     setRoleConfig(dispatch, null);
  //     setFetchRoleConfig(false);
  //   }
  // }, [dispatch, fetchRoleConfig]);

  useEffect(() => {
    const fetchRoleConfigData = async () => {
      if (fetchRoleConfig) {
        const roleConfig = await getIndexedDBObject(IndexedDB.ROLE, INDEXEDDB_KEYS.ROLE_CONFIG);
        setRoleConfig(dispatch, roleConfig);
        setFetchRoleConfig(false);
      }
    };
    fetchRoleConfigData();
  }, [dispatch, fetchRoleConfig]);

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
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

  const handleDeleteUser = (userId) => {
    getDeleteUser(dispatch, userId);
  };

  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - userList?.length) : 0;

  const filteredUsers = applySortFilter(userList, getComparator(order, orderBy), filterName);

  const isUserNotFound = filteredUsers?.length === 0;

  return (
    <Page title="TestEnsure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading="All Users"
          links={[{ name: 'Users', href: getUrl(PATH_DASHBOARD.user.allUsers) }, { name: 'All Users' }]}
          action={
            !licenseExpired && (
              <Button
                variant="contained"
                component={RouterLink}
                to={getUrl(PATH_DASHBOARD.user.newUser)}
                startIcon={<Icon icon={plusFill} />}
              >
                New User
              </Button>
            )
          }
        />

        {isLoading && <LoadingScreen />}
        {!isLoading && (
          <Card>
            <UserListToolbar numSelected={0} filterName={filterName} onFilterName={handleFilterByName} />
            <Scrollbar>
              <TableContainer sx={{ minWidth: 800 }}>
                <Table>
                  <UserListHead
                    order={order}
                    orderBy={orderBy}
                    headLabel={TABLE_HEAD}
                    onRequestSort={handleRequestSort}
                  />
                  <TableBody>
                    {filteredUsers?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => {
                      const { _id, firstName, lastName, avatarUrl, email, role, status, company } = row;

                      return (
                        <TableRow hover key={_id} tabIndex={-1} role="checkbox">
                          <TableCell component="th" scope="row" padding="none">
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Avatar alt={avatarUrl || firstName} src={avatarUrl || firstName} />
                              <Typography variant="subtitle2" noWrap>
                                {firstName} {lastName}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell align="left">{email}</TableCell>
                          <TableCell align="left">{role?.roleName}</TableCell>
                          <TableCell align="left">
                            <Label
                              variant={theme.palette.mode === 'light' ? 'ghost' : 'filled'}
                              color={(status === 'banned' && 'error') || 'success'}
                            >
                              {sentenceCase(status)}
                            </Label>
                          </TableCell>
                          <TableCell align="left">{company?.company}</TableCell>
                          {!licenseExpired && (
                            <TableCell align="right">
                              <UserMoreMenu
                                onDelete={() => handleDeleteUser(_id)}
                                userId={_id}
                                currentUserId={currentUser?._id}
                              />
                            </TableCell>
                          )}
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
              count={filteredUsers?.length || 0}
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
