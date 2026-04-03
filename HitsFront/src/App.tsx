import { BrowserRouter } from 'react-router-dom'
import "./AppShell.module.css";
import { AppRouter } from './Routes/AppRouter'
import { Header } from "./components/Header/Header";
const AppContent = () => {
  return (
    <>
      <Header />
      <AppRouter/>
    </>
  );
}
export const App = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
