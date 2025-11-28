// material
import { Container } from '@mui/material';
// redux
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// hooks
import useSettings from '../../hooks/useSettings';
// components
import Page from '../../components/Page';
import HeaderBreadcrumbs from '../../components/HeaderBreadcrumbs';
import JsonBuilderForm from '../../components/_dashboard/module/JsonBuilderForm';

export default function JsonBuilder() {
  const { themeStretch } = useSettings();

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading="Json Builder"
          links={[{ name: 'Json Builder', href: PATH_DASHBOARD.module.jsonBuilder }, { name: 'Create' }]}
          info="Json Builder"
        />
        <JsonBuilderForm />
      </Container>
    </Page>
  );
}
