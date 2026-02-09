import React from 'react';
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom';
import AuthRoutes from './routes/AuthRoutes';
import AppRoutes from './routes/AppRoutes'
import "bootstrap/js/src/collapse";
import ScrollToTop from './utils/ScrollToTop';

function App() {
  return (
    <>
      <BrowserRouter>
        <BrowserRouter >
          <ScrollToTop>
            <Switch>
              <Redirect exact from="/" to="/dashboard" />
              {/* Auth */}
              <Route path="/auth" render={(props) => <AuthRoutes {...props} />} />
              {/* Layouts */}
              <Route path="/" render={(props) => <AppRoutes {...props} />} />
            </Switch>
          </ScrollToTop>
        </BrowserRouter>
      </BrowserRouter>
    </>
  );
}

export default App;
