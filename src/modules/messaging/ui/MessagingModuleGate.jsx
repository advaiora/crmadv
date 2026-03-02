import React from 'react';
import ModulePermissionGate from '../../../components/guards/ModulePermissionGate';
import {
  MESSAGING_MODULE_KEY,
  MESSAGING_PERMISSIONS,
} from './constants';

const MessagingModuleGate = ({
  requiredPermission = MESSAGING_PERMISSIONS.view,
  children,
}) => (
  <ModulePermissionGate
    requiredModule={MESSAGING_MODULE_KEY}
    requiredPermission={requiredPermission}
    moduleName="Messaggi"
  >
    {children}
  </ModulePermissionGate>
);

export default MessagingModuleGate;
