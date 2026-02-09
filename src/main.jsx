import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
//scss
import './styles/scss/style.scss';
import { Provider } from 'react-redux';
import store from './redux/store';
import { ThemeProvider } from './utils/theme-provider/theme-provider.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <ThemeProvider>
    <Provider store={store} >
      <App />
    </Provider>
  </ThemeProvider>
  // </React.StrictMode>,
)
