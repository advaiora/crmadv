import React from 'react';
import { connect } from 'react-redux';
import { toggleCollapsedNav } from '../../redux/action/Theme';
import { Link } from 'react-router-dom';
import { ArrowBarToLeft } from 'tabler-icons-react';
import { Button } from 'react-bootstrap';

//Images
import advaioraLogoWhite from '../../assets/img/AdvaioraLogo-White.png';


const SidebarHeader = ({ navCollapsed, toggleCollapsedNav }) => {

    const toggleSidebar = () => {
        toggleCollapsedNav(!navCollapsed);
        document.getElementById('tggl-btn').blur();
    }
    return (
        <div className="menu-header">
            <span>
                <Link className="navbar-brand" to="/">
                    <img className="brand-img img-fluid advaiora-logo-mark" src={advaioraLogoWhite} alt="Advaiora logo" />
                    <img className="brand-img img-fluid advaiora-logo-expanded" src={advaioraLogoWhite} alt="Advaiora logo" />
                </Link>
                <Button id="tggl-btn" variant="flush-dark" onClick={toggleSidebar} className="btn-icon btn-rounded flush-soft-hover navbar-toggle">
                    <span className="icon">
                        <span className="svg-icon fs-5">
                            <ArrowBarToLeft />
                        </span>
                    </span>
                </Button>
            </span>
        </div>
    )
}

const mapStateToProps = ({ theme }) => {
    const { navCollapsed } = theme;
    return { navCollapsed }
};

export default connect(mapStateToProps, { toggleCollapsedNav })(SidebarHeader);
