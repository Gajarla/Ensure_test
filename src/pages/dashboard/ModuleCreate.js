import { useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
// material
import { Container } from '@mui/material';
// redux
import { useDispatch, useSelector } from '../../redux/store';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import ModuleNewForm from '../../components/_dashboard/module/ModuleNewForm';
import { getModuleList } from '../../redux/slices/module';
import { getUserList } from '../../redux/slices/user';

// ----------------------------------------------------------------------

export default function ModuleCreate() {
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const { moduleId } = useParams();
  const { userList, appendUrl } = useSelector((state) => state.user);
  const { moduleList } = useSelector((state) => state.module);
  const isEdit = pathname.includes('edit');
  const currentModule = moduleList?.find((module) => module._id === moduleId);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  useEffect(() => {
    dispatch(getModuleList());
    dispatch(getUserList());
  }, [dispatch]);

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading={!isEdit ? 'Create a new Module' : 'Edit module'}
          links={[
            { name: 'All Modules', href: getUrl(PATH_DASHBOARD.module.allModules) },
            { name: !isEdit ? 'New module' : currentModule?.suiteName }
          ]}
          info="To create a module, you must be an administrator, or your role must have the privileges"
        />

        <ModuleNewForm isEdit={isEdit} currentModule={currentModule} userList={userList} />
      </Container>
    </Page>
  );
}
