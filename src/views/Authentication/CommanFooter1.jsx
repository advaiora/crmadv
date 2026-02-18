import React from "react";
import { Col, Container, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

const CommanFooter1 = () => {
  return (
    <div className="hk-footer border-0">
      <Container as="footer" className="footer">
        <Row>
          <Col xl={8} className="text-center">
            <p className="footer-text pb-0">
              <span className="copy-text">Advaiora © {new Date().getFullYear()} All rights reserved.</span>
              <Link to="#">Privacy Policy</Link>
            </p>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default CommanFooter1;
