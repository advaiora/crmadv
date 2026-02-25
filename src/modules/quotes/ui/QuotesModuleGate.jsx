import React from 'react';
import ModulePermissionGate from '../../../components/guards/ModulePermissionGate';
import { QUOTES_MODULE_KEY, QUOTES_PERMISSIONS } from './constants';

const QuotesModuleGate = ({ requiredPermission = QUOTES_PERMISSIONS.view, children }) => (
  <ModulePermissionGate
    requiredModule={QUOTES_MODULE_KEY}
    requiredPermission={requiredPermission}
    moduleName="Preventivi"
  >
    {children}
  </ModulePermissionGate>
);

export default QuotesModuleGate;
