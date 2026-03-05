import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Placeholder } from 'react-bootstrap';
import { ArrowLeft, Users } from 'lucide-react';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import ClientForm, { mapClientToFormValues } from '../../modules/clients/ui/ClientForm';
import ClientsModuleGate from '../../modules/clients/ui/ClientsModuleGate';
import { getClient, updateClient } from '../../modules/clients/ui/clientApi';
import { CLIENTS_PERMISSIONS } from '../../modules/clients/ui/constants';
import { PageHeader } from '../../modules/clients/ui/components';
import '../../modules/clients/ui/clients-ui.css';

const ClientEdit = () => {
    const history = useHistory();
    const location = useLocation();
    const { id } = useParams();

    const [client, setClient] = useState(null);
    const [loadingClient, setLoadingClient] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const listSearch = location.state?.fromListSearch || '';

    const loadClient = useCallback(async () => {
        setLoadingClient(true);
        setError('');

        try {
            const data = await getClient(id);
            setClient(data.client);
        } catch (loadError) {
            setError(loadError?.message || 'Errore durante il caricamento del cliente.');
        } finally {
            setLoadingClient(false);
        }
    }, [id]);

    useEffect(() => {
        void loadClient();
    }, [loadClient]);

    const handleSubmit = async (payload) => {
        setSaving(true);
        setError('');

        try {
            await updateClient(id, payload);
            history.push({
                pathname: `/apps/clients/${id}`,
                state: {
                    fromListSearch: listSearch,
                    flash: 'Modifiche salvate.',
                },
            });
        } catch (submitError) {
            setError(submitError?.message || 'Errore durante il salvataggio del cliente.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ClientsModuleGate requiredPermission={CLIENTS_PERMISSIONS.edit}>
            <div className="container-fluid clients-page-container">
                <div className="clients-page-shell">
                    <PageHeader
                        icon={Users}
                        title={client ? `Modifica ${client.name}` : 'Modifica cliente'}
                        subtitle="Aggiorna i dati anagrafici del cliente."
                        breadcrumbs={[
                            { label: 'Clienti', to: `/apps/clients${listSearch}` },
                            { label: client?.name || 'Dettaglio', to: `/apps/clients/${id}` },
                            { label: 'Modifica', active: true },
                        ]}
                        actions={(
                            <>
                                <Button
                                    as={Link}
                                    to={{
                                        pathname: `/apps/clients/${id}`,
                                        state: { fromListSearch: listSearch },
                                    }}
                                    variant="outline-secondary"
                                    className="d-inline-flex align-items-center gap-2"
                                >
                                    <ArrowLeft size={15} />
                                    Annulla
                                </Button>
                            </>
                        )}
                    />

                    <div className="clients-form-shell">
                        {error && <Alert variant="danger">{error}</Alert>}

                        {loadingClient ? (
                            <Card className="clients-form-loading card-border">
                                <Card.Body>
                                    <Placeholder as="div" animation="glow">
                                        <Placeholder xs={12} className="mb-2" />
                                        <Placeholder xs={11} className="mb-2" />
                                        <Placeholder xs={10} />
                                    </Placeholder>
                                </Card.Body>
                            </Card>
                        ) : (
                            <ClientForm
                                initialValues={mapClientToFormValues(client)}
                                submitLabel="Salva"
                                onSubmit={handleSubmit}
                                onCancel={() => history.push({
                                    pathname: `/apps/clients/${id}`,
                                    state: { fromListSearch: listSearch },
                                })}
                                loading={saving}
                            />
                        )}
                    </div>
                </div>
            </div>
        </ClientsModuleGate>
    );
};

export default ClientEdit;
