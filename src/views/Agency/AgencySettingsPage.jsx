import React from "react";
import { Col, Row } from "react-bootstrap";
import AgencyPageShell from "./AgencyPageShell";
import AgencyAiUsagePanel from "./AgencyAiUsagePanel";
import AgencyAiBudgetPanel from "./AgencyAiBudgetPanel";
import SettingsAiProviderCard from "./settings/SettingsAiProviderCard";
import SettingsProjectTypesCard from "./settings/SettingsProjectTypesCard";
import SettingsScopeSourcesCard from "./settings/SettingsScopeSourcesCard";
import SettingsTeamRolesCard from "./settings/SettingsTeamRolesCard";
import SettingsModulesCard from "./settings/SettingsModulesCard";
import { useAgencySettings } from "./settings/hooks/useAgencySettings";

const AgencySettingsPage = () => {
  const isDev = Boolean(import.meta.env.DEV);
  const settings = useAgencySettings();

  return (
    <AgencyPageShell
      title="Impostazioni Agency"
      subtitle="Configurazione operativa Agency AI OS derivata da cataloghi, runtime server e regole di sicurezza."
      breadcrumbs={[
        { label: "Dashboard", to: "/dashboard" },
        { label: "Agency", to: "/agency/projects" },
        { label: "Impostazioni Agency" },
      ]}
    >
      <Row className="g-3">
        <Col lg={12}>
          <SettingsAiProviderCard
            aiStatus={settings.aiStatus}
            competitorSearchSettings={settings.competitorSearchSettings}
            form={settings.runtimeForm}
            canManage={settings.canManage}
            storageReady={settings.storageReady}
            saveState={settings.saveState}
            activeModels={settings.activeModels}
            activeProviders={settings.activeProviders}
            selectedModelOption={settings.selectedModelOption}
            aiApiKeyConfigured={settings.aiApiKeyConfigured}
            anthropicApiKeyConfigured={settings.anthropicApiKeyConfigured}
            onFieldChange={settings.updateFormField}
            onSelectModel={settings.selectAiModel}
            onSubmit={settings.handleSaveRuntimeSettings}
            onRefresh={settings.refreshSettings}
            clearKeysProvider={settings.clearKeysProvider}
            onClearKeysProviderChange={settings.setClearKeysProvider}
            onClearKeys={settings.handleClearKeys}
          />
        </Col>

        {settings.canManage && (
          <Col lg={12}>
            <AgencyAiUsagePanel />
          </Col>
        )}

        {settings.canManage && (
          <Col lg={12}>
            <AgencyAiBudgetPanel />
          </Col>
        )}

        <Col lg={6}>
          <SettingsProjectTypesCard />
        </Col>

        <Col lg={6}>
          <SettingsScopeSourcesCard isDev={isDev} />
        </Col>

        <Col lg={6}>
          <SettingsTeamRolesCard />
        </Col>

        <Col lg={6}>
          <SettingsModulesCard />
        </Col>
      </Row>
    </AgencyPageShell>
  );
};

export default AgencySettingsPage;
