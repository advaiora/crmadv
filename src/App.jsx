import React from 'react';
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom';
import AuthRoutes from './routes/AuthRoutes';
import AppRoutes from './routes/AppRoutes'
import "bootstrap/js/src/collapse";
import ScrollToTop from './utils/ScrollToTop';
import Login from './views/Authentication/LogIn/Login/Login';
import AcceptInvite from './views/Authentication/AcceptInvite';
import ResetPassword from './views/Authentication/ResetPassword';
import { readSession } from './lib/session';

const isAuthenticated = () => Boolean(readSession());

const ProtectedRoute = ({ render, ...rest }) => (
  <Route
    {...rest}
    render={(props) =>
      isAuthenticated() ? render(props) : <Redirect to="/login" />
    }
  />
);

const LoginRoute = ({ ...rest }) => (
  <Route
    {...rest}
    render={(props) =>
      isAuthenticated() ? <Redirect to="/dashboard" /> : <Login {...props} />
    }
  />
);

function App() {
  return (
    <>
      <BrowserRouter>
        <ScrollToTop>
          <Switch>
            <Redirect exact from="/" to="/dashboard" />
            <LoginRoute exact path="/login" />
            <LoginRoute exact path="/auth/login" />
            <Route exact path="/accept-invite" component={AcceptInvite} />
            {/* ⚠️ Di primo livello, non sotto `/auth`, perche' e' l'indirizzo che il
                server scrive nell'email: `${baseUrl}/reset-password?token=...`
                (`server/modules/password/password-reset.service.ts`). Sotto `/auth` la
                pagina esiste comunque — `authRoutes` in `RouteList.jsx` monta tutto con
                quel prefisso — ma il link ricevuto per posta cadrebbe nella rotta
                protetta `path="/"` e rimanderebbe alla schermata di accesso, buttando
                via il token. Stesso motivo per cui `/accept-invite` sta qui sopra. */}
            <Route exact path="/reset-password" component={ResetPassword} />
            <Route path="/auth" render={(props) => <AuthRoutes {...props} />} />
            <ProtectedRoute path="/" render={(props) => <AppRoutes {...props} />} />
          </Switch>
        </ScrollToTop>
      </BrowserRouter>
    </>
  );
}

export default App;
