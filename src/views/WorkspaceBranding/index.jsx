import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import ModulePermissionGate from '../../components/guards/ModulePermissionGate';
import { ApiRequestError, apiPut } from '../../utils/apiClient';
import { normalizeWorkspaceBranding } from '../../lib/workspaceBranding';

const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_LOGO_WIDTH_PX = 1200;
const MAX_LOGO_HEIGHT_PX = 400;
const DEFAULT_PRIMARY_COLOR = '#0d6efd';
const DEFAULT_SECONDARY_COLOR = '#6c757d';

const asNonEmptyOrNull = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const mapBrandingToFormState = (branding) => {
  const normalizedBranding = normalizeWorkspaceBranding(branding) || {
    primaryColor: DEFAULT_PRIMARY_COLOR,
    secondaryColor: DEFAULT_SECONDARY_COLOR,
  };

  return {
    companyName: branding?.companyName || '',
    logoUrl: normalizedBranding.logoUrl || '',
    primaryColor: normalizedBranding.primaryColor,
    secondaryColor: normalizedBranding.secondaryColor,
    supportEmail: branding?.supportEmail || '',
  };
};

const readImageDimensions = (imageUrl) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('Impossibile leggere le dimensioni del logo.'));
        return;
      }

      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => reject(new Error('Il logo non e raggiungibile o non e valido.'));
    image.src = imageUrl;
  });

const validateLogoDimensions = ({ width, height }) => {
  if (width > MAX_LOGO_WIDTH_PX || height > MAX_LOGO_HEIGHT_PX) {
    return `Il logo supera il limite massimo: ${MAX_LOGO_WIDTH_PX}x${MAX_LOGO_HEIGHT_PX}px.`;
  }

  return null;
};

const ensureValidLogoImage = async (logoUrl) => {
  const dimensions = await readImageDimensions(logoUrl);
  const validationError = validateLogoDimensions(dimensions);
  if (validationError) {
    throw new Error(validationError);
  }

  return dimensions;
};

