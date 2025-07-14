import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Project } from '../../projects/project.entity';
import { RegisterEndpointDto } from '../dto/register-endpoint.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(private readonly httpService: HttpService) {}

  async analyzeEndpoint(project: Project, dto: RegisterEndpointDto) {
    this.logger.log(
      `[ANALYZE] Iniciating analysis for endpoint: ${dto.entityName}`,
    );

    const analysisResults: Record<string, any> = {};
    let createdResourceId: string | undefined = undefined;

    // Analyze each endpoint method
    for (const methodConfig of dto.methods) {
      const method = methodConfig.method;
      this.logger.log(`[ANALYZE] Analyzing method: ${method}`);

      try {
        // For PATCH/DELETE that need an ID, try to get one from a previous POST
        if (this.methodNeedsId(method) && !createdResourceId) {
          this.logger.log(
            `[ANALYZE] Method ${method} needs ID, attempting to create resource first...`,
          );

          // Try to find a POST method to create a resource
          const postMethod = dto.methods.find((m) => m.method === 'POST');
          if (postMethod) {
            const postResult = await this.analyzeMethod(
              project,
              dto,
              postMethod,
              undefined,
            );

            if (
              postResult.success &&
              'entityData' in postResult &&
              postResult.entityData?.data?.id
            ) {
              createdResourceId = postResult.entityData.data.id;
              this.logger.log(
                `[ANALYZE] Successfully created resource with ID: ${createdResourceId}`,
              );
              // Store the POST result to avoid re-analyzing it
              analysisResults['POST'] = postResult;
            } else {
              this.logger.warn(
                `[ANALYZE] Failed to extract ID from POST response`,
              );
            }
          } else {
            this.logger.warn(
              `[ANALYZE] No POST method found to create resource for ID`,
            );
          }
        }

        // Skip if we already analyzed this method (e.g., POST was analyzed for ID creation)
        if (analysisResults[method]) {
          this.logger.log(
            `[ANALYZE] Method ${method} already analyzed, skipping`,
          );
          continue;
        }

        const result = await this.analyzeMethod(
          project,
          dto,
          methodConfig,
          createdResourceId,
        );
        analysisResults[method] = result;
        this.logger.log(`[ANALYZE] Method ${method} analyzed successfully`);
      } catch (error) {
        this.logger.error(
          `[ANALYZE] Error analyzing method ${method}:`,
          error.message,
        );
        analysisResults[method] = {
          error: error.message,
          status: 'failed',
          requestBodyDefinition: methodConfig.requestBodyDefinition,
        };
      }
    }

    return {
      entityName: dto.entityName,
      section: dto.section,
      path: dto.path,
      methods: dto.methods,
      analysisResults,
      summary: this.generateAnalysisSummary(analysisResults),
    };
  }

  private async analyzeMethod(
    project: Project,
    dto: RegisterEndpointDto,
    methodConfig: any,
    createdResourceId?: string,
  ) {
    const url = this.buildUrl(
      project.baseUrl,
      dto,
      methodConfig.method,
      createdResourceId,
      project.basePath,
    );

    try {
      let response;
      
      // Configure request based on HTTP method
      const config: any = {
        timeout: 10000, // 10 seconds timeout
      };

      // For methods that require body, use example data if available
      if (['POST', 'PUT', 'PATCH'].includes(methodConfig.method)) {
        if (methodConfig.requestBodyDefinition) {
          config.data = this.buildRequestBody(
            methodConfig.requestBodyDefinition,
          );
        } else {
          this.logger.warn(
            `[ANALYZE] No request body definition for ${methodConfig.method}`,
          );
        }
      }

      // Make request based on method
      switch (methodConfig.method) {
        case 'GET':
          response = await firstValueFrom(this.httpService.get(url, config));
          break;
        case 'POST':
          response = await firstValueFrom(
            this.httpService.post(url, config.data, config),
          );
          break;
        case 'PUT':
          response = await firstValueFrom(
            this.httpService.put(url, config.data, config),
          );
          break;
        case 'PATCH':
          response = await firstValueFrom(
            this.httpService.patch(url, config.data, config),
          );
          break;
        case 'DELETE':
          response = await firstValueFrom(this.httpService.delete(url, config));
          break;
        default:
          this.logger.error(
            `[ANALYZE] Unsupported HTTP method: ${methodConfig.method}`,
          );
          throw new BadRequestException(
            `Unsupported HTTP method: ${methodConfig.method}`,
          );
      }
      
      // Extract only the specific entity from the response
      const entityData = this.extractEntityData(response.data, dto.entityName);
      const inferredSchema = this.inferSchemaFromData(entityData);
      const dataPath = this.findDataPath(response.data);

      const analysisResult = {
        inferredStatusCode: response.status,
        inferredResponseSchema: inferredSchema,
        inferredDataPath: dataPath,
        responseBody: response.data,
        entityData: entityData,
        method: methodConfig.method,
        requestBodyDefinition: methodConfig.requestBodyDefinition,
        success: true,
      };

      return analysisResult;
    } catch (error) {
      this.logger.error(
        `[ANALYZE] Error in exploratory call to ${url}:`,
        error.message,
      );
      
      // Handle specific errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new BadRequestException(
          `Cannot access API at ${url}. Verify that the URL is correct and the API is available.`,
        );
      }
      
      if (error.response?.status >= 400) {
        this.logger.warn(
          `[ANALYZE] API returned error ${error.response.status}, attempting to infer error schema...`,
        );
        const errorSchema = this.inferSchemaFromData(error.response.data || {});
        return {
          inferredStatusCode: error.response.status,
          inferredResponseSchema: errorSchema,
          inferredDataPath: '',
          responseBody: error.response.data,
          isErrorResponse: true,
          method: methodConfig.method,
          requestBodyDefinition: methodConfig.requestBodyDefinition,
          success: false,
          error: error.message,
        };
      }
      
      throw new BadRequestException(`Error analyzing API: ${error.message}`);
    }
  }

  private generateAnalysisSummary(analysisResults: Record<string, any>): any {
    const summary = {
      totalMethods: Object.keys(analysisResults).length,
      successfulMethods: 0,
      failedMethods: 0,
      statusCodes: {} as Record<string, number>,
      hasErrors: false,
    };

    for (const [method, result] of Object.entries(analysisResults)) {
      if (result.success) {
        summary.successfulMethods++;
        summary.statusCodes[method] = result.inferredStatusCode;
      } else {
        summary.failedMethods++;
        summary.hasErrors = true;
      }
    }

    return summary;
  }

  private buildRequestBody(requestBodyDefinition: any[]): any {
    const body: any = {};
    
    for (const field of requestBodyDefinition) {
      if (field.example !== undefined) {
        body[field.name] = field.example;
      } else {
        // Generate default value based on type
        switch (field.type) {
          case 'string':
            body[field.name] = 'test_value';
            break;
          case 'number':
            body[field.name] = 123;
            break;
          case 'boolean':
            body[field.name] = true;
            break;
          case 'array':
            body[field.name] = [];
            break;
          case 'object':
            body[field.name] = {};
            break;
          default:
            body[field.name] = null;
        }
      }
    }
    
    return body;
  }

  private findDataPath(data: any, currentPath = ''): string {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return '';
    }

    let bestPath = '';
    let maxKeys = 0;

    // If current object has more keys than the best found so far, it becomes the candidate
    const currentKeys = Object.keys(data).length;
    if (currentKeys > maxKeys) {
      maxKeys = currentKeys;
      bestPath = currentPath;
    }
    
    // Recursive search in children
    for (const key in data) {
      if (typeof data[key] === 'object' && data[key] !== null) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        const childPath = this.findDataPath(data[key], newPath);
        
        // Compare the object found in recursion with the best so far
        const childObject = this.getObjectByPath(
          this.getObjectByPath(data, childPath),
          '',
        );
        if (childObject && Object.keys(childObject).length > maxKeys) {
            maxKeys = Object.keys(childObject).length;
            bestPath = childPath;
        }
      }
    }

    return bestPath;
  }

  private getObjectByPath(obj: any, path: string): any {
    if (!path) return obj;
    return path.split('.').reduce((o, i) => (o ? o[i] : null), obj);
  }

  private buildUrl(
    baseUrl: string,
    dto: RegisterEndpointDto,
    method: string,
    createdResourceId?: string,
    basePath?: string,
  ): string {
    // Check if dto.path already includes the basePath to avoid duplication
    const apiBasePath = basePath || '';
    let endpointPath = dto.path;
    
    // If the path already starts with the basePath, remove it to avoid duplication
    if (apiBasePath && endpointPath.startsWith(apiBasePath)) {
      endpointPath = endpointPath.substring(apiBasePath.length);
    }
    
    let url = `${baseUrl}${apiBasePath}${endpointPath}`;

    // Check if method needs ID parameter
    const needsId = this.methodNeedsId(method);

    // Handle path parameters
    if (dto.pathParameters && dto.pathParameters.length > 0) {
      for (const param of dto.pathParameters) {
        const placeholder = `{${param.name}}`;
        if (url.includes(placeholder)) {
          url = url.replace(placeholder, param.value.toString());
        }
      }
    }

    // Handle ID replacement for PATCH/DELETE methods
    if (needsId && createdResourceId) {
      // Find the last occurrence of the entity path and append the ID
      const entityPath = endpointPath.split('/').pop(); // Get the last part of the path
      if (entityPath && !entityPath.includes('{')) {
        const pathBeforeEntity = endpointPath.substring(
          0,
          endpointPath.lastIndexOf('/'),
        );
        const newPath = `${pathBeforeEntity}/${entityPath}/${createdResourceId}`;
        url = `${baseUrl}${apiBasePath}${newPath}`;
      }
    }

    return url;
  }

  private methodNeedsId(method: string): boolean {
    // Methods that typically require an ID in the URL
    return ['PUT', 'PATCH', 'DELETE'].includes(method);
  }

  private extractEntityData(responseData: any, entityName: string): any {
    // Search for the specific entity in the response
    const entityNameLower = entityName.toLowerCase();
    const entityNamePlural = entityNameLower + 's';

    // Search in different common paths
    const possiblePaths = [
      entityNameLower,
      entityNamePlural,
      'data',
      'result',
      'item',
      'entity',
    ];

    for (const path of possiblePaths) {
      if (responseData && responseData[path]) {
        return responseData[path];
      }
    }

    // If not found in specific paths, search in arrays
    if (Array.isArray(responseData)) {
      if (responseData.length > 0) {
        return responseData[0];
      }
    }

    // If nothing specific found, use entire response
    return responseData;
  }

  private inferSchemaFromData(data: any): any {
    if (data === null) {
      return { type: 'null' };
      }

    if (typeof data === 'string') {
      return { type: 'string' };
    }

    if (typeof data === 'number') {
      return { type: 'number' };
    }

    if (typeof data === 'boolean') {
      return { type: 'boolean' };
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return { type: 'array', items: {} };
      }
      return {
        type: 'array',
        items: this.inferSchemaFromData(data[0]),
      };
    }

    if (typeof data === 'object') {
      const properties: any = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(data)) {
        properties[key] = this.inferSchemaFromData(value);
        if (value !== null && value !== undefined) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
  }

    return { type: 'string' };
  }
}
