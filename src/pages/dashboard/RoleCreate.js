import { useEffect } from 'react';
import { kebabCase } from 'change-case';
import { useParams, useLocation } from 'react-router-dom';
// material
import { Container } from '@mui/material';
// redux
import { useDispatch, useSelector } from '../../redux/store';
import { getUserList } from '../../redux/slices/user';
import { getRolesList } from '../../redux/slices/role';
import { getCompaniesList } from '../../redux/slices/company';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import RoleNewForm from '../../components/_dashboard/role/RoleNewForm';

// ----------------------------------------------------------------------

export default function UserCreate() {
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const { roleId } = useParams();
  const { rolesList } = useSelector((state) => state.role);
  const isEdit = pathname.includes('edit');
  const currentRole = rolesList.find((role) => kebabCase(role._id) === roleId);

  useEffect(() => {
    dispatch(getUserList());
    dispatch(getRolesList());
    dispatch(getCompaniesList());
  }, [dispatch]);

  return (
    <Page title="TestEnsure: Create a new Role">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading={!isEdit ? 'Create a new role' : 'Edit role'}
          links={[
            { name: 'All Roles', href: PATH_DASHBOARD.role.allRoles },
            { name: !isEdit ? 'New Role' : `${currentRole?.roleName}` }
          ]}
        />

        <RoleNewForm isEdit={isEdit} currentRole={currentRole} />
      </Container>
    </Page>
  );
}
