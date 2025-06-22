import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Project } from '../../projects/project.entity';
import { RegisterEndpointDto } from '../dto/register-endpoint.dto';
import { firstValueFrom } from 'rxjs';
import toJsonSchema from 'to-json-schema';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(private readonly httpService: HttpService) {}

  async analyze(project: Project, dto: RegisterEndpointDto) {
    const url = this.buildUrl(project.baseUrl, dto);
    this.logger.log(`Making exploratory call to: ${url}`);

    try {
      let response;
      
      // Configure request based on HTTP method
      const config: any = {
        timeout: 10000, // 10 seconds timeout
      };

      // For methods that require body, use example data if available
      if (['POST', 'PUT', 'PATCH'].includes(dto.method)) {
        if (dto.requestBodyDefinition) {
          config.data = this.buildRequestBody(dto.requestBodyDefinition);
        }
      }

      // Make request based on method
      switch (dto.method) {
        case 'GET':
          response = await firstValueFrom(this.httpService.get(url, config));
          break;
        case 'POST':
          response = await firstValueFrom(this.httpService.post(url, config.data, config));
          break;
        case 'PUT':
          response = await firstValueFrom(this.httpService.put(url, config.data, config));
          break;
        case 'PATCH':
          response = await firstValueFrom(this.httpService.patch(url, config.data, config));
          break;
        case 'DELETE':
          response = await firstValueFrom(this.httpService.delete(url, config));
          break;
        default:
          throw new BadRequestException(`Unsupported HTTP method: ${dto.method}`);
      }

      this.logger.log(`Response received: ${response.status}`);
      
      const inferredSchema = toJsonSchema(response.data);
      this.logger.log('JSON Schema inferred successfully.');

      const dataPath = this.findDataPath(response.data);
      this.logger.log(`Data path inferred: ${dataPath || '(none)'}`);

      const analysisResult = {
        inferredStatusCode: response.status,
        inferredResponseSchema: inferredSchema,
        inferredDataPath: dataPath,
        responseBody: response.data,
      };

      return analysisResult;

    } catch (error) {
      this.logger.error(`Error in exploratory call to ${url}:`, error.response?.status, error.response?.data);
      
      // Handle specific errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new BadRequestException(`Cannot access API at ${url}. Verify that the URL is correct and the API is available.`);
      }
      
      if (error.response?.status >= 400) {
        // For HTTP errors, we can still infer useful information
        this.logger.warn(`API returned error ${error.response.status}, but continuing with analysis...`);
        
        const errorSchema = toJsonSchema(error.response.data || {});
        return {
          inferredStatusCode: error.response.status,
          inferredResponseSchema: errorSchema,
          inferredDataPath: '',
          responseBody: error.response.data,
          isErrorResponse: true,
        };
      }
      
      throw new BadRequestException(`Error analyzing API: ${error.message}`);
    }
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
        const childObject = this.getObjectByPath(this.getObjectByPath(data, childPath), '');
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

  private buildUrl(baseUrl: string, dto: RegisterEndpointDto): string {
    let finalPath = dto.path;
    if (dto.pathParameters) {
      for (const param of dto.pathParameters) {
        finalPath = finalPath.replace(`{${param.name}}`, String(param.value));
      }
    }
    return `${baseUrl}${finalPath}`;
  }
} 