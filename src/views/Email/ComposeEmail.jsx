import classNames from 'classnames';
import React, { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Edit, Maximize2, Minimize2, Minus, Paperclip, Trash2, X } from 'react-feather';
import HkTooltip from '../../components/@hk-tooltip/HkTooltip';
import HkChips from '../../components/@hk-chips/@hk-chips';
//Redux
import { connect } from 'react-redux';
import { Maximize, Minimize, Compose } from '../../redux/action/Email';

//Images
import avatar11 from '../../assets/img/avatar11.jpg';
import avatar12 from '../../assets/img/avatar12.jpg';
import avatar13 from '../../assets/img/avatar13.jpg';

const ComposeEmail = ({ Maximize, Minimize, maximize, minimize, composeEmail, Compose }) => {
    const [recipients, setRecipients] = useState([]);
    const [newRecipient, setNewRecipient] = useState("");

    const handleMinimize = () => {
        Maximize(false);
        Minimize(!minimize);

    }

    const handleClose = () => {
        Compose(!composeEmail);
        Maximize(false);
        Minimize(false);
    }

    const handleRecipients = () => {
        setRecipients(recipients => recipients.concat(newRecipient));
    }

    const onEnter = ({ key }) => {
        if (key === "Enter") {
            handleRecipients();
            setNewRecipient("");
        }
    }

    return (
        <div className={classNames("compose-email-popup", { "d-block": composeEmail }, { "minimize-email-popup": minimize }, { "maximize-email-popup": maximize })}  >
            <div className="d-flex flex-column h-100">
                <header className="d-flex align-items-center justify-content-between">
                    <h6 className="text-white mb-0">Compose Email</h6>
                    <div className="d-flex">
                        <Button size="sm" variant="dark" className="btn-icon btn-rounded d-lg-block d-none" onClick={handleMinimize} >
                            <span className="icon">
                                <span className="feather-icon">
                                    <Minus />
                                </span>
                            </span>
                        </Button>
                        <Button size="sm" variant="dark" className="btn-icon btn-rounded d-lg-block d-none" onClick={() => Maximize(!maximize)}  >
                            <span className="icon">
                                <span className="feather-icon">
                                    {maximize ? <Minimize2 /> : <Maximize2 />}
                                </span>
                            </span>
                        </Button>
                        <Button size="sm" variant="dark" className="btn-icon btn-rounded d-lg-block">
                            <span className="icon" onClick={handleClose} >
                                <span className="feather-icon">
                                    <X />
                                </span>
                            </span>
                        </Button>
                    </div>
                </header>
                <Form>
                    <Form.Group className="mb-3">
                        <div className="d-flex flex-wrap">
                            <HkChips className="mb-2 me-2" variant="primary" src={avatar11} dismissable >
                                Morgan
                            </HkChips>

                            <HkChips className="mb-2 me-2" variant="primary" src={avatar12} dismissable >
                                Charlie
                            </HkChips>

                            <HkChips className="mb-2 me-2" variant="primary" src={avatar13} dismissable >
                                Winston
                            </HkChips>
                            {recipients.map((data, i) => (
                                <HkChips key={i} className="mb-2 me-2" variant="primary" dismissable >
                                    {data}
                                </HkChips>
                            ))}
                            <Form.Control type="text" className="border-0 p-0 shadow-none flex-1 mb-2 me-2" placeholder="Add recipients" value={newRecipient} onChange={e => setNewRecipient(e.target.value)} onKeyPress={onEnter} />
                        </div>
                    </Form.Group>
                    <Form.Group className="mb-3" >
                        <Form.Control placeholder="Subject" />
                    </Form.Group>
                    <Form.Group>
                        <Form.Control as="textarea" />
                    </Form.Group>
                </Form>
                <div className="compose-email-footer">
                    <div>
                        <Button variant="primary" className="me-2" type="submit">Send</Button>
                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                            <HkTooltip id="flag" title="Add Flag" placement="top" >
                                <span className="icon">
                                    <span className="feather-icon">
                                        <Paperclip />
                                    </span>
                                </span>
                            </HkTooltip>
                        </Button>
                    </div>
                    <div>
                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                            <HkTooltip id="draft" title="Save Draft" placement="top" >
                                <span className="icon">
                                    <span className="feather-icon">
                                        <Edit />
                                    </span>
                                </span>
                            </HkTooltip>
                        </Button>
                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                            <HkTooltip id="delete" title="Delete" placement="top" >
                                <span className="icon">
                                    <span className="feather-icon">
                                        <Trash2 />
                                    </span>
                                </span>
                            </HkTooltip>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

const mapStateToProps = ({ emailReducer }) => {
    const { composeEmail, maximize, minimize } = emailReducer;
    return { composeEmail, maximize, minimize }
};

export default connect(mapStateToProps, { Maximize, Minimize, Compose })(ComposeEmail);