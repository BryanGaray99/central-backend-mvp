import { Injectable, Logger } from '@nestjs/common';
import { Project } from '../../projects/project.entity';
import { RegisterEndpointDto } from '../dto/register-endpoint.dto';

/**
 * Service responsible for building template variables for artifact generation.
 * 
 * This service processes endpoint analysis results and DTOs to create comprehensive
 * template variables that are used by Handlebars templates to generate testing
 * artifacts. It handles field extraction, validation rules, type mapping, and
 * business logic detection.
 * 
 * @class TemplateVariablesService
 * @since 1.0.0
 */
@Injectable()
export class TemplateVariablesService {
  private readonly logger = new Logger(TemplateVariablesService.name);

  /**
   * Builds comprehensive template variables for artifact generation.
   * 
   * This method processes endpoint analysis results and DTOs to create a complete
   * set of template variables including entity information, field definitions,
   * validation rules, business logic flags, and method configurations.
   * 
   * @param dto - The endpoint registration data containing entity and method information
   * @param analysisResult - The analysis results from endpoint exploration
   * @param project - The project configuration and metadata
   * @returns Comprehensive template variables object for Handlebars templates
   * 
   * @example
   * ```typescript
   * const variables = templateVariables.buildTemplateVariables(dto, analysis, project);
   * // Use variables in Handlebars template rendering
   * ```
   */
  buildTemplateVariables(
    dto: RegisterEndpointDto,
    analysisResult: any,
    project: Project,
  ): any {
    // console.log('🔍 === START buildTemplateVariables ===');
    // console.log('📋 DTO received:', JSON.stringify(dto, null, 2));
    // console.log('🔬 AnalysisResult received:', JSON.stringify(analysisResult, null, 2));
    // console.log('📁 Project received:', JSON.stringify(project, null, 2));

    // Basic variables
    const entityName = dto.entityName;
    const entityNamePlural = this.pluralize(entityName);
    const entityLower = entityName.toLowerCase();
    const entityLowerPlural = entityNamePlural.toLowerCase();

    // console.log('🏷️ Basic variables generated:');
    // console.log('  - entityName:', entityName);
    // console.log('  - entityNamePlural:', entityNamePlural);
    // console.log('  - entityLower:', entityLower);
    // console.log('  - entityLowerPlural:', entityLowerPlural);

    // Find successful methods
    const successfulMethods = Object.keys(analysisResult.analysisResults || {}).filter(
      (method) => analysisResult.analysisResults[method]?.success,
    );

    // console.log('✅ Successful methods found:', successfulMethods);

    // Select method for entity (prioritize POST for creation)
    const methodForEntity = successfulMethods.includes('POST') ? 'POST' : successfulMethods[0];
    // console.log('🎯 Method for entity selected:', methodForEntity);

    const methodAnalysis = analysisResult.analysisResults[methodForEntity];
    // console.log('📊 Schema for entity method:', JSON.stringify(methodAnalysis?.inferredResponseSchema, null, 2));

    // Extract fields from response schema
    const fields = this.extractFieldsFromSchema(
      methodAnalysis?.inferredResponseSchema,
      entityName,
    );
    // console.log('📝 Fields extracted from response schema:', JSON.stringify(fields, null, 2));

    // Extract create fields from POST request body
    const createFields = successfulMethods.includes('POST')
      ? this.extractFieldsFromRequestBody(
          analysisResult.analysisResults['POST']?.requestBodyDefinition,
          entityName,
          'create',
        )
      : [];
    // console.log('📝 Fields extracted from requestBodyDefinition (POST):', JSON.stringify(createFields, null, 2));

    // Extract update fields from PATCH/PUT request body
    const updateFields = successfulMethods.includes('PATCH')
      ? this.extractFieldsFromRequestBody(
          analysisResult.analysisResults['PATCH']?.requestBodyDefinition,
          entityName,
          'update',
        )
      : successfulMethods.includes('PUT')
      ? this.extractFieldsFromRequestBody(
          analysisResult.analysisResults['PUT']?.requestBodyDefinition,
          entityName,
          'update',
        )
      : [];
    // console.log('📝 Fields extracted from requestBodyDefinition (PATCH):', JSON.stringify(updateFields, null, 2));

    // Build template variables
    const templateVariables = {
      // Entity information
      entityName,
      entityNamePlural,
      entityLower,
      entityLowerPlural,
      EntityName: entityName,
      EntityNamePlural: entityNamePlural,

      // Section information
      section: dto.section,
      sectionDisplayName: this.capitalize(dto.section),

      // Project information
      projectName: project.name,
      baseUrl: project.baseUrl,
      basePath: project.basePath || '/v1/api',
      description: (project as any).description || '',
      author: (project as any).author || 'Auto-generated',

      // Endpoint information
      endpointPath: dto.path,
      httpMethod: methodForEntity,
      operation: this.getOperationFromMethod(methodForEntity),

      // Fields
      fields,
      createFields,
      updateFields,
      requiredFields: fields.filter((f) => f.required),
      requiredCreateFields: createFields.filter((f) => f.required),
      numericFields: fields.filter((f) => f.type === 'number' || f.type === 'integer'),
      fieldValidations: this.generateFieldValidations(createFields),

      // Flags
      hasCreate: successfulMethods.includes('POST'),
      hasUpdate: successfulMethods.includes('PATCH') || successfulMethods.includes('PUT'),
      hasRead: successfulMethods.includes('GET'),
      hasDelete: successfulMethods.includes('DELETE'),
      hasAddress: fields.some((f) => f.name.toLowerCase().includes('address')),
      hasOrderStatus: fields.some((f) => f.name.toLowerCase().includes('status')),
      hasSearchParams: this.detectSearchParams(dto.path, fields),
      hasValidation: fields.some((f) => f.validations && Object.keys(f.validations).length > 0),
      hasFilters: this.detectFilters(dto.path, fields),
      requiresUser: this.detectAuthRequirements(dto.methods),
      businessPurpose: this.generateBusinessPurpose(entityName, dto.section),

      // Methods for API client
      methods: (dto.methods || []).map((methodConfig) => {
        const method = methodConfig.method;
        const analysis = analysisResult.analysisResults?.[method] || {};
        return {
          ...(methodConfig as any),
          expectedStatusCode: analysis.inferredStatusCode ?? (methodConfig as any).expectedStatusCode ?? this.defaultStatus(method),
        };
      }),
    };

    // console.log('🔧 === FINAL buildTemplateVariables ===');
    // console.log('📦 Template variables generated:', JSON.stringify(templateVariables, null, 2));

    return templateVariables;
  }

