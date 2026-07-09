import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import { toggleCollapsedNav } from '../../redux/action/Theme';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'tabler-icons-react';
import { Button } from 'react-bootstrap';
import { useSession } from '../../hooks/useSession';

//Images
import advaioraLogoWhite from '../../assets/img/AdvaioraLogo-White.png';

const LOGO_SLOT_HEIGHT_PX = 34;
const MIN_LOGO_SLOT_WIDTH_PX = 56;
const MAX_LOGO_SLOT_WIDTH_PX = 220;
const DEFAULT_LOGO_RATIO = 172 / LOGO_SLOT_HEIGHT_PX;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const readImageRatio = (imageUrl) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            if (!image.naturalWidth || !image.naturalHeight) {
                reject(new Error('Invalid logo dimensions.'));
                return;
            }
            resolve(image.naturalWidth / image.naturalHeight);
        };
        image.onerror = () => reject(new Error('Unable to load logo image.'));
        image.src = imageUrl;
    });

const SidebarHeader = ({ navCollapsed, toggleCollapsedNav }) => {
    const { session } = useSession();
    const workspaceBranding = session?.workspaceBranding;
    const workspaceName = workspaceBranding?.companyName || 'Advaiora';
    const workspaceLogo = workspaceBranding?.logoUrl || advaioraLogoWhite;
    const [logoRatio, setLogoRatio] = useState(DEFAULT_LOGO_RATIO);

    useEffect(() => {
        let active = true;

        readImageRatio(workspaceLogo)
            .then((ratio) => {
                if (!active) {
                    return;
                }

                if (!Number.isFinite(ratio) || ratio <= 0) {
                    setLogoRatio(DEFAULT_LOGO_RATIO);
                    return;
                }

                setLogoRatio(ratio);
            })
            .catch(() => {
                if (!active) {
                    return;
                }
                setLogoRatio(DEFAULT_LOGO_RATIO);
            });

        return () => {
            active = false;
        };
    }, [workspaceLogo]);

    const logoContainerStyle = useMemo(() => {
        const expandedWidth = clamp(
            Math.round(logoRatio * LOGO_SLOT_HEIGHT_PX),
            MIN_LOGO_SLOT_WIDTH_PX,
            MAX_LOGO_SLOT_WIDTH_PX,
        );

        return {
            '--workspace-logo-expanded-width': `${expandedWidth}px`,
        };
    }, [logoRatio]);

    const handleLogoError = useCallback((event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = advaioraLogoWhite;
        setLogoRatio(DEFAULT_LOGO_RATIO);
    }, []);

    const toggleSidebar = () => {
        toggleCollapsedNav(!navCollapsed);
        document.getElementById('tggl-btn').blur();
    }
    return (
        <div className="menu-header">
            <span>
                <Link className="navbar-brand" to="/" style={logoContainerStyle}>
                    <img
                        className="brand-img img-fluid advaiora-logo-mark"
                        src={workspaceLogo}
                        alt={`${workspaceName} logo`}
                        onError={handleLogoError}
                    />
                    <img
                        className="brand-img img-fluid advaiora-logo-expanded"
                        src={workspaceLogo}
                        alt={`${workspaceName} logo`}
                        onError={handleLogoError}
                    />
                </Link>
                <Button id="tggl-btn" variant="flush-dark" onClick={toggleSidebar} className="btn-icon btn-rounded flush-soft-hover navbar-toggle">
                    <span className="icon">
                        <span className="svg-icon fs-5">
                            <ArrowLeft />
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
