import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Spinner,
  Tab,
  Table,
  Tabs,
} from 'react-bootstrap';
import { Info, MailPlus, RefreshCw, Trash2, UserCog, UserPlus, UserX, Users } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import TeamModuleGate from '../../modules/team/ui/TeamModuleGate';
import { describeInviteDelivery, INVITE_DELIVERY_TONE } from '../../modules/team/ui/inviteDelivery';
import {
  TEAM_INVITE_STATUS_OPTIONS,
  TEAM_PERMISSIONS,
  TEAM_ROLE_PRESETS,
  TEAM_STATUS_OPTIONS,
  canActOnInvitePreset,
  invitableRolePresets,
} from '../../modules/team/ui/constants';
import {
  assignTeamMemberRole,
  createTeamMember,
  createTeamInvite,
  deleteTeamMember,
  deleteTeamInvite,
  regenerateTeamInviteLink,
  listTeamInvites,
  listTeamMembers,
  revokeTeamInvite,
  setTeamMemberActiveState,
} from '../../modules/team/api/teamApi';
import { assignUserCustomRoles, listWorkspaceRoles } from '../../modules/roles/api/rolesApi';
import { hasPermission } from '../../utils/workspaceAccess';
import '../../modules/team/ui/team-ui.css';
import 'react-toastify/dist/ReactToastify.css';

const PAGE_SIZE = 10;
const formatDateTime = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};
const statusVariant = (status) => ({
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  PENDING: 'warning',
  ACCEPTED: 'success',
  REVOKED: 'secondary',
  EXPIRED: 'danger',
}[status] || 'secondary');
const errorMessage = (error, fallback) => {
  const status = Number(error?.status);
  if (status === 403) return 'Non hai permessi per questa operazione.';
  if (status === 404) return 'Risorsa non trovata nel workspace.';
  if (status === 409) return 'Conflitto sui dati.';
  if (status >= 500) return 'Errore server temporaneo.';
  return error?.message || fallback;
};
const isSuperadmin = (member) => Array.isArray(member?.roles) && member.roles.includes('Superadmin');
const CLOSED_ROLES_DIALOG = { open: false, member: null, roleName: 'Viewer', customRoleIds: [], initialCustomRoleIds: [], saving: false, error: '' };
const sameIds = (a, b) => a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);

