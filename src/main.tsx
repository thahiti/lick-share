import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/components/App';
import './styles/tokens.css';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소가 없습니다');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
