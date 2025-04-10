import React, { useState, useEffect, useRef } from "react";
import {
  useParams,
  useSearchParams,
  Link,
  useNavigate,
} from "react-router-dom";
import LogViewer from "./LogViewer";
import DeployForm from "./DeployForm";
import DeploymentModal from "./DeploymentModal";
import { useProjects } from "../context/ProjectContext";

// Add a local loading state to your component

function ProjectDetails({ user, onLogout }) {
  const { id: projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlDeploymentId = searchParams.get("deploymentId");
  const navigate = useNavigate();

  const {
    getProjectById,
    fetchProjectById,
    updateProject,
    deleteProject,
    rebuildProject,
  } = useProjects();

  const [project, setProject] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [rebuildLoading, setRebuildLoading] = useState(false);

  // Add these two local state variables
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add an isDeleted ref to prevent fetching after deletion
  const isDeleted = useRef(false);

  // Add a loading lock to prevent duplicate loading
  const loadingLockRef = useRef(false);

  // Split into two separate effects

  // Effect 1: Initial project loading (runs once when component mounts or projectId changes)
  useEffect(() => {
    // Skip if we're already loading
    if (loadingLockRef.current) return;

    const loadProject = async () => {
      // Skip if already deleted
      if (isDeleted.current) {
        return;
      }

      try {
        // Set lock to prevent duplicate loading
        loadingLockRef.current = true;
        setIsLoading(true);

        const projectData = await getProjectById(projectId);

        if (!isDeleted.current) {
          // Check again before setting state
          setProject(projectData);
        }
      } catch (err) {
        console.error("Error loading project:", err);
        setError(err.message || "Failed to load project");
      } finally {
        setIsLoading(false);
        // Release lock after loading completes
        loadingLockRef.current = false;
      }
    };

    loadProject();
  }, [projectId, getProjectById]); // Remove project from dependencies

  // Effect 2: Set up polling for running projects
  useEffect(() => {
    if (!project) return; // Only run when project is loaded

    // Only set up interval if project is in running state
    if (project?.deployments?.[0]?.status?.toLowerCase() !== "running") return;

    const refreshInterval = setInterval(async () => {
      try {
        const refreshedProject = await getProjectById(projectId);
        setProject(refreshedProject);
      } catch (err) {
        console.error("Error refreshing project:", err);
      }
    }, 10000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [projectId, getProjectById, project?.deployments?.[0]?.status]); // Only depends on status

  // Update handleRebuild to emphasize the running status

  const handleRebuild = async () => {
    if (rebuildLoading) {
      return;
    }

    try {
      setRebuildLoading(true);

      if (!project?.id) {
        throw new Error("Project ID is missing");
      }

      // First update UI to show running immediately
      setProject((prev) => ({
        ...prev,
        deployments: prev.deployments
          ? [
              { ...prev.deployments[0], status: "running" },
              ...prev.deployments.slice(1),
            ]
          : [{ status: "running" }],
      }));

      // Call rebuildProject and get the result with deploymentId
      const result = await rebuildProject(project.id);

      // Force refresh the project data to get latest deployment info
      const refreshedProject = await getProjectById(projectId);

      // Make sure running status is preserved
      if (refreshedProject && refreshedProject.deployments?.[0]) {
        refreshedProject.deployments[0].status = "running";
      }

      setProject(refreshedProject);

      // Update URL with deploymentId
      if (result.deploymentId) {
        setSearchParams({ deploymentId: result.deploymentId });
      }
    } catch (err) {
      console.error("Error during rebuild:", err);
    } finally {
      setRebuildLoading(false);
    }
  };

  const handleEditProject = async (updatedData) => {
    try {
      const updatedProject = await updateProject(projectId, updatedData);
      setProject(updatedProject);
      setShowEditForm(false);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.message || "Failed to update project",
      };
    }
  };

  // Update the handleDeleteProject function

  const handleDeleteProject = async () => {
    if (!window.confirm("Are you sure you want to delete this project?")) {
      return;
    }

    try {
      // Mark as deleted to prevent further API calls
      isDeleted.current = true;

      // Delete the project
      await deleteProject(projectId);

      // Try to cancel any pending requests for this project
      if (window.axiosCancelTokens) {
        window.axiosCancelTokens.forEach((cancel) => {
          if (typeof cancel === "function") {
            try {
              cancel("Project deleted");
            } catch (err) {
              // Ignore cancel errors
              console.error(err);
            }
          }
        });
      }

      // Navigate to dashboard with replace: true to prevent back navigation
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Failed to delete project:", err);
      setError(err.message || "Failed to delete project");
    }
  };

  // Helper function to determine status color
  const getStatusColor = (status) => {
    if (!status) return "text-gray-500";

    switch (status?.toLowerCase()) {
      case "deployed":
      case "success":
        return "text-green-500";
      case "building":
      case "running":
        return "text-yellow-500";
      case "failed":
      case "failure":
        return "text-red-500";
      case "queued":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };

  // Skeleton UI for project details
  const ProjectDetailsSkeleton = () => (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white py-4 px-6 shadow">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
          <div className="h-5 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="flex items-center">
            <div className="h-4 bg-gray-200 rounded w-32 mr-4 animate-pulse"></div>
            <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-40 mb-6"></div>
            {Array(6)
              .fill()
              .map((_, i) => (
                <div
                  key={`info-skeleton-${i}`}
                  className="flex justify-between py-3 border-b border-gray-200"
                >
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </div>
              ))}
            <div className="mt-6">
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
            <div className="mt-4">
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="h-5 bg-gray-200 rounded w-36 mb-6 animate-pulse"></div>
            <div className="border border-gray-200 rounded-md">
              <div className="bg-gray-50 p-3 border-b border-gray-200">
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                </div>
              </div>
              {Array(5)
                .fill()
                .map((_, i) => (
                  <div
                    key={`log-row-${i}`}
                    className="p-3 border-b border-gray-200"
                  >
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-2 h-3 bg-gray-200 rounded"></div>
                      <div className="col-span-1 h-3 bg-gray-200 rounded"></div>
                      <div className="col-span-9 h-3 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Add refreshing logic when deployment completes

  //   const onDeploymentComplete = async (status, projectId) => {

  //     try {
  //       // First call the context's handleDeploymentComplete
  //       await handleDeploymentComplete(status, projectId);

  //       // Then update local state - ADD AWAIT HERE
  //       const updatedProject = await getProjectById(projectId); // Was missing await!
  //       if (updatedProject) {
  //         setProject(updatedProject);

  //       }
  //     } catch (err) {
  //       console.error("Error updating project details after deployment:", err);
  //     }
  //   };

  // Modify the part after loading check:
  if (isLoading) {
    return <ProjectDetailsSkeleton />;
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-300 text-red-700 p-4 rounded max-w-md w-full">
          <h2 className="font-medium">Project Not Found</h2>
          <p className="mt-2">
            Could not load project data. The project may not exist.
          </p>
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-lg w-full">
          <h3 className="text-lg font-medium mb-2">Error</h3>
          <p>{error}</p>
          <div className="mt-4 flex justify-between">
            <button
              onClick={() => fetchProjectById(projectId)}
              className="py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Try Again
            </button>
            <Link
              to="/dashboard"
              className="py-2 px-4 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white py-4 px-6 shadow">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
          <div className="flex items-center">
            <span className="mr-4 text-gray-600">Welcome, {user.name}</span>
            <button
              onClick={onLogout}
              className="py-2 px-4 border border-red-600 text-red-600 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Project Information
            </h3>

            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600">Status:</span>
              <span
                className={`font-medium ${getStatusColor(
                  project?.deployments?.[0]?.status
                )}`}
              >
                {project?.deployments?.[0]?.status || "Not Deployed"}
                {project?.deployments?.[0]?.status?.toLowerCase() ===
                  "running" && (
                  <span className="ml-1 inline-block animate-pulse">⟳</span>
                )}
              </span>
            </div>

            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600">GitURL: </span>
              <a
                href={project.gitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate max-w-xs"
              >
                {project.gitUrl}
              </a>
            </div>

            {project.subDomain && (
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Domain: </span>
                <a
                  href={`https://${project.subDomain}.sujal.codes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {project.subDomain}.sujal.codes
                </a>
              </div>
            )}

            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600">Deployed:</span>
              <span>
                {project.deployments && project.deployments[0]?.updatedAt
                  ? new Date(project.deployments[0].updatedAt).toLocaleString()
                  : "Not deployed yet"}
              </span>
            </div>

            {project.buildCommand && (
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Build Command:</span>
                <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                  {project.buildCommand}
                </span>
              </div>
            )}

            {project.environment && (
              <div className="flex justify-between py-3 border-b border-gray-200">
                <span className="text-gray-600">Environment:</span>
                <span>{project.environment}</span>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={handleRebuild}
                disabled={rebuildLoading}
                className={`flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-150 ${
                  rebuildLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {rebuildLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Rebuilding...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      ></path>
                    </svg>
                    Rebuild
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => setShowEditForm(true)}
                className="flex-1 py-2 px-4 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Edit
              </button>

              <button
                onClick={handleDeleteProject}
                className="flex-1 py-2 px-4 border border-red-600 text-red-600 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Deployment Logs
            </h3>

            {urlDeploymentId || project?.deployments?.[0]?.id ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  {/* Status display unchanged */}
                </div>

                <LogViewer
                  deploymentId={
                    urlDeploymentId || project?.deployments?.[0]?.id
                  }
                  projectId={projectId}
                  key={`log-${
                    urlDeploymentId || project?.deployments?.[0]?.id
                  }`}
                />
              </>
            ) : (
              <div className="p-4 border border-gray-200 rounded-md text-gray-500">
                No deployment logs available yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="w-full max-w-lg mx-4">
            <DeployForm
              existingProject={project}
              onSubmit={handleEditProject}
              onCancel={() => setShowEditForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectDetails;
