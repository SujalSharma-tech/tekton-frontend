import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";

function DeployForm({ onCancel, existingProject = null }) {
  const navigate = useNavigate();
  const { createProject, updateProject } = useProjects();

  const [formData, setFormData] = useState({
    name: existingProject?.name || "",
    gitUrl: existingProject?.gitUrl || "",
    buildCommand: existingProject?.buildCommand || "npm run build",
    environment: existingProject?.environment || "node:18",
    domain: existingProject?.domain || "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      setError("");

      if (existingProject) {
        // Update existing project
        await updateProject(existingProject.id, formData);
        onCancel();
      } else {
        const result = await createProject(formData);

        navigate(
          `/project/${result.projectId}?deploymentId=${result.deploymentId}`
        );
      }
    } catch (err) {
      console.error("Error in form submission:", err);
      setError(err.message || "Failed to process request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-6">
        {existingProject ? "Update Project" : "Deploy New Project"}
      </h2>

      {error && (
        <div className="mb-4 bg-red-50 text-red-700 p-3 rounded border border-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Project Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              placeholder="My Awesome Project"
            />
          </div>

          <div>
            <label
              htmlFor="gitUrl"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              GitHub Repository URL
            </label>
            <input
              type="url"
              id="gitUrl"
              name="gitUrl"
              value={formData.gitUrl}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              placeholder="https://github.com/username/repo"
            />
          </div>

          <div>
            <label
              htmlFor="buildCommand"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Build Command
            </label>
            <input
              type="text"
              id="buildCommand"
              name="buildCommand"
              value={formData.buildCommand}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="npm run build"
            />
          </div>

          <div>
            <label
              htmlFor="environment"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Environment
            </label>
            <select
              id="environment"
              name="environment"
              value={formData.environment}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="node:16">Node.js 16</option>
              <option value="node:18">Node.js 18</option>
              <option value="node:20">Node.js 20</option>
              <option value="python:3.10">Python 3.10</option>
              <option value="python:3.11">Python 3.11</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="domain"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Custom Domain (Optional)
            </label>
            <input
              type="text"
              id="domain"
              name="domain"
              value={formData.domain}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="mysite.com"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 py-2 rounded-md text-white ${
                isLoading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isLoading
                ? "Processing..."
                : existingProject
                ? "Update Project"
                : "Deploy Project"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default DeployForm;
