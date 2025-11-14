import {
  makeListProjectFilesController,
  makeListProjectsController,
  makeReadController,
  makeUpdateController,
  makeWriteController,
} from "../../factories/controllers/index.js";
import { makeGetFileVersionController, makeListFileVersionsController, makeRevertFileVersionController } from "../../factories/controllers/get-file-version/index.js";
import { makeAppendFileController } from "../../factories/controllers/append-file/append-file-controller-factory.js";
import { makeLogFileController } from "../../factories/controllers/log-file/log-file-controller-factory.js";
import { adaptMcpRequestHandler } from "./adapters/mcp-request-adapter.js";
import { McpRouterAdapter } from "./adapters/mcp-router-adapter.js";

export default () => {
  const router = new McpRouterAdapter();

  router.setTool({
    schema: {
      name: "list_projects",
      description: "List all projects in the memory bank",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    handler: adaptMcpRequestHandler(makeListProjectsController()),
  });

  router.setTool({
    schema: {
      name: "list_project_files",
      description: "List all files within a specific project",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
        },
        required: ["projectName"],
      },
    },
    handler: adaptMcpRequestHandler(makeListProjectFilesController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_read",
      description: "Read a memory bank file for a specific project",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          fileName: {
            type: "string",
            description: "The name of the file",
          },
        },
        required: ["projectName", "fileName"],
      },
    },
    handler: adaptMcpRequestHandler(makeReadController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_write",
      description: "Create a new memory bank file for a specific project",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          fileName: {
            type: "string",
            description: "The name of the file",
          },
          content: {
            type: "string",
            description: "The content of the file",
          },
        },
        required: ["projectName", "fileName", "content"],
      },
    },
    handler: adaptMcpRequestHandler(makeWriteController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_update",
      description: "Update an existing memory bank file for a specific project",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          fileName: {
            type: "string",
            description: "The name of the file",
          },
          content: {
            type: "string",
            description: "The content of the file",
          },
        },
        required: ["projectName", "fileName", "content"],
      },
    },
    handler: adaptMcpRequestHandler(makeUpdateController()),
  });

  router.setTool({
    schema: {
      name: "get_file_version",
      description: "Get a specific version of a memory bank file",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          fileName: {
            type: "string",
            description: "The name of the file",
          },
          versionId: {
            type: "string",
            description: "The version identifier (timestamp)",
          },
        },
        required: ["projectName", "fileName", "versionId"],
      },
    },
    handler: adaptMcpRequestHandler(makeGetFileVersionController()),
  });

  router.setTool({
    schema: {
      name: "list_file_versions",
      description: "List all versions of a memory bank file",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          fileName: {
            type: "string",
            description: "The name of the file",
          },
        },
        required: ["projectName", "fileName"],
      },
    },
    handler: adaptMcpRequestHandler(makeListFileVersionsController()),
  });

  router.setTool({
    schema: {
      name: "revert_file_version",
      description: "Revert a file to a specific version",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          fileName: {
            type: "string",
            description: "The name of the file",
          },
          versionId: {
            type: "string",
            description: "The version identifier (timestamp) to revert to",
          },
        },
        required: ["projectName", "fileName", "versionId"],
      },
    },
    handler: adaptMcpRequestHandler(makeRevertFileVersionController()),
  });

 router.setTool({
    schema: {
      name: "memory_bank_append",
      description: "Append content to an existing memory bank file for a specific project",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          fileName: {
            type: "string",
            description: "The name of the file",
          },
          content: {
            type: "string",
            description: "The content to append to the file",
          },
        },
        required: ["projectName", "fileName", "content"],
      },
    },
    handler: adaptMcpRequestHandler(makeAppendFileController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_log",
      description: "Log content to a memory bank file with timestamp for a specific project",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          fileName: {
            type: "string",
            description: "The name of the file",
          },
          content: {
            type: "string",
            description: "The content to log to the file",
          },
        },
        required: ["projectName", "fileName", "content"],
      },
    },
    handler: adaptMcpRequestHandler(makeLogFileController()),
  });

  return router;
};
