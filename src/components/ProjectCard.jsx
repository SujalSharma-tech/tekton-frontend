import React from "react";

function ProjectCard({ project }) {
  // Helper function to determine status color
  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case "deployed":
        return "bg-green-500";
      case "building":
        return "bg-yellow-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-transform hover:-translate-y-1 cursor-pointer">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        {project.name}
      </h3>
      <div className="flex items-center mb-4">
        <span
          className={`h-2 w-2 rounded-full mr-2 ${getStatusColor(
            project.status
          )}`}
        ></span>
        <span className="text-gray-700">{project.status}</span>
      </div>
      <div className="text-sm text-gray-600">
        <p className="mb-2">
          Deployed: {new Date(project.deployedAt).toLocaleDateString()}
        </p>
        {project.domain && (
          <div className="flex items-center">
            <span className="mr-2">Domain:</span>
            <a
              href={`https://${project.domain}.sujal.codes`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {project.domain}.sujal.codes
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectCard;
