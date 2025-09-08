import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as Handlebars from 'handlebars';

/**
 * Service for template processing and rendering.
 * 
 * This service provides functionality for rendering Handlebars templates
 * with project-specific variables. It includes a comprehensive set of
 * Handlebars helpers for common template operations and supports both
 * file-based and string-based template rendering.
 * 
 * @class TemplateService
 * @since 1.0.0
 */
@Injectable()
export class TemplateService {
  /** Path to the templates directory */
  private readonly templatesPath: string;

  /**
   * Creates an instance of TemplateService.
   * 
   * Initializes the templates path and registers Handlebars helpers.
   */
  constructor() {
    // NestJS copies assets to the same level as compiled code
    this.templatesPath = path.join(__dirname, '..', 'templates');
    
    // Register Handlebars helpers needed for templates
    this.registerHandlebarsHelpers();
  }

  /**
   * Registers Handlebars helpers for template processing.
   * 
   * This method registers a comprehensive set of Handlebars helpers that
   * support both function and block usage patterns.
   * 
   * @private
   */
  private registerHandlebarsHelpers(): void {
    // Equality comparison - supports both function and block usage
    Handlebars.registerHelper('eq', function(a, b, options) {
      const isEqual = a === b;
      // If the last argument is the Handlebars options object (block usage)
      if (typeof options === 'object' && options && typeof options.fn === 'function') {
        return isEqual ? options.fn(this) : options.inverse(this);
      }
      // If used as a function (in expressions)
      return isEqual;
    });

    // Inequality comparison - supports both function and block usage
    Handlebars.registerHelper('neq', function(a, b, options) {
      const isNotEqual = a !== b;
      // If the last argument is the Handlebars options object (block usage)
      if (typeof options === 'object' && options && typeof options.fn === 'function') {
        return isNotEqual ? options.fn(this) : options.inverse(this);
      }
      // If used as a function (in expressions)
      return isNotEqual;
    });

    // String concatenation
    Handlebars.registerHelper('concat', function(...args) {
      return args.slice(0, -1).join('');
    });

    // Capitalize first letter
    Handlebars.registerHelper('capitalize', function(str) {
      if (typeof str !== 'string') return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Convert to kebab-case
    Handlebars.registerHelper('kebabCase', function(str) {
      if (typeof str !== 'string') return str;
      return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
    });

    // Escape quotes to avoid HTML encoding
    Handlebars.registerHelper('escapeQuotes', function(str) {
      if (typeof str !== 'string') return str;
      return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    });

    // Check if an array contains a value - supports both function and block usage
    Handlebars.registerHelper('includes', function(array, value, options) {
      const hasValue = Array.isArray(array) && array.includes(value);
      // If the last argument is the Handlebars options object (block usage)
      if (typeof options === 'object' && options && typeof options.fn === 'function') {
        return hasValue ? options.fn(this) : options.inverse(this);
      }
      // If used as a function (in expressions)
      return hasValue;
    });

    // Get the first element of an array
    Handlebars.registerHelper('first', function(array) {
      if (!Array.isArray(array) || array.length === 0) return '';
      return array[0];
    });

    // Get the last element of an array
    Handlebars.registerHelper('last', function(array) {
      if (!Array.isArray(array) || array.length === 0) return '';
      return array[array.length - 1];
    });

    // Check if an object has a property - supports both function and block usage
    Handlebars.registerHelper('hasProperty', function(obj, property, options) {
      const hasProp = obj && typeof obj === 'object' && obj.hasOwnProperty(property);
      // If the last argument is the Handlebars options object (block usage)
      if (typeof options === 'object' && options && typeof options.fn === 'function') {
        return hasProp ? options.fn(this) : options.inverse(this);
      }
      // If used as a function (in expressions)
      return hasProp;
    });

    // Get the data type
    Handlebars.registerHelper('getType', function(value) {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    });

    // Check if it's the first element in a loop
    Handlebars.registerHelper('isFirst', function(index, options) {
      const isFirst = index === 0;
      // If the last argument is the Handlebars options object (block usage)
      if (typeof options === 'object' && options && typeof options.fn === 'function') {
        return isFirst ? options.fn(this) : options.inverse(this);
      }
      // If used as a function (in expressions)
      return isFirst;
    });

    // Check if it's the last element in a loop
    Handlebars.registerHelper('isLast', function(index, array, options) {
      const isLast = index === array.length - 1;
      // If the last argument is the Handlebars options object (block usage)
      if (typeof options === 'object' && options && typeof options.fn === 'function') {
        return isLast ? options.fn(this) : options.inverse(this);
      }
      // If used as a function (in expressions)
      return isLast;
    });

    // Register ifDefined helper for values like minimum: 0
    Handlebars.registerHelper('ifDefined', function (value, options) {
      return typeof value !== 'undefined' ? options.fn(this) : options.inverse(this);
    });
  }

  /**
   * Renders a template with the provided variables.
   * 
   * @param templateNameOrPath - Template name or full path to template file
   * @param variables - Variables to use in template rendering
   * @returns Promise that resolves to the rendered template content
   * 
   * @example
   * ```typescript
   * const content = await templateService.renderTemplate('package.json.template', {
   *   name: 'my-project',
   *   version: '1.0.0'
   * });
   * ```
   */
  async renderTemplate(
    templateNameOrPath: string,
    variables: Record<string, any>,
  ): Promise<string> {
    const templatePath =
      path.isAbsolute(templateNameOrPath) ||
      templateNameOrPath.includes('/') ||
      templateNameOrPath.includes('\\')
        ? templateNameOrPath
        : path.join(this.templatesPath, templateNameOrPath);

    const templateSource = await fs.readFile(templatePath, 'utf-8');

    // Configure Handlebars to not automatically escape HTML
    const template = Handlebars.compile(templateSource, {
      noEscape: true,
      strict: false,
      compat: false
    });
    return template(variables);
  }

  /**
   * Renders a template and writes it to a file.
   * 
   * @param templateNameOrPath - Template name or full path to template file
   * @param targetPath - Path where to write the rendered content
   * @param variables - Variables to use in template rendering
   * @returns Promise that resolves when the file is written
   * 
   * @example
   * ```typescript
   * await templateService.writeRenderedTemplate(
   *   'package.json.template',
   *   '/project/package.json',
   *   { name: 'my-project', version: '1.0.0' }
   * );
   * ```
   */
  async writeRenderedTemplate(
    templateNameOrPath: string,
    targetPath: string,
    variables: Record<string, any>,
  ): Promise<void> {
    const content = await this.renderTemplate(templateNameOrPath, variables);
    await fs.writeFile(targetPath, content);
  }
} 