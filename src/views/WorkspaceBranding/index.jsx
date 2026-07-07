import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import ModulePermissionGate from '../../components/guards/ModulePermissionGate';
import { ApiRequestError, apiPut } from '../../utils/apiClient';
import { normalizeWorkspaceBranding } from '../../lib/workspaceBranding';
import {
  BRANDING_PALETTE,
  getDefaultPreset,
  getPresetAccents,
  getSelectedPresetId,
  suggestPresetFromColor,
} from '../../lib/brandingPalette';
import { extractDominantColor } from '../../lib/logoColor';
import { useTheme } from '../../utils/theme-provider/theme-provider';

const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_LOGO_WIDTH_PX = 1200;
const MAX_LOGO_HEIGHT_PX = 400;

const asNonEmptyOrNull = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

// Colore di testo (nero/bianco) leggibile sopra una tinta accento, per l'anteprima.
const parseAccentRgb = (hexColor) => ({
  r: Number.parseInt(hexColor.slice(1, 3), 16),
  g: Number.parseInt(hexColor.slice(3, 5), 16),
  b: Number.parseInt(hexColor.slice(5, 7), 16),
});

const readableTextOnAccent = (hexColor) => {
  const { r, g, b } = parseAccentRgb(hexColor);
  const perceivedLuminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return perceivedLuminance > 0.6 ? '#111111' : '#ffffff';
};

const softAccentBackground = (hexColor, alpha) => {
  const { r, g, b } = parseAccentRgb(hexColor);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const mapBrandingToFormState = (branding) => {
  const normalizedBranding = normalizeWorkspaceBranding(branding) || {
    primaryColor: getDefaultPreset().light,
  };

  // Se il colore salvato non corrisponde a un preset (workspace nuovo o colore
  // legacy libero), si parte dal preset di default cosi' una tinta e' sempre
  // selezionata. Il cambiamento viene salvato solo quando l'utente conferma.
  const primaryColor = getSelectedPresetId(normalizedBranding.primaryColor)
    ? normalizedBranding.primaryColor
    : getDefaultPreset().light;

  return {
    companyName: branding?.companyName || '',
    logoUrl: normalizedBranding.logoUrl || '',
    primaryColor,
    supportEmail: branding?.supportEmail || '',
  };
};

// Pannello di anteprima dell'accento per un singolo tema (chiaro o scuro).
// La classe theme (.light/.dark) fa risolvere i token neutri del rispettivo tema;
// l'accento e' passato esplicito perche' cambia tra i due temi.
const AccentPreviewPanel = ({ themeClass, accentColor, label }) => (
  <div
    className={themeClass}
    style={{
      flex: 1,
      minWidth: 190,
      borderRadius: 12,
      border: '1px solid var(--border)',
      background: 'var(--card)',
      color: 'var(--foreground)',
      padding: 16,
    }}
  >
    <div className="d-flex justify-content-between align-items-center mb-3">
      <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 999,
          backgroundColor: softAccentBackground(accentColor, 0.16),
          color: accentColor,
        }}
      >
        Attivo
      </span>
    </div>
    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
      Testo secondario di esempio, resta leggibile.
    </div>
    <div className="d-flex align-items-center gap-3">
      <span
        style={{
          backgroundColor: accentColor,
          color: readableTextOnAccent(accentColor),
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Azione
      </span>
      <span style={{ color: accentColor, fontSize: 13, fontWeight: 500 }}>Collegamento</span>
    </div>
  </div>
);

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

  const { theme } = useTheme();
  const workspaceId = access?.workspace?.id;
  const [formState, setFormState] = useState(() => mapBrandingToFormState(access?.branding));
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [logoDimensions, setLogoDimensions] = useState(null);
  const [suggestedPresetId, setSuggestedPresetId] = useState(null);

  const logoPreview = formState.logoUrl || null;
  const selectedPresetId = getSelectedPresetId(formState.primaryColor);
  const previewAccents = getPresetAccents(formState.primaryColor);
  const suggestedPresetName =
    BRANDING_PALETTE.find((preset) => preset.id === suggestedPresetId)?.name ?? null;

  // Dal logo caricato ricava la tinta della palette piu' vicina (solo suggerimento,
  // non applica nulla: l'utente conferma cliccando lo swatch evidenziato).
  const refreshLogoSuggestion = async (logoUrl) => {
    if (!logoUrl) {
      setSuggestedPresetId(null);
      return;
    }

    const dominantColor = await extractDominantColor(logoUrl);
    setSuggestedPresetId(dominantColor ? suggestPresetFromColor(dominantColor).id : null);
  };

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
    refreshLogoSuggestion(dataUrl);
  };

  const handleLogoUrlBlur = async () => {
    const normalizedLogoUrl = asNonEmptyOrNull(formState.logoUrl);
    if (!normalizedLogoUrl) {
      setLogoDimensions(null);
      setSuggestedPresetId(null);
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
    refreshLogoSuggestion(normalizedLogoUrl);
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

      // Il colore secondario non e' piu' modificabile dall'utente: resta ai token
      // del tema (neutra), quindi non viene inviato.
      const payload = {
        companyName: asNonEmptyOrNull(formState.companyName),
        logoUrl: normalizedLogoUrl,
        primaryColor: formState.primaryColor,
        supportEmail: asNonEmptyOrNull(formState.supportEmail),
      };

      const result = await apiPut(`/workspaces/${workspaceId}/branding`, payload);
      updateFormField('companyName', result?.branding?.companyName || '');
      updateFormField('logoUrl', result?.branding?.logoUrl || '');
      updateFormField('primaryColor', result?.branding?.primaryColor || getDefaultPreset().light);
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
                <Col md={12}>
                  <Form.Group controlId="brandingAccentColor">
                    <Form.Label>Colore accento</Form.Label>
                    <Form.Text className="d-block text-muted mb-2">
                      Scegli una tinta dalla palette. Ogni tinta e gia bilanciata per restare
                      leggibile sia in tema chiaro sia in tema scuro.
                    </Form.Text>
                    <div className="d-flex flex-wrap gap-2" role="group" aria-label="Palette accento">
                      {BRANDING_PALETTE.map((preset) => {
                        const isSelected = preset.id === selectedPresetId;
                        const isSuggested = preset.id === suggestedPresetId && !isSelected;
                        const swatchColor = theme === 'dark' ? preset.dark : preset.light;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => updateFormField('primaryColor', preset.light)}
                            title={preset.name}
                            aria-label={preset.name}
                            aria-pressed={isSelected}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              backgroundColor: swatchColor,
                              border: isSelected
                                ? '2px solid var(--foreground)'
                                : '1px solid var(--border)',
                              outline: isSuggested ? '2px dashed var(--brand-accent)' : 'none',
                              outlineOffset: 2,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: readableTextOnAccent(swatchColor),
                              fontSize: 16,
                              lineHeight: 1,
                              padding: 0,
                            }}
                          >
                            {isSelected ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                    {suggestedPresetName && (
                      <Form.Text className="d-block mt-2">
                        Suggerito dal logo: <strong>{suggestedPresetName}</strong> (tinta evidenziata).
                        Clicca per applicarla.
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Label>Anteprima</Form.Label>
                  <div className="d-flex flex-wrap gap-3">
                    <AccentPreviewPanel
                      themeClass="light"
                      accentColor={previewAccents.light}
                      label="Tema chiaro"
                    />
                    <AccentPreviewPanel
                      themeClass="dark"
                      accentColor={previewAccents.dark}
                      label="Tema scuro"
                    />
                  </div>
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
                          setSuggestedPresetId(null);
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
