import React, { useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClose } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'react-feather';

const STATUS_META = {
    success: {
        label: 'Successo',
        Icon: CheckCircle,
    },
    info: {
        label: 'Info',
        Icon: Info,
    },
    warning: {
        label: 'Attenzione',
        Icon: AlertTriangle,
    },
    danger: {
        label: 'Errore',
        Icon: AlertCircle,
    },
};

const HkAlert = ({ children, variant, className, dismissible, inverse, bsPrefix, closeLabel, closeVariant, onClose, transition, rounded, showStatusLabel = true }) => {

    const [show, setShow] = useState(true);
    const statusMeta = STATUS_META[variant];

    return (
        <>
            <Alert
                variant={!inverse && variant}
                bsPrefix={bsPrefix}
                className={classNames(className, (inverse ? `alert-inv alert-inv-${variant}` : ""), { "rounded-22": rounded })}
                dismissible={dismissible}
                closeLabel={closeLabel}
                closeVariant={closeVariant}
                onClose={onClose}
                show={show}
                transition={transition}
            >
                {showStatusLabel && !inverse && statusMeta && (
                    <span className={`alert-status-label alert-status-${variant}`}>
                        <span className="alert-status-icon" aria-hidden="true">
                            <statusMeta.Icon size={14} />
                        </span>
                        <span>{statusMeta.label}</span>
                    </span>
                )}
                {children}
                {dismissible && <Button bsPrefix='btn-close' onClick={() => setShow(!show)} ><FontAwesomeIcon icon={faClose} /></Button>}
            </Alert>
        </>
    )
}

const Header = (props) => <Alert.Heading as={props.as} bsPrefix={props.bsPrefix} className={props.className} >{props.children}</Alert.Heading>
HkAlert.Header = Header;

const Link = (props) => <Alert.Link href={props.href} bsPrefix={props.bsPrefix} className={props.className}>{props.children}</Alert.Link>
HkAlert.Link = Link;

export default HkAlert
