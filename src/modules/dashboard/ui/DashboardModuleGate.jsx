import React from 'react';
import ModulePermissionGate from '../../../components/guards/ModulePermissionGate';
import { DASHBOARD_MODULE_KEY, DASHBOARD_PERMISSIONS } from './constants';

const DashboardModuleGate = ({
  requiredPermission = DASHBOARD_PERMISSIONS.view,
  children,
}) => (
  <ModulePermissionGate
    requiredModule={DASHBOARD_MODULE_KEY}
    requiredPermission={requiredPermission}
    moduleName="Dashboard"
  >
    {children}
  </ModulePermissionGate>
);

export default DashboardModuleGate;
