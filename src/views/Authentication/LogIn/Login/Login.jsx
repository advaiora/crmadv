import React, { useState } from 'react';
import { z } from 'zod';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { apiPost, ApiRequestError } from '../../../../utils/apiClient';
import { useSession } from '../../../../hooks/useSession';
import AdvaioraLogoBlack from '../../../../assets/img/AdvaioraLogo-Black.png';

const loginSchema = z.object({
    email: z.string().trim().email('Email non valida'),
    password: z.string().min(6, 'La password deve avere almeno 6 caratteri'),
});

const Login = ({ history }) => {
    const { login } = useSession();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const leftPanelBackground = 'var(--primary, #0f172a)';
    const leftPanelTextColor = 'var(--primary-foreground, #111111)';
    const rightPanelBackground = 'var(--hk-menu-bg, #2563eb)';
    const rightPanelTextColor = '#ffffff';

    const clearFieldError = (fieldName) => {
        if (!fieldErrors[fieldName]) {
            return;
        }

        setFieldErrors((currentErrors) => {
            const nextErrors = { ...currentErrors };
            delete nextErrors[fieldName];
            return nextErrors;
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        const parsed = loginSchema.safeParse({
            email,
            password,
        });

        if (!parsed.success) {
            const issues = parsed.error.flatten().fieldErrors;
            setFieldErrors({
                ...(issues.email?.[0] ? { email: issues.email[0] } : {}),
                ...(issues.password?.[0] ? { password: issues.password[0] } : {}),
            });
            return;
        }

        setFieldErrors({});
        setLoading(true);

        try {
            const result = await apiPost(
                '/auth/login',
                {
                    email: parsed.data.email,
                    password: parsed.data.password,
                },
                { skipAuthHeaders: true },
            );

            login({
                userId: result.id,
                userEmail: result.email,
                userRole: result.role,
            });

            history.push('/dashboard');
        } catch (requestError) {
            if (requestError instanceof ApiRequestError && requestError.status === 401) {
                setError('Credenziali non valide');
            } else {
                setError(requestError?.message || 'Errore durante il login');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="hk-pg-wrapper py-0">
            <div className="hk-pg-body py-0">
                <Container fluid className="min-vh-100 px-0">
                    <Row className="g-0 min-vh-100">
                        <Col
                            xs={12}
                            lg={6}
                            className="d-flex align-items-center justify-content-center px-4 px-md-5 py-5"
                            style={{
                                background: leftPanelBackground,
                                color: leftPanelTextColor,
                            }}
                        >
                            <div style={{ width: '100%', maxWidth: 420 }}>
                                <Card className="card-border shadow-sm">
                                    <Card.Body className="p-4 p-md-5">
                                        <div className="text-center mb-4">
                                            <h4 className="mt-1 mb-1">Accedi</h4>
                                            <p className="text-muted mb-0">Inserisci email e password</p>
                                        </div>

                                        {error && (
                                            <Alert variant="danger" className="py-2">
                                                {error}
                                            </Alert>
                                        )}

                                        <Form onSubmit={handleSubmit}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>Email</Form.Label>
                                                <Form.Control
                                                    aria-label="Email"
                                                    type="email"
                                                    value={email}
                                                    onChange={(event) => {
                                                        setEmail(event.target.value);
                                                        clearFieldError('email');
                                                    }}
                                                    isInvalid={Boolean(fieldErrors.email)}
                                                    placeholder="admin@test.com"
                                                    autoComplete="email"
                                                />
                                                <Form.Control.Feedback type="invalid">
                                                    {fieldErrors.email}
                                                </Form.Control.Feedback>
                                            </Form.Group>

                                            <Form.Group className="mb-4">
                                                <Form.Label>Password</Form.Label>
                                                <Form.Control
                                                    aria-label="Password"
                                                    type="password"
                                                    value={password}
                                                    onChange={(event) => {
                                                        setPassword(event.target.value);
                                                        clearFieldError('password');
                                                    }}
                                                    isInvalid={Boolean(fieldErrors.password)}
                                                    placeholder="Inserisci password"
                                                    autoComplete="current-password"
                                                />
                                                <Form.Control.Feedback type="invalid">
                                                    {fieldErrors.password}
                                                </Form.Control.Feedback>
                                            </Form.Group>

                                            <Button type="submit" className="w-100" disabled={loading}>
                                                {loading ? (
                                                    <span className="d-inline-flex align-items-center">
                                                        <Spinner animation="border" size="sm" className="me-2" />
                                                        Accesso in corso...
                                                    </span>
                                                ) : (
                                                    'Accedi'
                                                )}
                                            </Button>
                                        </Form>
                                    </Card.Body>
                                </Card>
                            </div>
                        </Col>

                        <Col
                            lg={6}
                            className="d-none d-lg-flex align-items-center justify-content-center"
                            style={{
                                color: rightPanelTextColor,
                                background: `linear-gradient(90deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0) 14px), ${rightPanelBackground}`,
                                boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.22)',
                            }}
                        >
                            <div className="text-center px-4 w-100">
                                <Link
                                    to="/"
                                    className="d-inline-flex align-items-center justify-content-center p-4 rounded-4 bg-white shadow-sm"
                                >
                                    <img
                                        src={AdvaioraLogoBlack}
                                        alt="Advaiora"
                                        className="img-fluid"
                                        style={{ width: 'min(420px, 36vw)' }}
                                    />
                                </Link>
                            </div>
                        </Col>
                    </Row>
                </Container>
            </div>
        </div>
    );
};

export default Login;
