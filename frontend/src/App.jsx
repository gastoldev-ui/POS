// src/App.jsx
import { POSProvider } from './context/POSContext';
import PanelPOS from './components/PanelPOS';

export default function App() {
  return (
    <POSProvider>
      <PanelPOS />
    </POSProvider>
  );
}