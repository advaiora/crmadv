import React from 'react';
import ModulePermissionGate from '../../../components/guards/ModulePermissionGate';
import { WEB_ASSETS_MODULE_KEY, WEB_ASSETS_PERMISSIONS } from './constants';

const WebAssetsModuleGate = ({
  requiredPermission = WEB_ASSETS_PERMISSIONS.view,
  children,
}) => (
  <ModulePermissionGate
    requiredModule={WEB_ASSETS_MODULE_KEY}
    requiredPermission={requiredPermission}
    moduleName="Asset Web"
  >
    {children}
  </ModulePermissionGate>
);

export default WebAssetsModuleGate;