  /**
   * Extracts field definitions from API response schema.
   * 
   * This private method processes JSON schema objects to extract field definitions
   * including types, validation rules, and metadata for template generation.
   * 
   * @private
   * @param schema - The JSON schema object from API analysis
   * @param entityName - The name of the entity being processed
   * @returns Array of field definition objects
   */
  private extractFieldsFromSchema(schema: any, entityName: string): any[] {
    if (!schema?.properties) return [];
    
    // Normalize path to properties within data
    const dataNode = schema.properties.data;
    let props: Record<string, any> = {};
    let required: string[] = [];
    
    if (entityName === 'GET' && dataNode?.items?.properties) {
      props = dataNode.items.properties;
      required = dataNode.items.required || [];
    } else if (dataNode?.properties) {
      props = dataNode.properties;
      required = dataNode.required || [];
    }
    
    return Object.entries(props)
      .filter(([name]) => !['id', 'createdAt', 'updatedAt'].includes(name))
      .map(([name, prop]) => {
        const type = this.tsType(prop);
        return {
          name,
          type,
          jsonType: prop.type,
          required: required.includes(name),
          nullable: prop.nullable || false,
          format: prop.format,
          minLength: prop.minLength,
          minimum: prop.minimum,
          maximum: prop.maximum,
          isFaker: true,
          fakerMethod: this.fakerFor(name, prop.type),
          defaultValue: this.defaultValue(prop.type),
          invalidValue: this.invalidValue(prop.type, name),
        };
      });
  }

  /**
   * Extracts field definitions from request body definitions.
   * 
   * This private method processes request body field definitions to extract
   * field information for create and update operations.
   * 
   * @private
   * @param definition - Array of request body field definitions
   * @param entityName - The name of the entity being processed
   * @param type - The type of operation (create or update)
   * @returns Array of field definition objects
   */
  private extractFieldsFromRequestBody(definition: any[], entityName: string, type: string): any[] {
    if (!definition) return [];
    
    return definition.map(f => this.mapInputField(f, type === 'create'));
  }

