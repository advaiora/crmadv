import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { Check, Copy } from 'lucide-react';

const copyValue = async (value) => {
    if (!value || !navigator?.clipboard) {
        return false;
    }

    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch (_error) {
        return false;
    }
};

const CopyField = ({
    icon: Icon,
    label,
    value,
    buttonLabel = 'Copia',
}) => {
    const [copied, setCopied] = useState(false);
    const hasValue = typeof value === 'string' && value.trim().length > 0;

    const handleCopy = async () => {
        if (!hasValue) {
            return;
        }

        const isCopied = await copyValue(value);
        if (!isCopied) {
            return;
        }

        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
    };

    return (
        <div className="clients-copy-field">
            <div className="d-flex align-items-start gap-2">
                {Icon && (
                    <span className="clients-copy-field-icon">
                        <Icon size={14} />
                    </span>
                )}
                <div>
                    <div className="small text-muted">{label}</div>
                    <div>{hasValue ? value : <span className="text-muted">Non impostato</span>}</div>
                </div>
            </div>
            <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => void handleCopy()}
                disabled={!hasValue}
                aria-label={`${buttonLabel} ${label}`}
            >
                {copied ? (
                    <span className="d-inline-flex align-items-center gap-1">
                        <Check size={14} />
                        Copiato
                    </span>
                ) : (
                    <span className="d-inline-flex align-items-center gap-1">
                        <Copy size={14} />
                        {buttonLabel}
                    </span>
                )}
            </Button>
        </div>
    );
};

export default CopyField;
