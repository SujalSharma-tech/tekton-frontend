import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";

function DeploymentModal({
  projectId,
  projectName,
  deploymentId,
  onClose,
  onComplete,
  isRedeployment = false, // Add this new prop to indicate if it's a redeployment
  initialDeployment = false, // Add this prop with default value
}) {
  const [logs, setLogs] = useState([]);
  const [deploymentStatus, setDeploymentStatus] = useState("running");
  const [error, setError] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lastLogCount, setLastLogCount] = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [currentDeploymentId, setCurrentDeploymentId] = useState(deploymentId);
  const [deploymentFinished, setDeploymentFinished] = useState(false);
  const logEndRef = useRef(null);
  const pollingInterval = useRef(null);
  const logContainerRef = useRef(null);
  const projectRefreshed = useRef(false);

  // Scroll to bottom of logs automatically if autoScroll is enabled
  const scrollToBottom = () => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Detect manual scroll to toggle autoScroll
  const handleScroll = (e) => {
    const element = e.target;
    const isScrolledToBottom =
      Math.abs(
        element.scrollHeight - element.scrollTop - element.clientHeight
      ) < 50;
    setAutoScroll(isScrolledToBottom);
  };

  // Scroll when logs update and autoScroll is enabled
  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Add this useEffect to update currentDeploymentId when props change
  useEffect(() => {
    if (deploymentId && deploymentId !== currentDeploymentId) {
      setCurrentDeploymentId(deploymentId);
    }
  }, [deploymentId, currentDeploymentId]);

  // Simplified useEffect for deployment start
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const startDeployment = async () => {
      try {
        setIsInitialLoading(true);

        // ONLY start a new deployment if ALL these conditions are met:
        // 1. No deploymentId was provided
        // 2. Not a redeployment
        // 3. Not an initial deployment
        // 4. We explicitly want to deploy
        const shouldStartNewDeployment =
          !deploymentId && !isRedeployment && !initialDeployment && projectId;

        if (shouldStartNewDeployment) {
          const deployResponse = await axios.post(
            `${import.meta.env.VITE_PROD_URL}/deploy`,
            { projectId },
            {
              withCredentials: true,
              headers: { "x-auth-token": localStorage.getItem("token") },
            }
          );

          if (deployResponse.data.status !== "success") {
            throw new Error(
              deployResponse.data.message || "Failed to start deployment"
            );
          }
        } else {
          console.log(
            `Using existing deployment, NOT triggering new deploy. deploymentId: ${deploymentId}, isRedeployment: ${isRedeployment}, initialDeployment: ${initialDeployment}`
          );
        }

        // Always fetch status and logs, regardless of whether we started a new deployment
        await fetchDeploymentStatus();
        setIsInitialLoading(false);

        // Continue with polling...
      } catch (err) {
        // Error handling...
      }
    };

    startDeployment();

    return () => {
      isMounted = false;
      controller.abort();
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [projectId, deploymentId, isRedeployment, initialDeployment]); // Don't include other dependencies

  // Adjust polling frequency based on activity
  useEffect(() => {
    // After initial polls, if log count isn't changing, slow down polling
    if (pollCount > 5 && logs.length === lastLogCount) {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = setInterval(fetchDeploymentStatus, 8000);
      }
    }

    // Update last log count
    setLastLogCount(logs.length);
  }, [pollCount, logs.length]);

  // Update fetchDeploymentStatus to prevent errors
  const fetchDeploymentStatus = async () => {
    // Prevent execution if we've already cleared the interval
    if (!pollingInterval.current) return;

    try {
      const statusResponse = await axios.get(
        `${import.meta.env.VITE_PROD_URL}/project/${projectId}/status`,
        {
          withCredentials: true,
          headers: {
            "x-auth-token": `${localStorage.getItem("token")}`,
          },
        }
      );

      if (statusResponse.data.status !== "success") {
        throw new Error(
          statusResponse.data.message || "Failed to get deployment status"
        );
      }

      const newStatus = statusResponse.data.data.currentStatus.toLowerCase();
      if (deploymentStatus !== newStatus) {
        console.log(`Status changed from ${deploymentStatus} to ${newStatus}`);
        setDeploymentStatus(newStatus);
      }

      // Determine which deployment ID to use for logs
      let logsDeploymentId = currentDeploymentId;
      if (!logsDeploymentId && statusResponse.data.data.latestDeployment?.id) {
        logsDeploymentId = statusResponse.data.data.latestDeployment.id;
        console.log(`Setting current deployment ID to ${logsDeploymentId}`);
        setCurrentDeploymentId(logsDeploymentId);
      }

      // Skip log fetch if we don't have a deployment ID
      if (!logsDeploymentId) {
        console.warn("No deployment ID available for logs fetch");
        return;
      }

      console.log(`Fetching logs for deployment ${logsDeploymentId}`);

      const logsResponse = await axios.get(
        `${import.meta.env.VITE_PROD_URL}/logs/${logsDeploymentId}`,
        {
          withCredentials: true,
          headers: {
            "x-auth-token": `${localStorage.getItem("token")}`,
          },
        }
      );

      if (logsResponse.data.status !== "success") {
        throw new Error(
          logsResponse.data.message || "Failed to fetch deployment logs"
        );
      }

      // Check the correct path for logs in your API response
      const newLogs = logsResponse.data.data?.logs || [];
      console.log(`Fetched ${newLogs.length} logs`);

      // Check if we have a "done" log message
      const hasDoneLog = newLogs.some(
        (log) =>
          log.message?.toLowerCase().includes("done") ||
          log.log?.toLowerCase().includes("done")
      );

      // If we found a "done" log and haven't refreshed the project yet
      if (hasDoneLog && !projectRefreshed.current) {
        console.log("Found 'done' log, refreshing project data");
        projectRefreshed.current = true;
        setDeploymentFinished(true);

        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }

        // Call onComplete ONLY ONCE when we find the done log
        console.log(`Calling onComplete with status: ${newStatus}`);
        onComplete && onComplete(newStatus);

        // Don't set any other completion callbacks below
      } else {
        // Update logs
        setLogs(newLogs);
      }
    } catch (err) {
      console.error("Error in fetchDeploymentStatus:", err);
      setError(err.message || "Failed to get deployment status");

      // Clear interval on error
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    }
  };

  // Function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "text-green-600";
      case "running":
      case "queued":
        return "text-yellow-600";
      case "failure":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  // Function to get log level color
  const getLogLevelColor = (level) => {
    switch (level?.toLowerCase()) {
      case "error":
        return "text-red-600";
      case "warn":
      case "warning":
        return "text-yellow-600";
      case "info":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  // Memoize logs to prevent unnecessary re-renders
  const memoizedLogs = useMemo(() => {
    return logs.map((log, idx) => (
      <div key={`log-${idx}`} className="py-1 whitespace-pre-wrap">
        <span className="text-gray-500">
          [{new Date(log.timestamp).toLocaleTimeString()}]
        </span>{" "}
        <span className={getLogLevelColor(log.level)}>
          {log.level || "INFO"}:
        </span>{" "}
        <span>{log.message || log.log}</span>
      </div>
    ));
  }, [logs]);

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Deployment: {projectName}
          </h2>
          <div className="flex items-center">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 transition-colors duration-300 ease-in-out ${
                deploymentStatus === "success"
                  ? "bg-green-100 text-green-800"
                  : deploymentStatus === "failure"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {deploymentStatus === "success"
                ? "✓ Success"
                : deploymentStatus === "failure"
                ? "✗ Failed"
                : "⟳ Running"}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-6 text-red-600">
            <p className="font-medium">Error occurred:</p>
            <p>{error}</p>
          </div>
        ) : (
          <div
            ref={logContainerRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-gray-50"
            style={{ height: "400px" }}
            onScroll={handleScroll}
          >
            {/* Only show loading spinner during initial loading */}
            {isInitialLoading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <svg
                  className="animate-spin h-8 w-8 text-blue-500 mb-4"
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
                <p className="text-gray-600">Initializing deployment...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-gray-600">No logs available yet...</p>
              </div>
            ) : (
              <div className="min-h-full">
                {memoizedLogs}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        )}

        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <div
            className={`${getStatusColor(
              deploymentStatus
            )} transition-colors duration-300 ease-in-out`}
          >
            {deploymentStatus === "success"
              ? "Deployment completed successfully!"
              : deploymentStatus === "failure"
              ? "Deployment failed. Please check the logs."
              : "Deploying your project..."}
          </div>
          {(deploymentStatus === "success" ||
            deploymentStatus === "failure") && (
            <button
              onClick={() => {
                // Force a refresh of the project before closing
                axios
                  .get(
                    `${import.meta.env.VITE_PROD_URL}/project/${projectId}`,
                    {
                      withCredentials: true,
                      headers: {
                        "x-auth-token": `${localStorage.getItem("token")}`,
                      },
                    }
                  )
                  .then((response) => {
                    // We don't need to do anything with the response,
                    // just ensure the request completes before closing
                    console.log("Project refreshed before modal close");
                    onClose();
                  })
                  .catch((err) => {
                    console.error(
                      "Error refreshing project before close:",
                      err
                    );
                    onClose();
                  });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-150"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeploymentModal;
