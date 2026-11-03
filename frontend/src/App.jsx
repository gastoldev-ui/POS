// src/App.jsx
import { useState } from "react";
import { POSProvider } from "./context/POSContext";
import PanelPOS from "./components/PanelPOS";
import Admin from "./pages/Admin";

export default function App() {
  const [vista, setVista] = useState("pos"); 

  const irAPos = () => setVista("pos");
  const irAAdmin = () => setVista("admin");

  if (vista === "admin") {
    return <Admin onVolverAlPOS={irAPos} />;
  }

  return (
    <POSProvider>
      <PanelPOS onAbrirAdmin={irAAdmin} />
    </POSProvider>
  );
}