  private mapInputField(field: any, isCreate: boolean): any {
    const req = field.validations?.required === true;
    const type = this.tsType({ type: field.type, items: field.items });
    
    return {
      name: field.name,
      type,
      jsonType: field.type,
      required: isCreate ? req : false,
      optional: isCreate ? !req : true,
      nullable: field.validations?.nullable || false,
      format: field.validations?.format,
      minLength: field.validations?.minLength,
      minimum: field.validations?.minimum,
      maximum: field.validations?.maximum,
      isFaker: true,
      fakerMethod: this.fakerFor(field.name, field.type),
      defaultValue: field.example || this.defaultValue(field.type),
      invalidValue: this.invalidValue(field.type, field.name),
      validations: field.validations,
      validationRules: this.extractValidationRules(field.validations),
    };
  }

  private extractValidationRules(validations: any): any {
    if (!validations) return {};
    
    const rules: any = {};
    
    if (validations.required === true) {
      rules.required = true;
    }
    
    if (validations.minLength !== undefined) {
      rules.minLength = validations.minLength;
    }
    
    if (validations.maxLength !== undefined) {
      rules.maxLength = validations.maxLength;
    }
    
    if (validations.minimum !== undefined) {
      rules.minimum = validations.minimum;
    }
    
    if (validations.maximum !== undefined) {
      rules.maximum = validations.maximum;
    }
    
    if (validations.pattern !== undefined) {
      rules.pattern = validations.pattern;
    }
    
    if (validations.format !== undefined) {
      rules.format = validations.format;
    }
    
    if (validations.enum !== undefined) {
      rules.enum = validations.enum;
    }
    
    return rules;
  }

  private tsType(prop: any): string {
    const t = prop.type;
    if (t === 'array') {
      const inner = this.tsType(prop.items || {});
      return `${inner}[]`;
    }
    if (t === 'object' && prop.properties) {
      const hasAddressFields = Object.keys(prop.properties).some(key => 
        key.toLowerCase().includes('address') || 
        key.toLowerCase().includes('street') ||
        key.toLowerCase().includes('city') ||
        key.toLowerCase().includes('state') ||
        key.toLowerCase().includes('zip') ||
        key.toLowerCase().includes('country')
      );
      
      const hasStatusFields = Object.keys(prop.properties).some(key => 
        key.toLowerCase().includes('status') || 
        key.toLowerCase().includes('state') ||
        key.toLowerCase().includes('type')
      );
      
      if (hasAddressFields) {
        return 'Address';
      }
      if (hasStatusFields) {
        return 'Status';
      }
      return 'Record<string, any>';
    }
    switch (t) {
      case 'string': return 'string';
      case 'number': case 'integer': return 'number';
      case 'boolean': return 'boolean';
      case 'object': return 'Record<string, any>';
      default: return 'any';
    }
  }

  private fakerFor(name: string, type: string): string {
    const key = name.toLowerCase();
    
    if (type === 'string') {
      if (key.includes('email')) return 'faker.internet.email()';
      if (key.includes('url') || key.includes('image')) return 'faker.image.url()';
      if (key.includes('date')) return 'faker.date.recent().toISOString()';
      if (key.includes('uuid') || key.endsWith('id')) return 'faker.string.uuid()';
      if (key.includes('name')) {
        if (key.includes('product')) return 'faker.commerce.productName()';
        if (key.includes('first')) return 'faker.person.firstName()';
        if (key.includes('last')) return 'faker.person.lastName()';
        return 'faker.person.fullName()';
      }
      if (key.includes('description')) return 'faker.lorem.sentence()';
      if (key.includes('phone')) return 'faker.phone.number()';
      if (key.includes('address') || key.includes('street')) return 'faker.location.streetAddress()';
      if (key.includes('city')) return 'faker.location.city()';
      if (key.includes('state')) return 'faker.location.state()';
      if (key.includes('zip') || key.includes('postal')) return 'faker.location.zipCode()';
      if (key.includes('country')) return 'faker.location.country()';
      return 'faker.lorem.word()';
    }
    
    if (type === 'number') {
      if (key.includes('price') || key.includes('amount') || key.includes('cost') || key.includes('value')) {
        return 'faker.number.float({ min: 10, max: 2000, multipleOf: 0.01 })';
      }
      if (key.includes('count') || key.includes('stock') || key.includes('quantity') || key.includes('qty')) {
        return 'faker.number.int({ min: 0, max: 1000 })';
      }
      if (key.includes('age')) return 'faker.number.int({ min: 18, max: 80 })';
      if (key.includes('rating') || key.includes('score')) return 'faker.number.int({ min: 1, max: 5 })';
      return 'faker.number.int({ min: 1, max: 100 })';
    }
    
    if (type === 'boolean') {
      if (key.includes('active') || key.includes('isactive')) {
        return 'true';
      }
      return 'faker.datatype.boolean()';
    }
    
    if (type === 'array') return '[]';
    if (type === 'object') return '{}';
    
    return 'faker.lorem.word()';
  }

