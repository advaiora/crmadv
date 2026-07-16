// Alfabeto delle icone del sistema chat (spec 4-ter §6, richiesta del 15/7/2026).
//
// LA REGOLA: un'icona per CONCETTO, non una per contesto. Prima di questo file
// c'era un solo fumetto (MessageCircle) usato per tre cose diverse — il pulsante
// in topbar, il titolo del popup e l'elenco sessioni — e un'icona che significa
// tutto non significa piu' niente. Con due mondi sotto lo stesso ingresso
// (Messaggi e Chat AI) la confusione diventerebbe insostenibile.
//
// CHI AGGIUNGE un pezzo di chat prende l'icona DA QUI. Se il concetto non c'e',
// si aggiunge una voce a questo elenco — non si pesca a caso da react-feather:
// e' cosi' che nascono i tre fumetti.
//
// Vincoli (design §1.1): react-feather, icone lineari coerenti, nessun ornamento.
// Il touch target minimo di 44px (§3.1) e' responsabilita' del CSS, non dell'icona.

import {
  Archive,
  ArrowUpRight,
  ChevronLeft,
  Cpu,
  Edit2,
  List,
  Maximize2,
  MessageSquare,
  Minimize2,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  UserPlus,
  Users,
  X,
} from "react-feather";

// --- I tre concetti che non vanno mai confusi ---

// L'INGRESSO alle chat (pulsante in topbar): la porta che apre l'aggregato, non
// uno dei due mondi. E' l'unico fumetto del sistema: qui il simbolo universale
// della conversazione e' giusto proprio perche' non dice quale delle due.
export const IconChatEntry = MessageSquare;

// Il mondo MESSAGGISTICA: parlare fra PERSONE. L'icona dice le persone, non il
// fumetto — cosi' non compete con l'ingresso.
export const IconMessaging = Users;

// Il mondo CHAT AI: svolgere lavoro con la macchina. Mai un fumetto: e' la
// differenza che il selettore esiste per rendere visibile.
export const IconAi = Cpu;

// --- Gli oggetti della conversazione ---

export const IconSessionList = List; // elenco delle conversazioni
export const IconNewChat = Plus; // nuova conversazione
export const IconRename = Edit2; // rinomina una conversazione
export const IconArchived = Archive; // conversazione archiviata (ci sei uscito)
export const IconResume = RotateCcw; // riprendi un'archiviata in una nuova chat

// Gestire CHI c'e' dentro una sessione: e' un'azione sulle persone di quella
// conversazione, distinta dal mondo Messaggistica (IconMessaging = Users).
export const IconParticipants = UserPlus;

export const IconAttach = Paperclip; // allega un documento o un elemento del CRM

// Navigazione suggerita dall'AI (Fase 6): "vai a quest'area del CRM". La freccia in
// uscita dice "ti porto altrove", coerente con l'affordance "apri" gia' usata nel
// prodotto (es. il tasto Open del widget "I miei progetti").
export const IconNavigate = ArrowUpRight;

// --- La finestra ---

export const IconExpand = Maximize2; // il popup va a tutto schermo
export const IconCollapse = Minimize2; // e torna popup
export const IconClose = X;
export const IconBack = ChevronLeft;
export const IconSearch = Search;

// NON LETTI: non e' un'icona ma un pallino d'accento (`.ai-chat-dot` in
// ai-chat-widget.css). Un'icona accanto al conteggio sarebbe ridondante, e il
// design (§4.1) vuole un solo accento per vista.
