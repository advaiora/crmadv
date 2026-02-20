import React from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { Mail, Settings, User } from 'react-feather';
import { Link } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';

const PageFooter = () => {
    const { session } = useSession();
    const workspaceName = session?.workspaceBranding?.companyName || 'Advaiora';
    const supportEmail = session?.workspaceBranding?.supportEmail;
    const currentYear = new Date().getFullYear();

    return (
        <div className="hk-footer app-page-footer">
            <Container as="footer" className="footer">
                <Row className="app-page-footer-row">
                    <Col xl={8} lg={7}>
                        <p className="footer-text app-page-footer-text mb-0">
                            <span className="copy-text">{workspaceName} &copy; {currentYear}</span>
                            <span className="app-page-footer-muted">Piattaforma CRM multi-tenant</span>
                        </p>
                    </Col>
                    <Col xl={4} lg={5}>
                        <div className="app-page-footer-actions">
                            <Link to="/pages/profile" className="footer-extr-link app-page-footer-link">
                                <span className="feather-icon">
                                    <User />
                                </span>
                                Profilo
                            </Link>
                            <Link to="/pages/workspace-branding" className="footer-extr-link app-page-footer-link">
                                <span className="feather-icon">
                                    <Settings />
                                </span>
                                Branding
                            </Link>
                            {supportEmail && (
                                <a href={`mailto:${supportEmail}`} className="footer-extr-link app-page-footer-link">
                                    <span className="feather-icon">
                                        <Mail />
                                    </span>
                                    Supporto
                                </a>
                            )}
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default PageFooter;
