import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Form, Spinner, Table } from "react-bootstrap";
import { getAgencyAiBudgets, saveAgencyAiBudgets } from "../../modules/agency-os/data/agencyDataAdapter";

// Config del budget AI giornaliero (V4 — cost control). Default del workspace +
// override per dipendente. Il limite in USD è il tetto di spesa AI al giorno per
// utente; 0 = nessun limite. La spesa odierna è mostrata accanto a ogni dipendente.
// Vive in Impostazioni AI (accesso super-admin di workspace).

const formatUsd = (value) => `$${Number(value || 0).toFixed(2)}`;

const AgencyAiBudgetPanel = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [defaultLimit, setDefaultLimit] = useState("0");
  const [members, setMembers] = useState([]);
  // Override per utente come stringhe di input (vuoto = usa il default).
  const [overrides, setOverrides] = useState({});

  const applyData = useCallback((data) => {
    setDefaultLimit(String(data?.defaultDailyLimitUsd ?? 0));
    const list = Array.isArray(data?.members) ? data.members : [];
    setMembers(list);
    const nextOverrides = {};
    for (const member of list) {
      nextOverrides[member.userId] =
        member.overrideDailyLimitUsd === null || member.overrideDailyLimitUsd === undefined
          ? ""
          : String(member.overrideDailyLimitUsd);
    }
    setOverrides(nextOverrides);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAgencyAiBudgets();
      applyData(data);
    } catch (err) {
      setError(err?.message || "Impossibile caricare i budget AI.");
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  useEffect(() => {
    void load();
  }, [load]);

  const defaultLimitNumber = useMemo(() => {
    const parsed = Number(defaultLimit);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [defaultLimit]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback("");
    setError("");
    try {
      const payload = {
        defaultDailyLimitUsd: defaultLimitNumber,
        overrides: members.map((member) => {
          const raw = (overrides[member.userId] ?? "").trim();
          return {
            userId: member.userId,
            dailyLimitUsd: raw === "" ? null : Number(raw),
          };
        }),
      };
      const data = await saveAgencyAiBudgets(payload);
      if (data) {
        applyData(data);
      }
      setFeedback("Budget AI salvati.");
    } catch (err) {
      setError(err?.message || "Salvataggio dei budget non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="card-border">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div>
            <h6 className="mb-1">Budget AI giornaliero</h6>
            <p className="small text-muted mb-0">
              Tetto di spesa AI al giorno per dipendente (in USD). Al superamento, le
              azioni AI di quel dipendente vengono bloccate fino al giorno dopo.
              <strong> 0 = nessun limite.</strong> Il limite personale ha la priorità
              sul default del workspace.
            </p>
          </div>
          <Button size="sm" variant="outline-secondary" onClick={() => void load()} disabled={loading || saving}>
            Ricarica
          </Button>
        </div>

        {error && <Alert variant="danger" className="py-2">{error}</Alert>}
        {feedback && (
          <Alert variant="success" className="py-2" role="status" dismissible onClose={() => setFeedback("")}>
            {feedback}
          </Alert>
        )}

        {loading ? (
          <div className="p-3 d-flex justify-content-center">
            <Spinner animation="border" size="sm" role="status" />
          </div>
        ) : (
          <>
            <Form.Group className="mb-3" controlId="agency-ai-budget-default">
              <Form.Label className="small fw-semibold mb-1">
                Default del workspace (USD/giorno)
              </Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.5"
                size="sm"
                style={{ maxWidth: "12rem" }}
                value={defaultLimit}
                onChange={(event) => setDefaultLimit(event.target.value)}
              />
              <Form.Text className="text-muted">
                Vale per i dipendenti senza un limite personale.
              </Form.Text>
            </Form.Group>

            {members.length === 0 ? (
              <div className="agency-empty-state small">
                <strong>Nessun dipendente nel workspace.</strong>
              </div>
            ) : (
              <div className="table-responsive">
                <Table size="sm" className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Dipendente</th>
                      <th className="text-end">Speso oggi</th>
                      <th className="text-end">Limite personale (USD/giorno)</th>
                      <th className="text-end">Limite effettivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const raw = (overrides[member.userId] ?? "").trim();
                      const effective = raw === "" ? defaultLimitNumber : Number(raw) || 0;
                      const over = effective > 0 && member.spentTodayUsd >= effective;
                      return (
                        <tr key={member.userId}>
                          <td>
                            <div className="fw-semibold small">{member.name || member.email}</div>
                            <div className="small text-muted">{member.email}</div>
                          </td>
                          <td className="text-end">
                            <span className="small">{formatUsd(member.spentTodayUsd)}</span>
                            {over && (
                              <Badge bg="danger" className="ms-2">Esaurito</Badge>
                            )}
                          </td>
                          <td className="text-end">
                            <Form.Control
                              type="number"
                              min="0"
                              step="0.5"
                              size="sm"
                              className="text-end ms-auto"
                              style={{ maxWidth: "8rem" }}
                              placeholder="default"
                              value={overrides[member.userId] ?? ""}
                              onChange={(event) =>
                                setOverrides((current) => ({
                                  ...current,
                                  [member.userId]: event.target.value,
                                }))
                              }
                            />
                          </td>
                          <td className="text-end">
                            <span className="small">
                              {effective > 0 ? `${formatUsd(effective)}/giorno` : "Nessun limite"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}

            <div className="mt-3">
              <Button size="sm" variant="primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Salvataggio…
                  </>
                ) : (
                  "Salva budget"
                )}
              </Button>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default AgencyAiBudgetPanel;
