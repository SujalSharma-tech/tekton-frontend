import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DeployForm from "./DeployForm";
import DeploymentModal from "./DeploymentModal";
import { useProjects } from "../context/ProjectContext";

function Dashboard({ user, onLogout }) {
  const {
    projects,
    isLoading,
    error,
    fetchProjects, // Add this
    createProject,
    activeDeployment,
    setActiveDeployment,
    shouldShowDeploymentModal,
    setShouldShowDeploymentModal,
    handleDeploymentComplete,
  } = useProjects();

  const [showDeployForm, setShowDeployForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [currentProjectToEdit, setCurrentProjectToEdit] = useState(null);
  const navigate = useNavigate();

  // Add force refresh when coming from deletion
  useEffect(() => {
    // Force a fresh fetch of projects when dashboard mounts
    const loadProjects = async () => {
      try {
        await fetchProjects();
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
    };

    loadProjects();

    // Clean up any previous project-specific intervals
    return () => {
      if (window.projectIntervals) {
        window.projectIntervals.forEach((interval) => clearInterval(interval));
        window.projectIntervals = [];
      }
    };
  }, []);

  // Handle adding a new project
  const handleAddProject = async (projectData) => {
    try {
      await createProject(projectData);
      setShowDeployForm(false);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.message || "Failed to add project",
      };
    }
  };

  // Helper function to determine status color
  const getStatusColor = (status) => {
    if (!status) return "text-gray-500";

    switch (status.toLowerCase()) {
      case "success":
        return "text-green-500";
      case "running":
        return "text-yellow-500";
      case "failure":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  // Skeleton UI for loading state
  const ProjectSkeleton = () => (
    <li className="animate-pulse p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="mt-1 flex items-center">
            <div className="h-4 bg-gray-200 rounded w-16 mr-2"></div>
            <div className="h-4 bg-gray-200 rounded w-40"></div>
          </div>
        </div>
        <div className="h-5 w-5 bg-gray-200 rounded-full"></div>
      </div>
    </li>
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-300 text-red-700 p-4 rounded max-w-md w-full">
          <h2 className="font-medium">Error Loading Projects</h2>
          <p className="mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white py-4 px-6 shadow">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            Project Dashboard
          </h1>
          <div className="flex items-center">
            <span className="mr-4 text-gray-600">
              Welcome, {user?.name || ""}
            </span>
            <button
              onClick={onLogout}
              className="py-2 px-4 border border-red-600 text-red-600 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Your Projects</h2>
          <button
            onClick={() => setShowDeployForm(true)}
            className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            New Project
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {isLoading ? (
              Array(4)
                .fill()
                .map((_, index) => (
                  <ProjectSkeleton key={`skeleton-${index}`} />
                ))
            ) : projects?.length > 0 ? (
              projects.map((project) => (
                <li
                  key={project.id}
                  className="border-b border-gray-200 last:border-b-0"
                >
                  <div className="flex items-center justify-between p-4 hover:bg-gray-50">
                    <div
                      onClick={() => {
                        navigate(`/project/${project.id}`);
                      }}
                      className="flex-grow flex items-center justify-between cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-medium text-gray-900">
                          {project.name}
                        </h3>
                        <div className="mt-1 flex items-center flex-wrap">
                          <span
                            className={`inline-block mr-2 ${getStatusColor(
                              project?.deployments?.[0]?.status || "Not Started"
                            )}`}
                          >
                            {project?.deployments?.[0]?.status || "Not Started"}
                            {project?.deployments?.[0]?.status ===
                              "running" && (
                              <span className="ml-1 inline-block animate-pulse">
                                ⟳
                              </span>
                            )}
                          </span>
                          <span className="text-sm text-gray-500 mr-2">
                            Last updated:{" "}
                            {new Date(
                              project.updatedAt || project.createdAt
                            ).toLocaleString()}
                          </span>
                          {project?.deployments?.[0]?.status === "running" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDeployment({
                                  projectId: project.id,
                                  projectName: project.name,
                                });
                              }}
                              className="mt-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              View Logs
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentProjectToEdit(project);
                        setShowEditForm(true);
                      }}
                      className="ml-4 py-1 px-3 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))
            ) : (
              <li className="p-4 text-center text-gray-500">
                No projects found. Click "New Project" to create one.
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Modal for DeployForm */}
      {showDeployForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="w-full max-w-lg mx-4">
            <DeployForm
              onSubmit={async (formData) => {
                try {
                  const result = await createProject(formData);

                  // Close the form
                  setShowDeployForm(false);

                  // The context should handle showing the deployment modal
                  // No need to do anything else here
                } catch (err) {
                  console.error("Error creating project:", err);
                  // Error will be shown in the form
                }
              }}
              onCancel={() => setShowDeployForm(false)}
            />
          </div>
        </div>
      )}

      {/* Modal for EditForm */}
      {showEditForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="w-full max-w-lg mx-4">
            <DeployForm
              existingProject={currentProjectToEdit}
              onSubmit={async (projectData) => {
                try {
                  await updateProject(currentProjectToEdit.id, projectData);
                  setShowEditForm(false);
                  return { success: true };
                } catch (err) {
                  return {
                    success: false,
                    error: err.message || "Failed to update project",
                  };
                }
              }}
              onCancel={() => setShowEditForm(false)}
            />
          </div>
        </div>
      )}

      {/* Deployment Modal with Live Logs */}
      {activeDeployment && (
        <DeploymentModal
          projectId={activeDeployment.projectId}
          projectName={activeDeployment.projectName}
          onClose={() => setActiveDeployment(null)}
          onComplete={handleDeploymentComplete}
        />
      )}
    </div>
  );
}

export default Dashboard;
