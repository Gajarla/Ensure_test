import { useEffect, useState } from 'react';
import { kebabCase } from 'change-case';
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
import ReleaseNewForm from '../../components/_dashboard/release/ReleaseNewForm';
import { getReleaseList } from '../../redux/slices/release';
import { getUserList } from '../../redux/slices/user';

// ----------------------------------------------------------------------

export default function ReleaseCreate() {
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const { releaseId } = useParams();
  const { appendUrl } = useSelector((state) => state.user);
  const { releaseList } = useSelector((state) => state.release);
  const isEdit = pathname.includes('edit');
  const release = releaseList?.find((release) => kebabCase(release._id) === releaseId);
  const [currentRelease, setCurrentRelease] = useState(null);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  useEffect(() => {
    dispatch(getReleaseList());
    if (release) setCurrentRelease(release);
    dispatch(getUserList());
  }, [dispatch, release]);

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading={!isEdit ? 'Create a new release' : 'Edit release'}
          links={[
            { name: 'Releases', href: getUrl(PATH_DASHBOARD.release.allReleases) },
            { name: !isEdit ? 'New Release' : currentRelease?.releaseName }
          ]}
          info="To create a release, you must be an administrator, or your role must have the privileges"
        />
        <ReleaseNewForm isEdit={isEdit} currentRelease={currentRelease} />
      </Container>
    </Page>
  );
}
