import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
//scss
import './styles/tailwind.css';
import './styles/scss/style.scss';
import './styles/scss/globals.css';
// Fase 1 — layer di fondazione Apple-style. DEVE stare dopo globals.css
// (riusa .glass-edge e il gradiente del bordo vetro) e prima di design-tokens.css.
import './styles/scss/apple-foundation.css';
import './styles/design-tokens.css';
import { Provider } from 'react-redux';
import store from './redux/store';
import { ThemeProvider } from './utils/theme-provider/theme-provider.jsx';
import { SessionProvider } from './components/session-provider';

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <ThemeProvider>
    <SessionProvider>
      <Provider store={store} >
        <App />
      </Provider>
    </SessionProvider>
  </ThemeProvider>
  // </React.StrictMode>,
)
