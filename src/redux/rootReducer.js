import { combineReducers } from 'redux';
import storage from 'redux-persist/lib/storage';
// slices
import companyReducer from './slices/company';
import userReducer from './slices/user';
import projectReducer from './slices/project';
import moduleReducer from './slices/module';
import releaseReducer from './slices/release';
import roleReducer from './slices/role';
import testRunReducer from './slices/testRun';
import auditLogReducer from './slices/auditLog';
import defectReducer from './slices/defect';
import licenseReducer from './slices/license';

// ----------------------------------------------------------------------

const rootPersistConfig = {
  key: 'root',
  storage,
  keyPrefix: 'redux-',
  // This ensures the license state remains even after a page reload (stored in localStorage by default).
  whitelist: ['license']
};

const rootReducer = combineReducers({
  auditLog: auditLogReducer,
  company: companyReducer,
  defect: defectReducer,
  module: moduleReducer,
  project: projectReducer,
  release: releaseReducer,
  role: roleReducer,
  testRun: testRunReducer,
  user: userReducer,
  license: licenseReducer
});

export { rootPersistConfig, rootReducer };
