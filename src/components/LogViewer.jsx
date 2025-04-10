import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useProjects } from "../context/ProjectContext";

function LogViewer({ deploymentId, projectId }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pollingActive, setPollingActive] = useState(true);

  const { updateProjectStatus } = useProjects();

  const logEndRef = useRef(null);
  const pollingRef = useRef(null);
  const doneDetectedRef = useRef(false);

  // Add more logging in the useEffect
  useEffect(() => {
    if (!deploymentId) {
      console.warn("⚠️ No deploymentId provided to LogViewer!");
      setIsLoading(false);
      return;
    }

    const fetchLogs = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_PROD_URL}/logs/${deploymentId}`,
          {
            withCredentials: true,
            headers: {
              "x-auth-token": localStorage.getItem("token"),
            },
          }
        );

        if (response.data.status === "success") {
          const newLogs = response.data.data.logs || [];

          setLogs(newLogs);

          // Check for "done" log
          const isDone = newLogs.some((log) => {
            const message = (log.message || log.log || "").toLowerCase();
            return (
              message.includes("done") ||
              message.includes("completed successfully")
            );
          });

          if (isDone && !doneDetectedRef.current && projectId) {
            doneDetectedRef.current = true;
            setPollingActive(false);
            updateProjectStatus(projectId, "success");

            // Stop polling when done
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        } else {
          throw new Error(response.data.message || "Failed to fetch logs");
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching logs:", err);
        setError(`Failed to fetch logs: ${err.message}`);
        setIsLoading(false);
      }
    };

    // Fetch logs immediately
    fetchLogs();

    // Poll for new logs every 2 seconds
    pollingRef.current = setInterval(fetchLogs, 5000);

    // Clean up on unmount
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [deploymentId, projectId, updateProjectStatus]);

  // Scroll to bottom when logs update
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-2">Loading logs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
        <p className="font-medium mb-2">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center p-8 border border-gray-200 rounded-md">
        <p className="text-gray-500">
          No logs available yet. The deployment is being prepared...
        </p>
        <div className="mt-4 flex justify-center">
          <div className="animate-pulse flex space-x-4">
            <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
            <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
            <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <div className="bg-gray-50 p-4 h-96 overflow-y-auto font-mono text-sm">
        {logs.map((log, index) => (
          <div
            key={index}
            className={`mb-1 ${
              (log.message || log.log || "").toLowerCase().includes("error")
                ? "text-red-600"
                : ""
            }`}
          >
            <span className="text-gray-500 mr-2">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            {log.message || log.log}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
      {!pollingActive && (
        <div className="bg-green-50 text-green-700 text-xs p-2 text-center">
          Deployment complete. Logs are no longer updating.
        </div>
      )}
    </div>
  );
}

export default LogViewer;
