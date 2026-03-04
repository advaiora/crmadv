import React from 'react';
import ModulePermissionGate from '../../../components/guards/ModulePermissionGate';
import { TEAM_MODULE_KEY, TEAM_PERMISSIONS } from './constants';

const TeamModuleGate = ({
  requiredPermission = TEAM_PERMISSIONS.view,
  children,
}) => (
  <ModulePermissionGate
    requiredModule={TEAM_MODULE_KEY}
    requiredPermission={requiredPermission}
    moduleName="Team"
  >
    {children}
  </ModulePermissionGate>
);

export default TeamModuleGate;
