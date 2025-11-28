import { useState, useEffect } from 'react';
// import { paramCase } from 'change-case';
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
import ProjectNewForm from '../../components/_dashboard/project/ProjectNewForm';
// import { getProjectList } from '../../redux/slices/project';
import { getProject } from '../../_apis_/project';
import { getUserList } from '../../redux/slices/user';

// ----------------------------------------------------------------------

export default function ProjectCreate() {
  const { themeStretch } = useSettings();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const { projectId } = useParams();
  const { userList, currentUser, appendUrl } = useSelector((state) => state.user);
  // const { projectList } = useSelector((state) => state.project);
  const isEdit = pathname.includes('edit');
  const [currentProject, setCurrentProject] = useState(null);

  const getUrl = (url) => {
    let newUrl = url;
    if (appendUrl) newUrl = `${url}?${appendUrl}`;
    return newUrl;
  };

  useEffect(() => {
    // dispatch(getProjectList());
    const fetchData = async () => {
      if (projectId) {
        const project = await getProject(projectId);
        setCurrentProject(project);
      }
    };
    fetchData();
  }, [dispatch, projectId]);

  useEffect(() => {
    dispatch(getUserList());
  }, [dispatch, projectId]);

  return (
    <Page title="Test Ensure">
      <Container maxWidth={themeStretch ? false : 'xl'}>
        <HeaderBreadcrumbs
          heading={!isEdit ? 'Create a new project' : 'Edit project'}
          links={[
            { name: 'Projects', href: getUrl(PATH_DASHBOARD.project.allProjects) },
            { name: !isEdit ? 'New project' : currentProject?.name }
          ]}
          info="To create a project, you must be an administrator, or your role must have the privileges"
        />

        <ProjectNewForm isEdit={isEdit} currentUser={currentUser} currentProject={currentProject} userList={userList} />
      </Container>
    </Page>
  );
}