  private defaultValue(type: string): string {
    switch (type) {
      case 'string': return "''";
      case 'number': return '0';
      case 'boolean': return 'false';
      case 'array': return '[]';
      case 'object': return '{}';
      default: return 'null';
    }
  }

  private invalidValue(type: string, fieldName: string = ''): string {
    const key = fieldName.toLowerCase();
    
    switch (type) {
      case 'string':
        if (key.includes('name')) return "'a'"; // Too short
        if (key.includes('email')) return "'invalid-email-format'";
        if (key.includes('url')) return "'not-a-valid-url'";
        if (key.includes('description')) return "'a'"; // Too short
        return "'a'"; // Too short for most string fields
      case 'number':
        if (key.includes('price') || key.includes('cost')) return '-100'; // More negative
        if (key.includes('stock') || key.includes('quantity')) return '-50'; // More negative
        return '-999'; // Very negative number
      case 'boolean': return 'undefined'; // undefined instead of null for boolean fields
      case 'array': return 'null';
      case 'object': return 'null';
      default: return 'null';
    }
  }

  private defaultStatus(method: string): number {
    const map: Record<string, number> = { 
      POST: 201, 
      GET: 200, 
      PATCH: 200, 
      PUT: 200,
      DELETE: 204 
    };
    return map[method] || 200;
  }