const BrandingForm = ({ access, reloadAccess }) => {
  const location = useLocation();
  const onboardingFlow = useMemo(
    () => new URLSearchParams(location.search).get('onboarding') === '1',
    [location.search],
  );

  const workspaceId = access?.workspace?.id;
  const [formState, setFormState] = useState(() => mapBrandingToFormState(access?.branding));
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [logoDimensions, setLogoDimensions] = useState(null);

  const logoPreview = formState.logoUrl || null;

  const updateFormField = (fieldName, fieldValue) => {
    setFormState((current) => ({
      ...current,
      [fieldName]: fieldValue,
    }));
  };

  const handleLogoUpload = async (event) => {
    setErrorMessage('');
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    if (selectedFile.size > MAX_LOGO_FILE_SIZE_BYTES) {
      setErrorMessage('Il logo supera 2MB. Carica un file piu leggero.');
      return;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Impossibile leggere il file selezionato.'));
      reader.readAsDataURL(selectedFile);
    }).catch((error) => {
      setErrorMessage(error?.message || 'Errore durante il caricamento del logo.');
      return null;
    });

    if (!dataUrl) {
      return;
    }

    const dimensions = await ensureValidLogoImage(dataUrl).catch((error) => {
      setErrorMessage(error?.message || 'Errore durante la verifica del logo.');
      return null;
    });

    if (!dimensions) {
      return;
    }

    setLogoDimensions(dimensions);
    updateFormField('logoUrl', dataUrl);
  };

  const handleLogoUrlBlur = async () => {
    const normalizedLogoUrl = asNonEmptyOrNull(formState.logoUrl);
    if (!normalizedLogoUrl) {
      setLogoDimensions(null);
      return;
    }

    const dimensions = await ensureValidLogoImage(normalizedLogoUrl).catch((error) => {
      setLogoDimensions(null);
      setErrorMessage(error?.message || 'Errore durante la verifica del logo.');
      return null;
    });

    if (!dimensions) {
      return;
    }

    setErrorMessage('');
    setLogoDimensions(dimensions);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!workspaceId) {
      setErrorMessage('Workspace non disponibile. Ricarica la pagina.');
      return;
    }

    setSaving(true);

    try {
      const normalizedLogoUrl = asNonEmptyOrNull(formState.logoUrl);
      if (normalizedLogoUrl) {
        const dimensions = await ensureValidLogoImage(normalizedLogoUrl);
        setLogoDimensions(dimensions);
      } else {
        setLogoDimensions(null);
      }

      const payload = {
        companyName: asNonEmptyOrNull(formState.companyName),
        logoUrl: normalizedLogoUrl,
        primaryColor: formState.primaryColor,
        secondaryColor: formState.secondaryColor,
        supportEmail: asNonEmptyOrNull(formState.supportEmail),
      };

      const result = await apiPut(`/workspaces/${workspaceId}/branding`, payload);
      updateFormField('companyName', result?.branding?.companyName || '');
      updateFormField('logoUrl', result?.branding?.logoUrl || '');
      updateFormField('primaryColor', result?.branding?.primaryColor || DEFAULT_PRIMARY_COLOR);
      updateFormField('secondaryColor', result?.branding?.secondaryColor || DEFAULT_SECONDARY_COLOR);
      updateFormField('supportEmail', result?.branding?.supportEmail || '');
      await reloadAccess();
      setSuccessMessage('Branding aggiornato con successo.');
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Errore durante il salvataggio del branding.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container>
      <div className="hk-pg-header pt-7">
        <div className="d-flex flex-wrap justify-content-between flex-1">
          <div className="mb-3">
            <h1 className="pg-title">Branding Workspace</h1>
            <p className="mb-0 text-muted">
              Configura logo, colori principali e nome aziendale per personalizzare la tua area.
            </p>
          </div>
        </div>
      </div>

      <div className="hk-pg-body">
        {onboardingFlow && (
          <Alert variant="info" className="mb-3">
            Benvenuto. Completa il branding iniziale del workspace.
          </Alert>
        )}
        {successMessage && (
          <Alert variant="success" className="mb-3">
            {successMessage}
          </Alert>
        )}
        {errorMessage && (
          <Alert variant="danger" className="mb-3">
            {errorMessage}
          </Alert>
        )}

        <Card className="card-border">
          <Card.Body>
            <Form onSubmit={handleSubmit}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group controlId="brandingCompanyName">
                    <Form.Label>Nome azienda</Form.Label>
                    <Form.Control
                      type="text"
                      value={formState.companyName}
                      onChange={(event) => updateFormField('companyName', event.target.value)}
                      placeholder="Es. Advaiora Agency"
                      maxLength={80}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="brandingSupportEmail">
                    <Form.Label>Email supporto</Form.Label>
                    <Form.Control
                      type="email"
                      value={formState.supportEmail}
                      onChange={(event) => updateFormField('supportEmail', event.target.value)}
                      placeholder="support@azienda.it"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="brandingPrimaryColor">
                    <Form.Label>Colore primario</Form.Label>
                    <Form.Control
                      type="color"
                      value={formState.primaryColor}
                      onChange={(event) => updateFormField('primaryColor', event.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="brandingSecondaryColor">
                    <Form.Label>Colore secondario</Form.Label>
                    <Form.Control
                      type="color"
                      value={formState.secondaryColor}
                      onChange={(event) => updateFormField('secondaryColor', event.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group controlId="brandingLogoUrl">
                    <Form.Label>Logo URL</Form.Label>
                    <Form.Control
                      type="url"
                      value={formState.logoUrl}
                      onChange={(event) => {
                        setLogoDimensions(null);
                        updateFormField('logoUrl', event.target.value);
                      }}
                      onBlur={handleLogoUrlBlur}
                      placeholder="https://example.com/logo.png"
                    />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group controlId="brandingLogoUpload">
                    <Form.Label>Carica logo</Form.Label>
                    <Form.Control type="file" accept="image/*" onChange={handleLogoUpload} />
                    <Form.Text className="text-muted">
                      PNG/JPG/WebP, massimo 2MB e massimo {MAX_LOGO_WIDTH_PX}x{MAX_LOGO_HEIGHT_PX}px.
                    </Form.Text>
                  </Form.Group>
                </Col>
                {logoPreview && (
                  <Col md={12}>
                    <div className="d-flex align-items-center gap-3 p-3 border rounded">
                      <img
                        src={logoPreview}
                        alt="Anteprima logo workspace"
                        style={{ maxHeight: 56, maxWidth: 180, objectFit: 'contain' }}
                      />
                      {logoDimensions && (
                        <span className="text-muted small">
                          {logoDimensions.width}x{logoDimensions.height}px
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline-danger"
                        size="sm"
                        onClick={() => {
                          setLogoDimensions(null);
                          updateFormField('logoUrl', '');
                        }}
                      >
                        Rimuovi logo
                      </Button>
                    </div>
                  </Col>
                )}
              </Row>

              <div className="d-flex justify-content-end mt-4">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <span className="d-inline-flex align-items-center">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Salvataggio...
                    </span>
                  ) : (
                    'Salva branding'
                  )}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
};

const WorkspaceBranding = () => (
  <ModulePermissionGate
    requiredModule="branding"
    requiredPermission="branding.manage"
    moduleName="Branding"
  >
    {({ access, reload }) => <BrandingForm access={access} reloadAccess={reload} />}
  </ModulePermissionGate>
);

export default WorkspaceBranding;
