import React, { useState } from 'react';
import { Button, Card, Form, InputGroup } from 'react-bootstrap';
import { Plus, Tag, X } from 'lucide-react';
import { CLIENTS_PRESET_TAGS } from '../constants';
import { getTagBadgeStyle, hasTag } from '../helpers';

/** Sezione 6 del form cliente: i tag, suggeriti e liberi. */
const ClientTagsSection = ({ tags, onAddTag, onTogglePresetTag, onRemoveTag, loading = false }) => {
    const [tagInput, setTagInput] = useState('');

    const submitTagInput = () => {
        const normalized = tagInput.trim();
        if (!normalized) {
            return;
        }

        onAddTag(normalized);
        setTagInput('');
    };

    return (
        <Card className="clients-form-section card-border mb-3">
            <Card.Header className="clients-form-section-header py-3">
                <h6 className="mb-0 d-inline-flex align-items-center gap-2">
                    <Tag size={15} />
                    Sezione 6 - Tag
                </h6>
            </Card.Header>
            <Card.Body>
                <div className="mb-3">
                    {/* Etichetta di un gruppo di bottoni, non di un campo: va legata
                        col gruppo, altrimenti non ha nessun controllo da nominare. */}
                    <div className="text-muted small mb-2" id="clients-preset-tags-label">Tag suggeriti</div>
                    <div className="clients-tag-presets" role="group" aria-labelledby="clients-preset-tags-label">
                        {CLIENTS_PRESET_TAGS.map((presetTag) => {
                            const selected = hasTag(tags, presetTag);
                            const tagStyle = getTagBadgeStyle(presetTag);
                            const presetStyle = {
                                backgroundColor: tagStyle.backgroundColor,
                                borderColor: tagStyle.borderColor,
                                color: tagStyle.color,
                                opacity: selected ? 1 : 0.85,
                            };

                            return (
                                <Button
                                    key={presetTag}
                                    type="button"
                                    size="sm"
                                    variant="light"
                                    className="clients-tag-preset-btn"
                                    style={presetStyle}
                                    onClick={() => onTogglePresetTag(presetTag)}
                                    disabled={loading}
                                    aria-pressed={selected}
                                >
                                    {presetTag}
                                </Button>
                            );
                        })}
                    </div>
                </div>

                <Form.Group controlId="clients-tag-input" className="mb-3">
                    <Form.Label className="visually-hidden">Aggiungi tag</Form.Label>
                    <InputGroup>
                        <Form.Control
                            value={tagInput}
                            onChange={(event) => setTagInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    submitTagInput();
                                }
                            }}
                            placeholder="Aggiungi tag"
                            disabled={loading}
                        />
                        <Button type="button" variant="outline-secondary" onClick={submitTagInput} disabled={loading}>
                            <span className="d-inline-flex align-items-center gap-1">
                                <Plus size={14} />
                                Aggiungi
                            </span>
                        </Button>
                    </InputGroup>
                </Form.Group>

                {tags.length > 0 ? (
                    <div className="clients-tags">
                        {tags.map((tag) => (
                            <span
                                key={tag}
                                className="badge d-inline-flex align-items-center gap-1 clients-tag-badge"
                                style={getTagBadgeStyle(tag)}
                            >
                                <span>{tag}</span>
                                <button
                                    type="button"
                                    className="btn btn-link p-0 text-reset"
                                    onClick={() => onRemoveTag(tag)}
                                    aria-label={`Rimuovi tag ${tag}`}
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                ) : (
                    <div className="text-muted small">Nessun tag inserito.</div>
                )}
            </Card.Body>
        </Card>
    );
};

export default ClientTagsSection;
