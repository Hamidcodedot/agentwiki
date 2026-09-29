import * as YAML from 'yaml';
import { AgentWikiPage } from '../core/types.js';

interface OpenApiParameter {
  name: string;
  in: 'header' | 'query' | 'path' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: {
    type?: string;
    enum?: string[];
    [key: string]: unknown;
  };
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    required?: boolean;
    content?: {
      [mime: string]: {
        schema?: Record<string, unknown>;
      };
    };
  };
  responses?: {
    [code: string]: {
      description?: string;
      content?: {
        [mime: string]: {
          schema?: Record<string, unknown>;
        };
      };
    };
  };
}

interface OpenApiDoc {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  paths?: {
    [path: string]: {
      [method: string]: OpenApiOperation;
    };
  };
}

/**
 * Parses OpenAPI 3.0 / Swagger JSON or YAML into high-density AgentWikiPages.
 */
export function parseOpenApi(source: string | Record<string, unknown>): AgentWikiPage[] {
  let doc: OpenApiDoc;

  if (typeof source === 'string') {
    try {
      doc = JSON.parse(source) as OpenApiDoc;
    } catch {
      doc = YAML.parse(source) as OpenApiDoc;
    }
  } else {
    doc = source as OpenApiDoc;
  }

  if (!doc || !doc.paths) {
    return [];
  }

  const pages: AgentWikiPage[] = [];
  const apiTitle = doc.info?.title ?? 'API';
  const apiVersion = doc.info?.version;
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

  const allEndpointIds: string[] = [];

  // First pass: identify all endpoint IDs for relation linking
  for (const [pathKey, pathItem] of Object.entries(doc.paths)) {
    for (const method of methods) {
      if (pathItem && (pathItem as Record<string, unknown>)[method]) {
        const cleanPath = pathKey
          .replace(/\{(\w+)\}/g, '$1')
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .toLowerCase();
        allEndpointIds.push(`${method.toLowerCase()}_${cleanPath}`);
      }
    }
  }

  // Second pass: generate atomic pages
  for (const [pathKey, pathItem] of Object.entries(doc.paths)) {
    for (const method of methods) {
      const operation = (pathItem as Record<string, unknown>)[method] as OpenApiOperation | undefined;
      if (!operation) continue;

      const cleanPath = pathKey
        .replace(/\{(\w+)\}/g, '$1')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase();
      const entityId = `${method.toLowerCase()}_${cleanPath}`;

      const name = operation.summary || `${method.toUpperCase()} ${pathKey}`;
      const rawSummary = operation.description || operation.summary || `${method.toUpperCase()} ${pathKey}`;
      const summary = rawSummary.replace(/\s+/g, ' ').slice(0, 160).trim();

      const tags = Array.from(
        new Set([...(operation.tags ?? []), ...(apiTitle ? [apiTitle] : [])])
      );

      // Extract relations
      const requires: string[] = [];
      const related = allEndpointIds.filter(
        (otherId) => otherId !== entityId && (otherId.includes(cleanPath.split('_')[0]) || tags.some(t => otherId.includes(t.toLowerCase())))
      ).slice(0, 5);

      // Build High-Density Markdown Content
      const sections: string[] = [];

      // 1. Endpoint signature
      sections.push(`## Endpoint\n\`${method.toUpperCase()} ${pathKey}\``);

      // 2. Pre-conditions & Parameters
      const params = operation.parameters ?? [];
      if (params.length > 0) {
        const paramLines = params.map((p) => {
          const req = p.required ? '**required**' : 'optional';
          const type = p.schema?.type ?? 'string';
          const desc = p.description ? ` - ${p.description}` : '';
          return `- \`${p.name}\` (${p.in}, ${type}, ${req})${desc}`;
        });
        sections.push(`## Pre-conditions & Parameters\n${paramLines.join('\n')}`);
      }

      // 3. Request Body Schema
      const requestSchema = operation.requestBody?.content?.['application/json']?.schema;
      if (requestSchema) {
        const schemaFormatted = formatJsonSchemaCompact(requestSchema);
        sections.push(`## Request Schema\n\`\`\`json\n${schemaFormatted}\n\`\`\``);
      }

      // 4. Responses & Error Guards
      const responses = operation.responses ?? {};
      const responseCodes = Object.keys(responses);
      if (responseCodes.length > 0) {
        const respLines: string[] = [];
        for (const code of responseCodes) {
          const resp = responses[code];
          respLines.push(`- \`${code}\`: ${resp.description ?? 'No description'}`);
          const respSchema = resp.content?.['application/json']?.schema;
          if (respSchema) {
            respLines.push(`  Schema: \`${JSON.stringify(respSchema.properties ? Object.keys(respSchema.properties) : respSchema)}\``);
          }
        }
        sections.push(`## Responses & Error Guards\n${respLines.join('\n')}`);
      }

      pages.push({
        metadata: {
          id: entityId,
          name,
          category: 'api',
          version: apiVersion,
          tags,
          relations: {
            requires,
            supersedes: [],
            related,
          },
          summary,
          updated_at: new Date().toISOString(),
        },
        content: sections.join('\n\n'),
      });
    }
  }

  return pages;
}

/**
 * Compactly formats JSON Schema into a concise representation.
 */
function formatJsonSchemaCompact(schema: Record<string, unknown>): string {
  const simplified: Record<string, unknown> = {};

  if (schema.required && Array.isArray(schema.required)) {
    simplified['_required'] = schema.required;
  }

  if (schema.properties && typeof schema.properties === 'object') {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    const formattedProps: Record<string, string> = {};

    for (const [key, val] of Object.entries(props)) {
      const type = val.type ?? 'any';
      const enums = val.enum ? ` [${(val.enum as string[]).join('|')}]` : '';
      formattedProps[key] = `${type}${enums}`;
    }
    simplified['properties'] = formattedProps;
  }

  return JSON.stringify(simplified, null, 2);
}
