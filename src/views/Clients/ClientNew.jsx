import React, { useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { ArrowLeft, Users } from 'lucide-react';
import { Link, useHistory } from 'react-router-dom';
import ClientForm from '../../modules/clients/ui/ClientForm';
import ClientsModuleGate from '../../modules/clients/ui/ClientsModuleGate';
import { createClient } from '../../modules/clients/ui/clientApi';
import { CLIENTS_PERMISSIONS } from '../../modules/clients/ui/constants';
import { hasPermission } from '../../utils/workspaceAccess';
import { PageHeader } from '../../modules/clients/ui/components';
import '../../modules/clients/ui/clients-ui.css';

const ClientNew = () => {
    const history = useHistory();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (payload) => {
        setLoading(true);
        setError('');

        try {
            const data = await createClient(payload);
            history.push({
                pathname: `/apps/clients/${data.client.id}`,
                state: { flash: 'Cliente creato.' },
            });
        } catch (submitError) {
            setError(submitError?.message || 'Errore durante la creazione del cliente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ClientsModuleGate requiredPermission={CLIENTS_PERMISSIONS.create}>
            {({ access }) => (
                <div className="container-fluid clients-page-container">
                    <div className="clients-page-shell">
                        <PageHeader
                            icon={Users}
                            title="Nuovo cliente"
                            subtitle="Compila i dati anagrafici e i contatti principali."
                            breadcrumbs={[
                                { label: 'Clienti', to: '/apps/clients' },
                                { label: 'Nuovo', active: true },
                            ]}
                            actions={(
                                <>
                                    <Button as={Link} to="/apps/clients" variant="outline-secondary" className="d-inline-flex align-items-center gap-2">
                                        <ArrowLeft size={15} />
                                        Torna alla lista
                                    </Button>
                                </>
                        )}
                    />

                    <div className="clients-form-shell">
                        {error && <Alert variant="danger">{error}</Alert>}
                        <ClientForm
                            submitLabel="Salva"
                            onSubmit={handleSubmit}
                            onCancel={() => history.push('/apps/clients')}
                            loading={loading}
                            canCreateCustomFields={hasPermission(access, CLIENTS_PERMISSIONS.edit)}
                        />
                    </div>
                </div>
            </div>
            )}
        </ClientsModuleGate>
    );
};

export default ClientNew;
