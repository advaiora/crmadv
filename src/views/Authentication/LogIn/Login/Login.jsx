import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { apiPost, ApiRequestError } from '../../../../utils/apiClient';
import { useSession } from '../../../../hooks/useSession';
import { useTheme } from '../../../../utils/theme-provider/theme-provider';
import logoLight from '../../../../assets/img/logo-light.svg';
import logoDark from '../../../../assets/img/logo-dark.svg';

const loginSchema = z.object({
    email: z.string().trim().email('Email non valida'),
    password: z.string().min(6, 'La password deve avere almeno 6 caratteri'),
});

const Login = ({ history }) => {
    const { theme } = useTheme();
    const { login } = useSession();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const logo = useMemo(() => (theme === 'light' ? logoLight : logoDark), [theme]);

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
                <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center">
                    <Row className="w-100 justify-content-center">
                        <Col xl={4} lg={5} md={7}>
                            <Card className="card-border shadow-sm">
                                <Card.Body className="p-4 p-md-5">
                                    <div className="text-center mb-4">
                                        <Link to="/" className="navbar-brand me-0">
                                            <img src={logo} alt="brand" className="brand-img d-inline-block" />
                                        </Link>
                                        <h4 className="mt-3 mb-1">Accedi</h4>
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
                        </Col>
                    </Row>
                </Container>
            </div>
        </div>
    );
};

export default Login;
