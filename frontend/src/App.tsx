import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import LandingPage from "./features/landing/LandingPage";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import SessionExpiredPage from "./features/auth/SessionExpiredPage";
import NotFoundPage from "./features/auth/NotFoundPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import LocoBookingUI from "./features/bookings/LocoBookingUI";
import EmployeesBookingWizard from "./features/bookings/EmployeesBookingWizard";
import EmployeeAvailability from "./features/bookings/EmployeeAvailability";
import BookingPreview from "./features/bookings/BookingPreview";
import JobCarryForwardPage from "./features/bookings/JobCarryForwardPage";
import MasterDataPage from "./features/crud/MasterDataPage";
import ProtectedRoute from "./shared/components/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/session-expired" element={<SessionExpiredPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/loco"
          element={
            <ProtectedRoute requireSupervisor={true}>
              <LocoBookingUI />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/employees"
          element={
            <ProtectedRoute requireSupervisor={true}>
              <EmployeesBookingWizard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/carry-forward"
          element={
            <ProtectedRoute requireSupervisor={true}>
              <JobCarryForwardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/availability"
          element={
            <ProtectedRoute requireSupervisor={true}>
              <EmployeeAvailability />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/preview"
          element={
            <ProtectedRoute>
              <BookingPreview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crud"
          element={
            <ProtectedRoute requireSupervisor={true}>
              <MasterDataPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
