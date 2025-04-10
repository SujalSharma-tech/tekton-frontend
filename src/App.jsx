import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Dashboard from "./components/Dashboard";
import LoginForm from "./components/LoginPage";
import RegisterForm from "./components/RegisterPage";
import ProjectDetails from "./components/ProjectDetails";
import { ProjectProvider, useProjects } from "./context/ProjectContext"; // Add useProjects here

// Create a wrapper component that uses router hooks
function AppContent() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get fetchProjects from context
  const { fetchProjects } = useProjects();

  // Clear any lingering requests on route change
  useEffect(() => {
    // Cancel any pending axios requests
    if (window.axiosCancelTokens) {
      window.axiosCancelTokens.forEach((cancel) => {
        if (cancel && typeof cancel === "function") {
          cancel("Route changed");
        }
      });
      window.axiosCancelTokens = [];
    }
  }, [location.pathname]);

  // Rest of your existing logic
  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (token && userData) {
      setUser(JSON.parse(userData));
    }

    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const handleLogin = async (userData) => {
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);

    // After login is successful and user state is updated,
    // fetch projects immediately so they're ready when Dashboard loads
    if (fetchProjects) {
      try {
        await fetchProjects();
      } catch (err) {
        console.error("Error fetching projects after login:", err);
        // Don't block the login flow due to project fetch failure
      }
    }
  };

  // Protected route logic
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/dashboard" />
          ) : (
            <LoginForm onLogin={handleLogin} />
          )
        }
      />
      <Route
        path="/register"
        element={
          user ? (
            <Navigate to="/dashboard" />
          ) : (
            <RegisterForm onRegister={handleLogin} />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          user ? (
            <Dashboard user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/project/:id"
        element={
          user ? (
            <ProjectDetails user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/"
        element={<Navigate to={user ? "/dashboard" : "/login"} />}
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <ProjectProvider>
        <AppContent />
      </ProjectProvider>
    </Router>
  );
}

export default App;
