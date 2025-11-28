import { useEffect } from 'react';
import { kebabCase } from 'change-case';
import { useParams, useLocation } from 'react-router-dom';
// material
import { Container } from '@mui/material';
// redux
import { useDispatch, useSelector } from '../../redux/store';
import { getUserList } from '../../redux/slices/user';
import { getCompaniesList } from '../../redux/slices/company';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import CompanyNewForm from '../../components/_dashboard/company/CompanyNewForm';

// ----------------------------------------------------------------------

export default function UserCreate() {
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const { companyId } = useParams();
  const { userList } = useSelector((state) => state.user);
  const { companyList } = useSelector((state) => state.company);
  const isEdit = pathname.includes('edit');
  const currentCompany = companyList.find((company) => kebabCase(company._id) === companyId);

  useEffect(() => {
    if (!userList) dispatch(getUserList());
    if (!companyList) dispatch(getCompaniesList());
  }, [dispatch, companyList, userList]);

  return (
    <Page title="TestEnsure: Create a new Company">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading={!isEdit ? 'Create a new company' : 'Edit company'}
          links={[
            { name: 'All Companies', href: PATH_DASHBOARD.company.allCompanies },
            { name: !isEdit ? 'New company' : `${currentCompany?.company}` }
          ]}
        />

        <CompanyNewForm isEdit={isEdit} currentCompany={currentCompany} />
      </Container>
    </Page>
  );
}
