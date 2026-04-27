import { Routes, Route, Navigate } from "react-router-dom";
import { StartPage } from "../Pages/StartPage";
import { RegistrationPage } from "../Pages/RegistrationPage";
import { ProfilePage } from "../Pages/ProfilePage";
import { PatientsPage } from "../Pages/PatientsPage";
import { PatientPage } from "../Pages/PatientPage";
import { CreateInspectionPage } from "../Pages/CreateInspectionPage";
import { ConsultationsPage } from "../Pages/ConsultationsPage";
import { InspectionPage } from "../Pages/InspectionPage";
import { ReportsPage } from "../Pages/ReportsPage";
import { ProtectedRouter } from "./ProtectedRouter";

export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<StartPage />} />
      <Route path="/registration" element={<RegistrationPage />} />
      <Route
        path="/profile"
        element={
          <ProtectedRouter>
            <ProfilePage />
          </ProtectedRouter>
        }
      />
      <Route
        path="/patients"
        element={
          <ProtectedRouter>
            <PatientsPage />
          </ProtectedRouter>
        }
      />
      <Route
        path="/consultations"
        element={
          <ProtectedRouter>
            <ConsultationsPage />
          </ProtectedRouter>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRouter>
            <ReportsPage />
          </ProtectedRouter>
        }
      />
      <Route
        path="/patient/:id"
        element={
          <ProtectedRouter>
            <PatientPage />
          </ProtectedRouter>
        }
      />
      <Route
        path="/patient/:id/inspections/create"
        element={
          <ProtectedRouter>
            <CreateInspectionPage />
          </ProtectedRouter>
        }
      />
      <Route
        path="/inspection/:id"
        element={
          <ProtectedRouter>
            <InspectionPage />
          </ProtectedRouter>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};
