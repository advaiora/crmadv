import React from 'react';
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom';
import AuthRoutes from './routes/AuthRoutes';
import AppRoutes from './routes/AppRoutes'
import "bootstrap/js/src/collapse";
import ScrollToTop from './utils/ScrollToTop';
import Login from './views/Authentication/LogIn/Login/Login';
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
            <Route path="/auth" render={(props) => <AuthRoutes {...props} />} />
            <ProtectedRoute path="/" render={(props) => <AppRoutes {...props} />} />
          </Switch>
        </ScrollToTop>
      </BrowserRouter>
    </>
  );
}

export default App;