const TeamWorkspacePage = ({ access }) => {
  const canInvite = hasPermission(access, TEAM_PERMISSIONS.invite);
  const canEdit = hasPermission(access, TEAM_PERMISSIONS.edit);
  const canDeactivate = hasPermission(access, TEAM_PERMISSIONS.deactivate);
  const canAssignRoles = hasPermission(access, TEAM_PERMISSIONS.rolesAssign);
  const canAssignCustomRoles = hasPermission(access, 'roles.assign');
  const actorIsSuperadmin = Array.isArray(access?.roles) && access.roles.includes('Superadmin');
  // Non si invita a un ruolo piu' alto del proprio (regola del 17/8/2026).
  const invitableRoles = invitableRolePresets(access?.roles);
  const canDeleteMembers = canDeactivate && actorIsSuperadmin;

  const [tab, setTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [invitesError, setInvitesError] = useState('');

  const [memberSearchDraft, setMemberSearchDraft] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatus, setMemberStatus] = useState('ALL');
  const [inviteStatus, setInviteStatus] = useState('ALL');
  const [memberPage, setMemberPage] = useState(1);
  const [invitePage, setInvitePage] = useState(1);

  const [detailMember, setDetailMember] = useState(null);
  const [createMemberOpen, setCreateMemberOpen] = useState(false);
  const [createMemberSubmitting, setCreateMemberSubmitting] = useState(false);
  const [createMemberError, setCreateMemberError] = useState('');
  const [createMemberForm, setCreateMemberForm] = useState({
    name: '',
    email: '',
    password: '',
    roleName: 'Viewer',
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteCreated, setInviteCreated] = useState(null);
  const [inviteForm, setInviteForm] = useState({ email: '', rolePreset: 'Viewer', expiresInDays: 7 });

  const [rolesDialog, setRolesDialog] = useState(CLOSED_ROLES_DIALOG);
  const [customRoles, setCustomRoles] = useState([]);
  const [stateDialog, setStateDialog] = useState({ open: false, member: null, nextActive: false, saving: false, error: '' });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, member: null, saving: false, error: '' });
  const [revokeLoading, setRevokeLoading] = useState({});
  const [deleteInviteLoading, setDeleteInviteLoading] = useState({});
  const [inviteLinkLoading, setInviteLinkLoading] = useState({});
  const [regeneratedLink, setRegeneratedLink] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setMemberSearch(memberSearchDraft.trim().toLowerCase()), 280);
    return () => window.clearTimeout(timer);
  }, [memberSearchDraft]);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError('');
    try {
      const result = await listTeamMembers();
      setMembers(Array.isArray(result?.members) ? result.members : []);
    } catch (error) {
      setMembers([]);
      setMembersError(errorMessage(error, 'Errore caricamento membri.'));
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const loadInvites = useCallback(async () => {
    setInvitesLoading(true);
    setInvitesError('');
    try {
      const result = await listTeamInvites();
      setInvites(Array.isArray(result?.invites) ? result.invites : []);
    } catch (error) {
      setInvites([]);
      setInvitesError(errorMessage(error, 'Errore caricamento inviti.'));
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  useEffect(() => { void loadMembers(); }, [loadMembers]);
  useEffect(() => { if (tab === 'invites') void loadInvites(); }, [tab, loadInvites]);

  // Ruoli custom del workspace (per assegnarli in aggiunta al ruolo base).
  useEffect(() => {
    if (!canAssignCustomRoles) {
      setCustomRoles([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await listWorkspaceRoles();
        if (!cancelled) {
          setCustomRoles((result?.roles ?? []).filter((role) => !role.isSystem));
        }
      } catch {
        if (!cancelled) setCustomRoles([]);
      }
    })();
    return () => { cancelled = true; };
  }, [canAssignCustomRoles]);
  useEffect(() => setMemberPage(1), [memberSearch, memberStatus]);
  useEffect(() => setInvitePage(1), [inviteStatus]);

  const activeSuperadmins = useMemo(
    () => members.filter((member) => member.status === 'ACTIVE' && isSuperadmin(member)).length,
    [members],
  );

  const memberItems = useMemo(() => {
    const filtered = members.filter((member) => {
      if (memberStatus !== 'ALL' && member.status !== memberStatus) return false;
      if (!memberSearch) return true;
      const haystack = `${member.name || ''} ${member.email || ''} ${(member.roles || []).join(' ')}`.toLowerCase();
      return haystack.includes(memberSearch);
    });
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filtered;
  }, [memberSearch, memberStatus, members]);

  const inviteItems = useMemo(() => {
    const filtered = invites.filter((invite) => inviteStatus === 'ALL' || invite.status === inviteStatus);
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filtered;
  }, [inviteStatus, invites]);

  const memberTotalPages = Math.max(Math.ceil(memberItems.length / PAGE_SIZE), 1);
  const inviteTotalPages = Math.max(Math.ceil(inviteItems.length / PAGE_SIZE), 1);
  const pagedMembers = memberItems.slice((memberPage - 1) * PAGE_SIZE, memberPage * PAGE_SIZE);
  const pagedInvites = inviteItems.slice((invitePage - 1) * PAGE_SIZE, invitePage * PAGE_SIZE);
  useEffect(() => { if (memberPage > memberTotalPages) setMemberPage(memberTotalPages); }, [memberPage, memberTotalPages]);
  useEffect(() => { if (invitePage > inviteTotalPages) setInvitePage(inviteTotalPages); }, [invitePage, inviteTotalPages]);

  const inviteOutcome = useMemo(
    () => (inviteCreated
      ? describeInviteDelivery(inviteCreated.delivery, { hasLink: Boolean(inviteCreated.inviteLink) })
      : null),
    [inviteCreated],
  );

  const onInviteSubmit = async (event) => {
    event.preventDefault();
    setInviteSubmitting(true);
    setInviteError('');
    setInviteCreated(null);
    try {
      const result = await createTeamInvite({
        email: inviteForm.email.trim(),
        rolePreset: inviteForm.rolePreset,
        expiresInDays: Number(inviteForm.expiresInDays),
      });
      setInviteCreated(result);
      const outcome = describeInviteDelivery(result?.delivery, { hasLink: Boolean(result?.inviteLink) });
      if (outcome.tone === INVITE_DELIVERY_TONE.warning) {
        toast.warning(outcome.title);
      } else {
        toast.success(outcome.title);
      }
      await loadInvites();
    } catch (error) {
      const message = errorMessage(error, 'Invito non creato');
      setInviteError(message);
      toast.error(message);
    } finally {
      setInviteSubmitting(false);
    }
  };

  const onCreateMemberSubmit = async (event) => {
    event.preventDefault();
    setCreateMemberSubmitting(true);
    setCreateMemberError('');

    try {
      const payload = {
        email: createMemberForm.email.trim(),
        name: createMemberForm.name.trim(),
        password: createMemberForm.password,
        roleName: createMemberForm.roleName,
        createUserIfMissing: true,
      };
      await createTeamMember(payload);
      toast.success('Utente creato e aggiunto al workspace');
      setCreateMemberOpen(false);
      setCreateMemberForm({
        name: '',
        email: '',
        password: '',
        roleName: 'Viewer',
      });
      await loadMembers();
    } catch (error) {
      const message = errorMessage(error, 'Creazione utente non riuscita');
      setCreateMemberError(message);
      toast.error(message);
    } finally {
      setCreateMemberSubmitting(false);
    }
  };

  const onCopyText = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Link copiato');
    } catch {
      toast.error('Copia non riuscita: selezionalo a mano dal riquadro');
    }
  };

  const onSaveRoles = async (event) => {
    event.preventDefault();
    if (!rolesDialog.member) return;
    const blockingLastSuperadmin =
      isSuperadmin(rolesDialog.member)
      && rolesDialog.member.status === 'ACTIVE'
      && activeSuperadmins <= 1
      && rolesDialog.roleName !== 'Superadmin';
    if (blockingLastSuperadmin) {
      setRolesDialog((current) => ({ ...current, error: 'Non puoi rimuovere il ruolo all ultimo Superadmin attivo.' }));
      return;
    }
    setRolesDialog((current) => ({ ...current, saving: true, error: '' }));
    try {
      await assignTeamMemberRole(rolesDialog.member.memberId, rolesDialog.roleName);
      if (
        canAssignCustomRoles
        && rolesDialog.member.userId
        && !sameIds(rolesDialog.customRoleIds, rolesDialog.initialCustomRoleIds)
      ) {
        await assignUserCustomRoles(rolesDialog.member.userId, rolesDialog.customRoleIds);
      }
      toast.success('Ruolo aggiornato');
      setRolesDialog(CLOSED_ROLES_DIALOG);
      await loadMembers();
    } catch (error) {
      const message = errorMessage(error, 'Aggiornamento ruolo non riuscito');
      setRolesDialog((current) => ({ ...current, saving: false, error: message }));
      toast.error(message);
    }
  };

  const onConfirmStateChange = async () => {
    if (!stateDialog.member) return;
    const blockingLastSuperadmin =
      !stateDialog.nextActive
      && isSuperadmin(stateDialog.member)
      && stateDialog.member.status === 'ACTIVE'
      && activeSuperadmins <= 1;
    if (blockingLastSuperadmin) {
      setStateDialog((current) => ({ ...current, error: 'Non puoi disattivare l ultimo Superadmin attivo.' }));
      return;
    }
    setStateDialog((current) => ({ ...current, saving: true, error: '' }));
    try {
      await setTeamMemberActiveState(stateDialog.member.memberId, stateDialog.nextActive);
      toast.success(stateDialog.nextActive ? 'Membro riattivato' : 'Membro disattivato');
      setStateDialog({ open: false, member: null, nextActive: false, saving: false, error: '' });
      await loadMembers();
    } catch (error) {
      const message = errorMessage(error, 'Aggiornamento stato non riuscito');
      setStateDialog((current) => ({ ...current, saving: false, error: message }));
      toast.error(message);
    }
  };

  const onRevokeInvite = async (invite) => {
    setRevokeLoading((current) => ({ ...current, [invite.inviteId]: true }));
    try {
      await revokeTeamInvite(invite.inviteId);
      toast.success('Invito revocato');
      await loadInvites();
    } catch (error) {
      toast.error(errorMessage(error, 'Revoca invito non riuscita'));
    } finally {
      setRevokeLoading((current) => ({ ...current, [invite.inviteId]: false }));
    }
  };

  const onRegenerateInviteLink = async (invite) => {
    const confirmed = window.confirm(
      `Creare un link nuovo per l'invito a ${invite.email}?\n\nSe un link era già stato mandato, quello smette di funzionare.`,
    );
    if (!confirmed) {
      return;
    }

    setInviteLinkLoading((current) => ({ ...current, [invite.inviteId]: true }));
    try {
      const result = await regenerateTeamInviteLink(invite.inviteId);
      setRegeneratedLink({ email: invite.email, link: result.inviteLink });
      try {
        await navigator.clipboard.writeText(result.inviteLink);
        toast.success('Link nuovo creato e copiato');
      } catch {
        // La copia automatica puo' fallire (permessi del browser): il link
        // resta comunque a schermo, quindi non e' un vicolo cieco.
        toast.info('Link nuovo creato: copialo dal riquadro qui sopra');
      }
      await loadInvites();
    } catch (error) {
      toast.error(errorMessage(error, 'Creazione del link non riuscita'));
    } finally {
      setInviteLinkLoading((current) => ({ ...current, [invite.inviteId]: false }));
    }
  };

  const onDeleteInvite = async (invite) => {
    const confirmed = window.confirm(`Eliminare definitivamente l invito per ${invite.email}?`);
    if (!confirmed) {
      return;
    }

    setDeleteInviteLoading((current) => ({ ...current, [invite.inviteId]: true }));
    try {
      await deleteTeamInvite(invite.inviteId);
      toast.success('Invito eliminato');
      await loadInvites();
    } catch (error) {
      toast.error(errorMessage(error, 'Eliminazione invito non riuscita'));
    } finally {
      setDeleteInviteLoading((current) => ({ ...current, [invite.inviteId]: false }));
    }
  };

  const onConfirmDeleteMember = async () => {
    if (!deleteDialog.member) return;
    const blockingLastSuperadmin =
      deleteDialog.member.status === 'ACTIVE'
      && isSuperadmin(deleteDialog.member)
      && activeSuperadmins <= 1;
    if (blockingLastSuperadmin) {
      setDeleteDialog((current) => ({ ...current, error: 'Non puoi eliminare l ultimo Superadmin attivo.' }));
      return;
    }
    if (deleteDialog.member.userId === access?.user?.id) {
      setDeleteDialog((current) => ({ ...current, error: 'Non puoi eliminare la tua utenza dal workspace.' }));
      return;
    }

    setDeleteDialog((current) => ({ ...current, saving: true, error: '' }));
    try {
      await deleteTeamMember(deleteDialog.member.memberId);
      toast.success('Membro eliminato dal workspace');
      setDeleteDialog({ open: false, member: null, saving: false, error: '' });
      await loadMembers();
    } catch (error) {
      const message = errorMessage(error, 'Eliminazione membro non riuscita');
      setDeleteDialog((current) => ({ ...current, saving: false, error: message }));
      toast.error(message);
    }
  };

  return (
    <div className="container-fluid pt-3 team-page-container page-flat">
      <div className="team-page-shell">
        <Card className="card-border mb-3 team-page-header">
          <Card.Body className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <h4 className="mb-1 d-flex align-items-center gap-2"><Users size={18} />Team</h4>
              <div className="small text-muted">Gestione membri, inviti, ruoli e stato.</div>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <Button variant="outline-secondary" onClick={() => { void loadMembers(); if (tab === 'invites') void loadInvites(); }} className="d-inline-flex align-items-center gap-1">
                <RefreshCw size={14} />Aggiorna
              </Button>
              {canInvite && (
                <Button variant="outline-primary" onClick={() => { setCreateMemberOpen(true); setCreateMemberError(''); }} className="d-inline-flex align-items-center gap-1">
                  <UserPlus size={14} />Crea utente
                </Button>
              )}
              {canInvite && (
                <Button onClick={() => { setInviteOpen(true); setInviteError(''); setInviteCreated(null); }} className="d-inline-flex align-items-center gap-1">
                  <MailPlus size={14} />Invita
                </Button>
              )}
            </div>
          </Card.Body>
        </Card>
        <Tabs activeKey={tab} onSelect={(value) => typeof value === 'string' && setTab(value)} className="mb-3 team-tabs">
          <Tab eventKey="members" title="Membri">
            <Card className="card-border mb-3 team-toolbar-card">
              <Card.Body>
                <Row className="g-2 align-items-end">
                  <Col md={7}>
                    <Form.Label className="small mb-1">Ricerca</Form.Label>
                    <Form.Control value={memberSearchDraft} onChange={(event) => setMemberSearchDraft(event.target.value)} placeholder="Nome, email, ruolo..." />
                  </Col>
                  <Col md={3}>
                    <Form.Label className="small mb-1">Stato</Form.Label>
                    <Form.Select value={memberStatus} onChange={(event) => setMemberStatus(event.target.value)}>
                      {TEAM_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Form.Select>
                  </Col>
                  <Col md={2}><div className="small text-muted">Totale: {memberItems.length}</div></Col>
                </Row>
              </Card.Body>
            </Card>
          {membersError && <Alert variant="danger">{membersError}</Alert>}
          <Card className="card-border flat-keep team-data-table-shell">
            <Card.Body>
              <div className="table-responsive">
                <Table hover className="mb-0 align-middle team-table">
                  <thead><tr><th>Nome</th><th>Email</th><th>Ruoli</th><th>Stato</th><th>Ingresso</th><th className="text-end">Azioni</th></tr></thead>
                  <tbody>
                    {membersLoading && <tr><td colSpan={6} className="text-center py-4 text-muted"><Spinner animation="border" size="sm" className="me-2" />Caricamento...</td></tr>}
                    {!membersLoading && pagedMembers.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-muted">Nessun membro trovato.</td></tr>}
                    {!membersLoading && pagedMembers.map((member) => {
                      const blockLastSuperadmin = member.status === 'ACTIVE' && isSuperadmin(member) && activeSuperadmins <= 1;
                      const deactivateReason = !canDeactivate ? `Permesso richiesto: ${TEAM_PERMISSIONS.deactivate}` : (blockLastSuperadmin ? 'Ultimo Superadmin attivo' : '');
                      const rolesReason = !canAssignRoles ? `Permesso richiesto: ${TEAM_PERMISSIONS.rolesAssign}` : '';
                      const deleteReason = !canDeleteMembers
                        ? 'Solo Superadmin'
                        : (blockLastSuperadmin
                          ? 'Ultimo Superadmin attivo'
                          : (member.userId === access?.user?.id ? 'Non puoi eliminare te stesso' : ''));
                      const nextActive = member.status !== 'ACTIVE';
                      return (
                        <tr key={member.memberId}>
                          <td>{member.name || 'Utente senza nome'}</td>
                          <td>{member.email}</td>
                          <td><div className="d-flex gap-1 flex-wrap">{(member.roles || []).map((role) => <Badge key={`${member.memberId}-${role}`} bg="light" className="border">{role}</Badge>)}</div></td>
                          <td><Badge bg={statusVariant(member.status)}>{member.status}</Badge></td>
                          <td>{formatDateTime(member.createdAt)}</td>
                          <td>
                            <div className="d-flex justify-content-end gap-2 flex-wrap">
                              <span title="Dettagli"><Button size="sm" variant="outline-secondary" onClick={() => setDetailMember(member)}><Info size={14} /></Button></span>
                              <span title={deactivateReason}><Button size="sm" variant="outline-danger" disabled={Boolean(deactivateReason)} onClick={() => setStateDialog({ open: true, member, nextActive, saving: false, error: '' })}><UserX size={14} /></Button></span>
                              <span title={rolesReason}><Button size="sm" variant="outline-secondary" disabled={Boolean(rolesReason)} onClick={() => {
                                const baseRole = (member.roles || []).find((role) => TEAM_ROLE_PRESETS.includes(role)) || 'Viewer';
                                const memberCustomIds = customRoles.filter((role) => (member.roles || []).includes(role.name)).map((role) => role.id);
                                setRolesDialog({ open: true, member, roleName: baseRole, customRoleIds: memberCustomIds, initialCustomRoleIds: memberCustomIds, saving: false, error: '' });
                              }}><UserCog size={14} /></Button></span>
                              <span title={deleteReason}><Button size="sm" variant="outline-danger" disabled={Boolean(deleteReason)} onClick={() => setDeleteDialog({ open: true, member, saving: false, error: '' })}><Trash2 size={14} /></Button></span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div className="small text-muted">Pagina {memberPage} di {memberTotalPages}</div>
            <div className="d-flex gap-2">
              <Button size="sm" variant="outline-secondary" disabled={memberPage <= 1} onClick={() => setMemberPage((current) => Math.max(current - 1, 1))}>Precedente</Button>
              <Button size="sm" variant="outline-secondary" disabled={memberPage >= memberTotalPages} onClick={() => setMemberPage((current) => Math.min(current + 1, memberTotalPages))}>Successiva</Button>
            </div>
          </div>
        </Tab>
        <Tab eventKey="invites" title="Inviti">
          <Card className="card-border mb-3 team-toolbar-card">
            <Card.Body>
              <Row className="g-2 align-items-end">
                <Col md={4}>
                  <Form.Label className="small mb-1">Stato invito</Form.Label>
                  <Form.Select value={inviteStatus} onChange={(event) => setInviteStatus(event.target.value)}>
                    {TEAM_INVITE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Form.Select>
                </Col>
                <Col md={8}><div className="small text-muted">Totale: {inviteItems.length}</div></Col>
              </Row>
            </Card.Body>
          </Card>
          {invitesError && <Alert variant="danger">{invitesError}</Alert>}
          {regeneratedLink && (
            <Alert variant="info" dismissible onClose={() => setRegeneratedLink(null)}>
              <div className="small fw-semibold mb-1">Link di invito per {regeneratedLink.email}</div>
              <div className="small mb-2">Mandalo tu alla persona. Vale fino alla scadenza già indicata nella tabella.</div>
              <div className="small text-break mb-2">{regeneratedLink.link}</div>
              <Button size="sm" variant="outline-primary" onClick={() => void onCopyText(regeneratedLink.link)}>Copia link</Button>
            </Alert>
          )}
          <Card className="card-border flat-keep team-data-table-shell">
            <Card.Body>
              <div className="table-responsive">
                <Table hover className="mb-0 align-middle team-table">
                  <thead><tr><th>Email</th><th>Ruolo</th><th>Stato</th><th>Scadenza</th><th>Creato</th><th className="text-end">Azioni</th></tr></thead>
                  <tbody>
                    {invitesLoading && <tr><td colSpan={6} className="text-center py-4 text-muted"><Spinner animation="border" size="sm" className="me-2" />Caricamento...</td></tr>}
                    {!invitesLoading && pagedInvites.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-muted">Nessun invito trovato.</td></tr>}
                    {!invitesLoading && pagedInvites.map((invite) => {
                      const canRevoke = invite.status === 'PENDING';
                      const revokeReason = !canInvite ? `Permesso richiesto: ${TEAM_PERMISSIONS.invite}` : (!canRevoke ? 'Solo PENDING' : '');
                      const loading = Boolean(revokeLoading[invite.inviteId]);
                      const canDeleteInvite = canInvite;
                      const deleteReason = !canDeleteInvite ? `Permesso richiesto: ${TEAM_PERMISSIONS.invite}` : '';
                      const deleting = Boolean(deleteInviteLoading[invite.inviteId]);
                      // Non si consegna il link di un invito destinato a un
                      // ruolo piu' alto del proprio: il server lo rifiuta, e il
                      // pulsante deve dirlo prima invece di dopo.
                      const canActOnInvite = canActOnInvitePreset(access?.roles, invite.rolePreset || 'Viewer');
                      const linkDisabled = !canInvite || invite.status !== 'PENDING' || !canActOnInvite;
                      const linkReason = !canInvite
                        ? `Permesso richiesto: ${TEAM_PERMISSIONS.invite}`
                        : (invite.status !== 'PENDING'
                          ? 'Solo PENDING'
                          : (!canActOnInvite
                            ? `Invito destinato a ${invite.rolePreset}: e un ruolo piu alto del tuo`
                            : 'Crea un link nuovo e lo copia. Se un link era già stato mandato, quello smette di funzionare.'));
                      const linkLoading = Boolean(inviteLinkLoading[invite.inviteId]);
                      return (
                        <tr key={invite.inviteId}>
                          <td>{invite.email}</td>
                          <td>{invite.rolePreset || 'Viewer'}</td>
                          <td><Badge bg={statusVariant(invite.status)}>{invite.status}</Badge></td>
                          <td>{formatDateTime(invite.expiresAt)}</td>
                          <td>{formatDateTime(invite.createdAt)}</td>
                          <td className="text-end">
                            <div className="d-inline-flex gap-2">
                              <span title={linkReason}><Button size="sm" variant="outline-primary" disabled={linkDisabled || linkLoading} onClick={() => void onRegenerateInviteLink(invite)}>{linkLoading ? 'Creo...' : 'Link invito'}</Button></span>
                              <span title={revokeReason}><Button size="sm" variant="outline-danger" disabled={Boolean(revokeReason) || loading} onClick={() => void onRevokeInvite(invite)}>{loading ? 'Revoca...' : 'Revoca'}</Button></span>
                              <span title={deleteReason}><Button size="sm" variant="outline-secondary" disabled={Boolean(deleteReason) || deleting} onClick={() => void onDeleteInvite(invite)}>{deleting ? 'Elimina...' : 'Elimina'}</Button></span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div className="small text-muted">Pagina {invitePage} di {inviteTotalPages}</div>
            <div className="d-flex gap-2">
              <Button size="sm" variant="outline-secondary" disabled={invitePage <= 1} onClick={() => setInvitePage((current) => Math.max(current - 1, 1))}>Precedente</Button>
              <Button size="sm" variant="outline-secondary" disabled={invitePage >= inviteTotalPages} onClick={() => setInvitePage((current) => Math.min(current + 1, inviteTotalPages))}>Successiva</Button>
            </div>
          </div>
        </Tab>
      </Tabs>

      <Modal className="team-modal" show={Boolean(detailMember)} onHide={() => setDetailMember(null)} centered>
        <Modal.Header closeButton><Modal.Title>Dettaglio membro</Modal.Title></Modal.Header>
        <Modal.Body>
          {detailMember && (
            <>
              <div className="mb-2"><strong>Nome:</strong> {detailMember.name || '-'}</div>
              <div className="mb-2"><strong>Email:</strong> {detailMember.email}</div>
              <div className="mb-2"><strong>Ruoli:</strong> {(detailMember.roles || []).join(', ') || '-'}</div>
              <div className="mb-2"><strong>Stato:</strong> {detailMember.status}</div>
              <div><strong>Ingresso:</strong> {formatDateTime(detailMember.createdAt)}</div>
              {canEdit && <Alert variant="info" className="mt-3 mb-0 py-2">Nessun campo membership editabile in questa fase.</Alert>}
            </>
          )}
        </Modal.Body>
        <Modal.Footer><Button variant="outline-secondary" onClick={() => setDetailMember(null)}>Chiudi</Button></Modal.Footer>
      </Modal>

      <Modal className="team-modal" show={createMemberOpen} onHide={() => !createMemberSubmitting && setCreateMemberOpen(false)} centered backdrop={createMemberSubmitting ? 'static' : true}>
        <Modal.Header closeButton={!createMemberSubmitting}><Modal.Title>Crea utente</Modal.Title></Modal.Header>
        <Form onSubmit={onCreateMemberSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nome</Form.Label>
              <Form.Control value={createMemberForm.name} onChange={(event) => setCreateMemberForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nome utente" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={createMemberForm.email} onChange={(event) => setCreateMemberForm((current) => ({ ...current, email: event.target.value }))} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password iniziale</Form.Label>
              <Form.Control type="password" minLength={8} value={createMemberForm.password} onChange={(event) => setCreateMemberForm((current) => ({ ...current, password: event.target.value }))} required />
              <div className="small text-muted mt-1">Minimo 8 caratteri.</div>
            </Form.Group>
            <Form.Group>
              <Form.Label>Ruolo</Form.Label>
              <Form.Select value={createMemberForm.roleName} onChange={(event) => setCreateMemberForm((current) => ({ ...current, roleName: event.target.value }))}>
                {TEAM_ROLE_PRESETS.map((role) => <option key={role} value={role}>{role}</option>)}
              </Form.Select>
            </Form.Group>
            {createMemberError && <Alert variant="danger" className="mt-3 mb-0 py-2">{createMemberError}</Alert>}
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline-secondary" disabled={createMemberSubmitting} onClick={() => setCreateMemberOpen(false)}>Annulla</Button>
            <Button type="submit" disabled={createMemberSubmitting}>{createMemberSubmitting ? 'Creazione...' : 'Crea utente'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal className="team-modal" show={inviteOpen} onHide={() => !inviteSubmitting && setInviteOpen(false)} centered backdrop={inviteSubmitting ? 'static' : true}>
        <Modal.Header closeButton={!inviteSubmitting}><Modal.Title>Invita membro</Modal.Title></Modal.Header>
        <Form onSubmit={onInviteSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3"><Form.Label>Email</Form.Label><Form.Control type="email" value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Ruolo preset</Form.Label><Form.Select value={inviteForm.rolePreset} onChange={(event) => setInviteForm((current) => ({ ...current, rolePreset: event.target.value }))}>{invitableRoles.map((role) => <option key={role} value={role}>{role}</option>)}</Form.Select></Form.Group><Form.Text className="text-muted d-block mb-3">Puoi invitare al tuo ruolo o a uno più basso. I ruoli più alti del tuo non compaiono.</Form.Text>
            <Form.Group><Form.Label>Scadenza (giorni)</Form.Label><Form.Select value={inviteForm.expiresInDays} onChange={(event) => setInviteForm((current) => ({ ...current, expiresInDays: Number(event.target.value) }))}>{[3, 7, 14, 30].map((days) => <option key={days} value={days}>{days}</option>)}</Form.Select></Form.Group>
            {inviteError && <Alert variant="danger" className="mt-3 mb-0 py-2">{inviteError}</Alert>}
            {inviteOutcome && (inviteOutcome.detail || inviteOutcome.showLink) && (
              <Alert
                variant={inviteOutcome.tone === INVITE_DELIVERY_TONE.warning ? 'warning' : 'info'}
                className="mt-3 mb-0"
              >
                <div className="small fw-semibold mb-1">{inviteOutcome.title}</div>
                {inviteOutcome.detail && <div className="small mb-2">{inviteOutcome.detail}</div>}
                {inviteOutcome.showLink && (
                  <>
                    <div className="small text-break mb-2">{inviteCreated.inviteLink}</div>
                    <Button size="sm" variant="outline-primary" onClick={() => void onCopyText(inviteCreated.inviteLink)}>Copia link</Button>
                  </>
                )}
              </Alert>
            )}
            {inviteCreated?.invitePreviewUrl && (
              <Alert variant="success" className="mt-3 mb-0">
                <div className="small mb-2">Email inviata (preview dev):</div>
                <a href={inviteCreated.invitePreviewUrl} target="_blank" rel="noreferrer" className="small text-break d-inline-block">
                  {inviteCreated.invitePreviewUrl}
                </a>
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline-secondary" disabled={inviteSubmitting} onClick={() => setInviteOpen(false)}>Chiudi</Button>
            <Button type="submit" disabled={inviteSubmitting}>{inviteSubmitting ? 'Invio...' : 'Invia invito'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal className="team-modal" show={rolesDialog.open} onHide={() => !rolesDialog.saving && setRolesDialog(CLOSED_ROLES_DIALOG)} centered backdrop={rolesDialog.saving ? 'static' : true}>
        <Modal.Header closeButton={!rolesDialog.saving}><Modal.Title>Gestione ruolo</Modal.Title></Modal.Header>
        <Form onSubmit={onSaveRoles}>
          <Modal.Body>
            {rolesDialog.member && <div className="small text-muted mb-2">Membro: {rolesDialog.member.name || rolesDialog.member.email}</div>}
            <Form.Group><Form.Label>Ruolo base</Form.Label><Form.Select value={rolesDialog.roleName} onChange={(event) => setRolesDialog((current) => ({ ...current, roleName: event.target.value }))}>{TEAM_ROLE_PRESETS.map((role) => <option key={role} value={role}>{role}</option>)}</Form.Select></Form.Group>
            {canAssignCustomRoles && customRoles.length > 0 && (
              <Form.Group className="mt-3">
                <Form.Label>Ruoli aggiuntivi</Form.Label>
                <div className="small text-muted mb-2">Sommano permessi al ruolo base.</div>
                {customRoles.map((role) => (
                  <Form.Check
                    key={role.id}
                    type="checkbox"
                    id={`custom-role-${role.id}`}
                    label={role.name}
                    checked={rolesDialog.customRoleIds.includes(role.id)}
                    onChange={(event) => setRolesDialog((current) => ({
                      ...current,
                      customRoleIds: event.target.checked
                        ? [...current.customRoleIds, role.id]
                        : current.customRoleIds.filter((id) => id !== role.id),
                    }))}
                  />
                ))}
              </Form.Group>
            )}
            {rolesDialog.error && <Alert variant="danger" className="mt-3 mb-0 py-2">{rolesDialog.error}</Alert>}
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline-secondary" disabled={rolesDialog.saving} onClick={() => setRolesDialog(CLOSED_ROLES_DIALOG)}>Annulla</Button>
            <Button type="submit" disabled={rolesDialog.saving}>{rolesDialog.saving ? 'Salvataggio...' : 'Salva ruolo'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal className="team-modal" show={stateDialog.open} onHide={() => !stateDialog.saving && setStateDialog({ open: false, member: null, nextActive: false, saving: false, error: '' })} centered backdrop={stateDialog.saving ? 'static' : true}>
        <Modal.Header closeButton={!stateDialog.saving}><Modal.Title>{stateDialog.nextActive ? 'Riattiva membro' : 'Disattiva membro'}</Modal.Title></Modal.Header>
        <Modal.Body>
          {stateDialog.member && <p className="mb-2">Confermi {stateDialog.nextActive ? 'riattivazione' : 'disattivazione'} di <strong>{stateDialog.member.name || stateDialog.member.email}</strong>?</p>}
          {stateDialog.error && <Alert variant="danger" className="mb-0 py-2">{stateDialog.error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline-secondary" disabled={stateDialog.saving} onClick={() => setStateDialog({ open: false, member: null, nextActive: false, saving: false, error: '' })}>Annulla</Button>
          <Button variant={stateDialog.nextActive ? 'success' : 'danger'} disabled={stateDialog.saving} onClick={() => void onConfirmStateChange()}>{stateDialog.saving ? 'Salvataggio...' : (stateDialog.nextActive ? 'Riattiva' : 'Disattiva')}</Button>
        </Modal.Footer>
      </Modal>

      <Modal className="team-modal" show={deleteDialog.open} onHide={() => !deleteDialog.saving && setDeleteDialog({ open: false, member: null, saving: false, error: '' })} centered backdrop={deleteDialog.saving ? 'static' : true}>
        <Modal.Header closeButton={!deleteDialog.saving}><Modal.Title>Elimina membro</Modal.Title></Modal.Header>
        <Modal.Body>
          {deleteDialog.member && (
            <p className="mb-2">
              Confermi eliminazione di <strong>{deleteDialog.member.name || deleteDialog.member.email}</strong> dal workspace?
            </p>
          )}
          <div className="small text-muted mb-2">L utente non verra eliminato globalmente, solo rimosso da questo workspace.</div>
          {deleteDialog.error && <Alert variant="danger" className="mb-0 py-2">{deleteDialog.error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline-secondary" disabled={deleteDialog.saving} onClick={() => setDeleteDialog({ open: false, member: null, saving: false, error: '' })}>Annulla</Button>
          <Button variant="danger" disabled={deleteDialog.saving} onClick={() => void onConfirmDeleteMember()}>{deleteDialog.saving ? 'Eliminazione...' : 'Elimina membro'}</Button>
        </Modal.Footer>
      </Modal>

      <ToastContainer position="bottom-right" theme="light" />
      </div>
    </div>
  );
};

const TeamPage = () => (
  <TeamModuleGate requiredPermission={TEAM_PERMISSIONS.view}>
    {({ access }) => <TeamWorkspacePage access={access} />}
  </TeamModuleGate>
);

export default TeamPage;