  /**
   * Converts a word to its plural form for template variable generation.
   * 
   * This private method handles basic English pluralization rules for
   * generating plural entity names in templates.
   * 
   * @private
   * @param word - The word to pluralize
   * @returns The plural form of the word
   */
  private pluralize(word: string): string {
    if (word.endsWith('y')) {
      return word.slice(0, -1) + 'ies';
    }
    if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || 
        word.endsWith('x') || word.endsWith('z')) {
      return word + 'es';
    }
    return word + 's';
  }

  private detectSpecialTypes(fields: any[]): string[] {
    const types = new Set<string>();
    
    fields.forEach(f => {
      if (f.type === 'Address') types.add('Address');
      if (f.type === 'Status') types.add('Status');
      if (f.type.endsWith('[]')) {
        const baseType = f.type.replace(/\[\]$/, '');
        if (baseType !== 'string' && baseType !== 'number' && baseType !== 'boolean') {
          types.add(baseType);
        }
      }
      
      if (f.format === 'email') types.add('Email');
      if (f.format === 'uuid') types.add('UUID');
    });
    
    return Array.from(types);
  }

  private buildImports(types: string[]): string {
    const commonTypes = ['BaseEntity', 'Address', 'Status', 'ContactInfo'];
    const validTypes = types.filter(type => commonTypes.includes(type));
    
    if (validTypes.length === 0) {
      return "import { BaseEntity } from '../common';";
    }
    
    const imports = ['BaseEntity', ...validTypes];
    return `import { ${imports.join(', ')} } from '../common';`;
  }

  private detectArrayFields(fields: any[]): any[] {
    // ✅ NEW: Detect array fields based solely on real schema
    return fields.filter(field => field.type.endsWith('[]'));
  }

  private hasItemsField(fields: any[]): boolean {
    // ✅ REFACTORED: Now based solely on real arrays
    return fields.some(field => field.type.endsWith('[]'));
  }

  private generateSpecialInterfaces(entityName: string, hasItems: boolean, arrayFields: any[], fields: any[]): any[] {
    const interfaces: any[] = [];
    
    if (hasItems && arrayFields.length > 0) {
      // ✅ NEW: Generate interfaces based on detected real arrays
      arrayFields.forEach(arrayField => {
        const itemType = arrayField.type.replace(/\[\]$/, ''); // Extract base type from array
        const itemName = arrayField.name.charAt(0).toUpperCase() + arrayField.name.slice(1);
        
        const itemInterface = {
          name: `${itemName}Item`,
          fields: [
            // Basic fields that every item should have
            { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
            { name: 'name', type: 'string', required: true, description: 'Item name' },
            // If base type is not primitive, add specific fields
            ...(itemType !== 'string' && itemType !== 'number' && itemType !== 'boolean' ? [
              { name: 'data', type: itemType, required: true, description: 'Item data' }
            ] : [])
          ]
        };
        
        const addItemDto = {
          name: `Add${itemName}ItemDto`,
          fields: [
            { name: 'name', type: 'string', required: true, description: 'Item name' },
            ...(itemType !== 'string' && itemType !== 'number' && itemType !== 'boolean' ? [
              { name: 'data', type: itemType, required: true, description: 'Item data' }
            ] : [])
          ]
        };
        
        const updateItemDto = {
          name: `Update${itemName}ItemDto`,
          fields: [
            { name: 'name', type: 'string', required: false, description: 'Item name' },
            ...(itemType !== 'string' && itemType !== 'number' && itemType !== 'boolean' ? [
              { name: 'data', type: itemType, required: false, description: 'Item data' }
            ] : [])
          ]
        };
        
        interfaces.push(itemInterface, addItemDto, updateItemDto);
      });
    }
    
    // Detect other special types based on field patterns
    const specialTypes = this.detectSpecialFieldPatterns(fields);
    interfaces.push(...specialTypes);
    
    return interfaces;
  }

  private detectItemFields(fields: any[]): any[] {
    // ✅ REFACTORED: Now based solely on real arrays
    return fields
      .filter(field => field.type.endsWith('[]'))
      .map(field => ({
        name: field.name,
        type: field.type,
        required: field.required,
        description: `Array of ${field.name} items`
      }));
  }

  private detectSpecialFieldPatterns(fields: any[]): any[] {
    const interfaces: any[] = [];
    
    const addressFields = fields.filter(f => 
      f.name.toLowerCase().includes('address') ||
      f.name.toLowerCase().includes('street') ||
      f.name.toLowerCase().includes('city') ||
      f.name.toLowerCase().includes('state') ||
      f.name.toLowerCase().includes('zip') ||
      f.name.toLowerCase().includes('country')
    );
    
    if (addressFields.length > 2) {
      interfaces.push({
        name: 'Address',
        fields: addressFields.map(field => ({
          name: field.name,
          type: field.type,
          required: field.required,
          description: `Address field: ${field.name}`
        }))
      });
    }
    
    const contactFields = fields.filter(f => 
      f.name.toLowerCase().includes('email') ||
      f.name.toLowerCase().includes('phone') ||
      f.name.toLowerCase().includes('mobile') ||
      f.name.toLowerCase().includes('contact')
    );
    
    if (contactFields.length > 1) {
      interfaces.push({
        name: 'ContactInfo',
        fields: contactFields.map(field => ({
          name: field.name,
          type: field.type,
          required: field.required,
          description: `Contact field: ${field.name}`
        }))
      });
    }
    
    // ✅ CORRECTED: Only generate interfaces for complex status/state fields
    // DO NOT generate interfaces for simple fields like categoryId, userId, etc.
    const complexStatusFields = fields.filter(f => 
      (f.name.toLowerCase().includes('status') || f.name.toLowerCase().includes('state')) &&
      f.type === 'object' // Only if it's a complex object, not a simple string
    );
    
    if (complexStatusFields.length > 0) {
      complexStatusFields.forEach(field => {
        interfaces.push({
          name: `${field.name.charAt(0).toUpperCase() + field.name.slice(1)}`,
          fields: [{
            name: 'value',
            type: field.type,
            required: true,
            description: `Enum value for ${field.name}`
          }]
        });
      });
    }
    
    return interfaces;
  }

  // ✅ CORRECTED: Generate validations based on combined fields (response + POST)
  private generateFieldValidations(fields: any[]): any[] {
    return fields
      .filter(field => field.required || Object.keys(field.validationRules || {}).length > 0)
      .map(field => {
        const validations: string[] = [];
        
        // ✅ NEW: Use combined validation rules
        if (field.validationRules) {
          if (field.validationRules.minLength !== undefined) {
            validations.push(`minLength: ${field.validationRules.minLength}`);
          }
          if (field.validationRules.maxLength !== undefined) {
            validations.push(`maxLength: ${field.validationRules.maxLength}`);
          }
          if (field.validationRules.minimum !== undefined) {
            validations.push(`minimum: ${field.validationRules.minimum}`);
          }
          if (field.validationRules.maximum !== undefined) {
            validations.push(`maximum: ${field.validationRules.maximum}`);
          }
          if (field.validationRules.pattern !== undefined) {
            validations.push(`pattern: '${field.validationRules.pattern}'`);
          }
          if (field.validationRules.format !== undefined) {
            validations.push(`format: '${field.validationRules.format}'`);
          }
          if (field.validationRules.enum !== undefined) {
            validations.push(`enum: [${field.validationRules.enum.map((e: any) => `'${e}'`).join(', ')}]`);
          }
        }
        
        // ✅ NEW: Add required if field is required (from POST)
        if (field.required) {
          validations.push('required: true');
        }
        
        // ✅ NEW: If no specific validations but field exists, add required: true
        if (validations.length === 0 && field.required) {
          validations.push('required: true');
        }
        
        const validation = validations.length > 0 ? validations.join(', ') : 'required: true';
        
        return {
          field: field.name,
          validation,
          rules: field.validationRules || {},
        };
      });
  }

  // Method to combine response fields with POST validations
  private combineFieldsWithValidations(responseFields: any[], createFields: any[]): any[] {
    const combinedFields = responseFields.map(responseField => {
      // Find corresponding validations in POST
      const createField = createFields.find(cf => cf.name === responseField.name);
      
      // LOGIC: If no validations in POST, assume not required and no min/max
      const validations = createField?.validations || {};
      const validationRules = createField?.validationRules || {};
      
      // Copy specific validations as direct properties
      const combinedField = {
        ...responseField,
        // DEFAULT VALUES: If no validations, assume not required
        required: validations.required === true,
        optional: validations.required !== true,
        // Copy specific validations directly
        minLength: validations.minLength,
        maxLength: validations.maxLength,
        minimum: validations.minimum,
        maximum: validations.maximum,
        pattern: validations.pattern,
        format: validations.format,
        enum: validations.enum,
        default: validations.default,
        nullable: validations.nullable || false,
        // VALIDATION RULES: For template
        validationRules,
        // DEFAULT VALUES: If no specific validations
        defaultValue: createField?.example || responseField.defaultValue,
        invalidValue: responseField.invalidValue,
      };
      
      return combinedField;
    });
    
    return combinedFields;
  }

  private capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getOperationFromMethod(method: string): string {
    switch ((method || '').toUpperCase()) {
      case 'POST': return 'create';
      case 'GET': return 'read';
      case 'PUT': return 'update';
      case 'PATCH': return 'update';
      case 'DELETE': return 'delete';
      default: return method?.toLowerCase() || '';
    }
  }

  private generateBusinessPurpose(entityName: string, section: string): string {
    // Generate a generic business purpose for the entity
    return `Manage ${entityName.toLowerCase()}s in the ${section} section.`;
  }

  private detectSearchParams(path: string, fields: any[]): boolean {
    // Detect if the endpoint has search parameters
    const searchPatterns = ['search', 'query', 'q', 'filter', 'find'];
    const pathLower = path.toLowerCase();
    
    // Check if the path contains search patterns
    if (searchPatterns.some(pattern => pathLower.includes(pattern))) {
      return true;
    }
    
    // Check if there are fields that suggest search functionality
    const searchFields = fields.filter(field => 
      field.name.toLowerCase().includes('search') ||
      field.name.toLowerCase().includes('query') ||
      field.name.toLowerCase().includes('filter') ||
      field.name.toLowerCase().includes('keyword')
    );
    
    return searchFields.length > 0;
  }

  private detectFilters(path: string, fields: any[]): boolean {
    // Detect if the endpoint has filtering capabilities
    const filterPatterns = ['filter', 'where', 'by', 'category', 'status', 'type'];
    const pathLower = path.toLowerCase();
    
    // Check if the path contains filtering patterns
    if (filterPatterns.some(pattern => pathLower.includes(pattern))) {
      return true;
    }
    
    // Check if there are fields that suggest filtering functionality
    const filterFields = fields.filter(field => 
      field.name.toLowerCase().includes('category') ||
      field.name.toLowerCase().includes('status') ||
      field.name.toLowerCase().includes('type') ||
      field.name.toLowerCase().includes('tag') ||
      field.name.toLowerCase().includes('group')
    );
    
    return filterFields.length > 0;
  }

  private detectAuthRequirements(methods: any[]): boolean {
    // Detect if any method requires authentication
    return methods.some(method => method.requiresAuth === true);
  }
}
 