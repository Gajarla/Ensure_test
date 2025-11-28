import { useEffect } from 'react';
import { kebabCase } from 'change-case';
import { useParams, useLocation } from 'react-router-dom';
// material
import { Container } from '@mui/material';
// redux
import { useDispatch, useSelector } from '../../redux/store';
import { getUserList, getCompaniesList } from '../../redux/slices/user';
import { getRolesList } from '../../_apis_/role';
import { setRolesList, setFilteredRolesList } from '../../redux/slices/role';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import UserNewForm from '../../components/_dashboard/user/UserNewForm';
import { getIDBCurrentUser } from '../../main';
import { USER_ROLES } from '../../Constants';

// ----------------------------------------------------------------------

export default function UserCreate() {
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const { userId } = useParams();
  const { userList, companiesList, appendUrl } = useSelector((state) => state.user);
  const { rolesList } = useSelector((state) => state.role);
  const isEdit = pathname.includes('edit');
  const currentUser = userList.find((user) => kebabCase(user._id) === userId);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  const filterRolesbyUser = async (rolesList) => {
    const currentUser = await getIDBCurrentUser();
    const userRoleId = currentUser?.role?.roleID;
    let filteredRoles = null;
    if (userRoleId === USER_ROLES.ADMIN) {
      filteredRoles = rolesList?.filter((role) => [USER_ROLES.ADMIN, USER_ROLES.CLIENT_ADMIN].includes(role.roleID));
    } else if (userRoleId === USER_ROLES.CLIENT_ADMIN) {
      filteredRoles = rolesList?.filter((role) => ![USER_ROLES.ADMIN].includes(role.roleID));
    }
    if (filteredRoles && filteredRoles?.length !== 0) setFilteredRolesList(dispatch, filteredRoles);
  };

  useEffect(() => {
    if (!userList) dispatch(getUserList());
    const fetchData = async () => {
      dispatch(getUserList());
      const rolesList = await getRolesList();
      setRolesList(dispatch, rolesList);
      filterRolesbyUser(rolesList);
    };
    if (!rolesList) fetchData();
    if (!companiesList) dispatch(getCompaniesList());
  });

  return (
    <Page title="TestEnsure: Create a new user">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading={!isEdit ? 'Create a new user' : 'Edit user'}
          links={[
            { name: 'All Users', href: getUrl(PATH_DASHBOARD.user.allUsers) },
            { name: !isEdit ? 'New user' : `${currentUser?.firstName} ${currentUser?.lastName}` }
          ]}
        />

        <UserNewForm isEdit={isEdit} currentUser={currentUser} />
      </Container>
    </Page>
  );
}
