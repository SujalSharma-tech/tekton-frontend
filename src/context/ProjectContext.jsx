import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import axios from "axios";

const ProjectContext = createContext();
export const useProjects = () => useContext(ProjectContext);

// Memoize the getProjectById function

export const ProjectProvider = ({ children }) => {
  // Your existing state
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Add a loadingRef to track ongoing requests
  const loadingRef = useRef({});

  // Memoize the getProjectById function
  const getProjectById = useCallback(
    async (projectId) => {
      // Create a cancellation token
      const CancelToken = axios.CancelToken;
      const source = CancelToken.source();

      // Store for potential cancellation
      if (!window.axiosCancelTokens) window.axiosCancelTokens = [];
      window.axiosCancelTokens.push(source.cancel);

      // Prevent duplicate requests for the same project ID
      if (loadingRef.current[projectId]) {
        return loadingRef.current[projectId];
      }

      try {
        setIsLoading(true);

        // Store promise in ref to prevent duplicate requests
        loadingRef.current[projectId] = (async () => {
          // First check if we have it in state
          const cachedProject = projects.find((p) => p.id === projectId);

          if (cachedProject) {
            return cachedProject;
          }

          // Otherwise fetch from API

          const response = await axios.get(
            `${import.meta.env.VITE_PROD_URL}/project/${projectId}`,
            {
              withCredentials: true,
              headers: { "x-auth-token": localStorage.getItem("token") },
              cancelToken: source.token, // Add cancellation token
            }
          );

          if (response.data.status !== "success") {
            throw new Error(response.data.message || "Failed to fetch project");
          }

          const projectData = response.data.data.project;

          // Update state
          setProjects((prevProjects) => {
            // Check if we already have this project
            const exists = prevProjects.some((p) => p.id === projectId);
            if (exists) {
              return prevProjects.map((p) =>
                p.id === projectId ? projectData : p
              );
            } else {
              return [...prevProjects, projectData];
            }
          });

          return projectData;
        })();

        // Wait for the promise to resolve
        const result = await loadingRef.current[projectId];
        return result;
      } catch (err) {
        if (axios.isCancel(err)) {
          return null; // Return null for canceled requests
        }
        console.error(`Error fetching project ${projectId}:`, err);
        setError(err.message || "Failed to fetch project");
        throw err;
      } finally {
        setIsLoading(false);
        // Clean up the loading ref
        delete loadingRef.current[projectId];
        // Remove from cancellation list
        if (window.axiosCancelTokens) {
          window.axiosCancelTokens = window.axiosCancelTokens.filter(
            (c) => c !== source.cancel
          );
        }
      }
    },
    [projects]
  ); // Only depends on the projects array

  // Modify fetchProjects to check for token

  const fetchProjects = async () => {
    // Skip if no token exists
    const token = localStorage.getItem("token");
    if (!token) {
      return [];
    }

    try {
      setIsLoading(true);

      const response = await axios.get(
        `${import.meta.env.VITE_PROD_URL}/projects`,
        {
          withCredentials: true,
          headers: { "x-auth-token": token },
        }
      );

      if (response.data.status !== "success") {
        throw new Error(response.data.message || "Failed to fetch projects");
      }

      setProjects(response.data.data.projects);
      return response.data.data.projects;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Make sure createProject properly returns project and deployment IDs

  const createProject = async (projectData) => {
    try {
      setIsLoading(true);

      // 1. First create the project
      const response = await axios.post(
        `${import.meta.env.VITE_PROD_URL}/project`,
        projectData,
        {
          withCredentials: true,
          headers: { "x-auth-token": localStorage.getItem("token") },
        }
      );

      if (response.data.status !== "success") {
        throw new Error(response.data.message || "Failed to create project");
      }

      // Extract project data
      const newProject = response.data.data.project;

      // 2. Call the /deploy API
      const deployResponse = await axios.post(
        `${import.meta.env.VITE_PROD_URL}/deploy`,
        { projectId: newProject.id },
        {
          withCredentials: true,
          headers: { "x-auth-token": localStorage.getItem("token") },
        }
      );

      if (deployResponse.data.status !== "success") {
        throw new Error(
          deployResponse.data.message || "Failed to deploy project"
        );
      }

      const deploymentId = deployResponse.data.data.deployment_id;

      // Update state with running status
      const projectWithStatus = {
        ...newProject,
        deployments: [
          {
            id: deploymentId,
            status: "running",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      setProjects((prev) => [...prev, projectWithStatus]);

      // NO modal needed, just return the IDs
      return {
        projectId: newProject.id,
        deploymentId: deploymentId,
      };
    } catch (err) {
      console.error("Error creating project:", err);
      setError(err.message || "Failed to create project");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Add or update the updateProjectStatus function

  const updateProjectStatus = async (projectId, status) => {
    try {
      // Update the local state
      setProjects((prevProjects) =>
        prevProjects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                deployments: project.deployments
                  ? [
                      { ...project.deployments[0], status },
                      ...project.deployments.slice(1),
                    ]
                  : [{ status }],
              }
            : project
        )
      );

      // Optionally, you could also update the server
      // This is often not necessary as the server should track status on its own

      return true;
    } catch (err) {
      console.error("Error updating project status:", err);
      setError(err.message || "Failed to update project status");
      return false;
    }
  };

  // Fix the rebuildProject function to properly update project status

  const rebuildProject = async (projectId) => {
    try {
      setIsLoading(true);

      // Find the project in state
      const project = projects.find((p) => p.id === projectId);

      // Get the latest deploymentId
      const deploymentId = project?.deployments?.[0]?.id;

      if (!deploymentId) {
        throw new Error("No deployment found for this project");
      }

      // Make the rebuild API call first
      const response = await axios.post(
        `${import.meta.env.VITE_PROD_URL}/redeploy`,
        { deploymentId },
        {
          withCredentials: true,
          headers: { "x-auth-token": localStorage.getItem("token") },
        }
      );

      // Check API response
      if (response.data.status !== "success") {
        console.error("API error:", response.data);
        throw new Error(response.data.message || "Failed to rebuild project");
      }

      // Extract the new deployment ID
      const newDeploymentId = response.data.data?.deployment_id || deploymentId;

      // IMPORTANT: Now update the status AFTER we have the new deploymentId
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                deployments: [
                  {
                    ...p.deployments[0],
                    id: newDeploymentId, // Update with new ID
                    status: "running", // Set status to running
                    updatedAt: new Date().toISOString(), // Update timestamp
                  },
                  ...p.deployments.slice(1),
                ],
              }
            : p
        )
      );

      return {
        success: true,
        deploymentId: newDeploymentId,
      };
    } catch (err) {
      console.error("Error in rebuildProject:", err);
      setError(err.message || "Failed to rebuild project");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Update the deleteProject function with basic cleanup

  const deleteProject = async (projectId) => {
    try {
      setIsLoading(true);

      // First delete from backend
      const response = await axios.delete(
        `${import.meta.env.VITE_PROD_URL}/project/${projectId}`,
        {
          withCredentials: true,
          headers: { "x-auth-token": localStorage.getItem("token") },
        }
      );

      if (response.data.status !== "success") {
        throw new Error(response.data.message || "Failed to delete project");
      }

      // Remove from local state
      setProjects((prev) => prev.filter((p) => p.id !== projectId));

      // Clean up any cached loading promises
      if (loadingRef.current && loadingRef.current[projectId]) {
        delete loadingRef.current[projectId];
      }

      return true;
    } catch (err) {
      console.error("Error deleting project:", err);
      setError(err.message || "Failed to delete project");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load - ONLY if token exists
  useEffect(() => {
    // Check if user is logged in before fetching projects
    const token = localStorage.getItem("token");

    if (token) {
      fetchProjects().catch((err) =>
        console.error("Error in initial project fetch:", err)
      );
    } else {
      console.log("No token found, skipping initial project fetch");
    }
  }, []); // Empty dependency array means this runs once on mount

  const value = {
    projects,
    isLoading,
    error,
    fetchProjects,
    getProjectById, // Memoized function
    createProject,
    rebuildProject,
    deleteProject,
    updateProjectStatus,
  };

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
};
