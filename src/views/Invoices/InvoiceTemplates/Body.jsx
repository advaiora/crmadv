import React from 'react';
import { Card, Col, Container, Form, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import SimpleBar from 'simplebar-react';

// Images
import template1 from '../../../assets/img/templates/template1.png';
import template2 from '../../../assets/img/templates/template2.png';
import template3 from '../../../assets/img/templates/template3.png';
import template4 from '../../../assets/img/templates/template4.png';
import template5 from '../../../assets/img/templates/template5.png';
import template6 from '../../../assets/img/templates/template6.png';
import template7 from '../../../assets/img/templates/template7.png';
import template8 from '../../../assets/img/templates/template8.png';

const premiumTemplates = [
    { name: 'Standard', image: template1 },
    { name: 'Simplicity', image: template2 },
    { name: 'Essential', image: template3 },
    { name: 'Classic', image: template4 },
];

const businessTemplates = [
    { name: 'Pro Forma', image: template5 },
    { name: 'Trade', image: template6 },
    { name: 'Interim', image: template7 },
    { name: 'Primary', image: template8 },
    { name: 'Matt Opel', image: template1 },
    { name: 'Freelancer', image: template2 },
    { name: 'Designer', image: template3 },
    { name: 'Service', image: template4 },
    { name: 'Service', image: template5 },
    { name: 'Service', image: template6 },
    { name: 'Service', image: template7 },
    { name: 'Service', image: template8 },
];

const renderTemplateCard = ({ name, image }, index) => (
    <Link to="#" className="invoice-template-card-link d-block col-xl-2 col-sm-4 col-xs-12 mb-5" key={`${name}-${index}`}>
        <Card className="card-border invoice-template-card">
            <Card.Img src={image} alt={`${name} template preview`} className="invoice-template-thumb" />
        </Card>
        <h6 className="invoice-template-name mb-0 mt-2">{name}</h6>
    </Link>
);

const Body = () => {
    return (
        <div className="invoice-body">
            <SimpleBar className="nicescroll-bar">
                <Container>
                    <div className="invoice-templates-panel my-md-7 my-3">
                        <h3 className="mb-2">Pick your starting point</h3>
                        <p className="invoice-templates-subtitle mb-4">Choose a template and customize it for your brand.</p>
                        <Form className="invoice-template-filters">
                            <Row>
                                <Col md={4} className="mb-md-0 mb-3">
                                    <Form.Control type="text" placeholder="Search Template" />
                                </Col>
                                <Col md={4} className="mb-md-0 mb-3">
                                    <Form.Select>
                                        <option value={1}>Popular</option>
                                        <option value={2}>Classic</option>
                                        <option value={3}>Trending</option>
                                        <option value={4}>Simple</option>
                                    </Form.Select>
                                </Col>
                                <Col md={4}>
                                    <Form.Select>
                                        <option value={1}>All Categories</option>
                                        <option value={2}>Business</option>
                                        <option value={3}>Studio</option>
                                        <option value={4}>Personal</option>
                                    </Form.Select>
                                </Col>
                            </Row>
                        </Form>
                        <h5 className="mt-6 mb-3">Premium Templates</h5>
                        <Row className="text-center">
                            {premiumTemplates.map(renderTemplateCard)}
                        </Row>
                        <h5 className="mt-3 mb-3">Business</h5>
                        <Row className="text-center">
                            {businessTemplates.map(renderTemplateCard)}
                        </Row>
                    </div>
                </Container>
            </SimpleBar>
        </div>
    );
};

export default Body;
