import homeFill from '@iconify/icons-eva/home-fill';
import { Icon } from '@iconify/react';
// routes
import { PATH_DASHBOARD } from '../../routes/paths';
// components
import SvgIconStyle from '../../components/SvgIconStyle';

// ----------------------------------------------------------------------

const getIcon = (name) => (
  <SvgIconStyle src={`/static/icons/navbar/${name}.svg`} sx={{ width: '100%', height: '100%' }} />
);

const ICONS = {
  blog: getIcon('ic_blog'),
  cart: getIcon('ic_cart'),
  chat: getIcon('ic_chat'),
  mail: getIcon('ic_mail'),
  user: getIcon('ic_user'),
  kanban: getIcon('ic_kanban'),
  banking: getIcon('ic_banking'),
  calendar: getIcon('ic_calendar'),
  ecommerce: getIcon('ic_ecommerce'),
  analytics: getIcon('ic_analytics'),
  dashboard: getIcon('ic_dashboard'),
  booking: getIcon('ic_booking'),
  testRuns: getIcon('ic_design'),
  projects: getIcon('ic_allprojects'),
  magicJSON: getIcon('ic_magicJSON')
};

const sidebarConfig = [
  // GENERAL
  // ----------------------------------------------------------------------
  {
    items: [
      {
        title: 'Home',
        path: PATH_DASHBOARD.details.home,
        icon: <Icon icon={homeFill} width={20} height={20} />,
        roles: ['R0001', 'R0002', 'R0003', 'R0004', 'R0005', 'R0006']
      }
    ]
  },
  {
    items: [
      {
        title: 'Users',
        path: PATH_DASHBOARD.user.allUsers,
        icon: ICONS.user,
        roles: ['R0001', 'R0002']
      },
      // {
      //   title: 'Clients',
      //   path: PATH_DASHBOARD.company.allCompanies,
      //   icon: ICONS.kanban,
      //   roles: ['R0001']
      // },
      {
        title: 'Roles',
        path: PATH_DASHBOARD.role.allRoles,
        icon: ICONS.kanban,
        roles: ['R0001']
      },
      {
        title: 'Role Configurator',
        path: PATH_DASHBOARD.role.configurator,
        icon: ICONS.kanban,
        roles: ['R0002']
      }
    ]
  },
  {
    items: [
      {
        title: 'GenAI Test Cases',
        path: PATH_DASHBOARD.genai.testCases,
        icon: ICONS.magicJSON,
        roles: ['R0002', 'R0003', 'R0004', 'R0005', 'R0006']
      }
    ]
  },
  {
    items: [
      {
        title: 'Projects',
        path: PATH_DASHBOARD.project.allProjects,
        icon: ICONS.projects,
        roles: ['R0002', 'R0003', 'R0004', 'R0005', 'R0006']
      }
    ]
  }
  // {
  //   items: [
  //     {
  //       title: 'Audit Log',
  //       path: PATH_DASHBOARD.auditLog.auditLog,
  //       icon: ICONS.kanban
  //     }
  //   ]
  // }

  // MANAGEMENT
  // ----------------------------------------------------------------------
  // {
  //   subheader: 'management',
  //   items: [
  //     // MANAGEMENT : USER
  //     {
  //       title: 'user',
  //       path: PATH_DASHBOARD.user.root,
  //       icon: ICONS.user,
  //       children: [
  //         { title: 'profile', path: PATH_DASHBOARD.user.profile },
  //         { title: 'cards', path: PATH_DASHBOARD.user.cards },
  //         { title: 'list', path: PATH_DASHBOARD.user.list },
  //         { title: 'create', path: PATH_DASHBOARD.user.newUser },
  //         { title: 'edit', path: PATH_DASHBOARD.user.editById },
  //         { title: 'account', path: PATH_DASHBOARD.user.account }
  //       ]
  //     }
  //   ]
  // }
];

export default sidebarConfig;
