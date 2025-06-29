import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as Handlebars from 'handlebars';

@Injectable()
export class TemplateService {
  private readonly templatesPath: string;

  constructor() {
    // NestJS copia los assets al mismo nivel que el código compilado
    this.templatesPath = path.join(__dirname, '..', 'templates');
    
    // Registrar helpers de Handlebars necesarios para los templates
    this.registerHandlebarsHelpers();
  }

  private registerHandlebarsHelpers(): void {
    // Comparación de igualdad - soporta uso como función y como bloque
    Handlebars.registerHelper('eq', function(a, b, options) {
      const isEqual = a === b;
      // Si el último argumento es el objeto options de Handlebars (uso como bloque)
      if (typeof options === 'object' && options && typeof options.fn === 'function') {
        return isEqual ? options.fn(this) : options.inverse(this);
      }
      // Si se usa como función (en expresiones)
      return isEqual;
    });

    // Comparación de desigualdad - soporta uso como función y como bloque
    Handlebars.registerHelper('neq', function(a, b, options) {
      const isNotEqual = a !== b;
      // Si el último argumento es el objeto options de Handlebars (uso como bloque)
      if (typeof options === 'object' && options && typeof options.fn === 'function') {
        return isNotEqual ? options.fn(this) : options.inverse(this);
      }
      // Si se usa como función (en expresiones)
      return isNotEqual;
    });

    // Concatenar strings
    Handlebars.registerHelper('concat', function(...args) {
      return args.slice(0, -1).join('');
    });

    // Capitalizar la primera letra
    Handlebars.registerHelper('capitalize', function(str) {
      if (typeof str !== 'string') return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Convertir a kebab-case
    Handlebars.registerHelper('kebabCase', function(str) {
      if (typeof str !== 'string') return str;
      return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
    });

    // Escapar comillas para evitar HTML encoding
    Handlebars.registerHelper('escapeQuotes', function(str) {
      if (typeof str !== 'string') return str;
      return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    });

    // Verificar si un array contiene un valor - soporta uso como función y como bloque
    Handlebars.registerHelper('includes', function(array, value, options) {
      const hasValue = Array.isArray(array) && array.includes(value);
      // Si el último argumento es el objeto options de Handlebars (uso como bloque)
      if (typeof options === 'object' && options && typeof options.fn === 'function') {
        return hasValue ? options.fn(this) : options.inverse(this);
      }
      // Si se usa como función (en expresiones)
      return hasValue;
    });

    // Obtener el primer elemento de un array
    Handlebars.registerHelper('first', function(array) {
      if (!Array.isArray(array) || array.length === 0) return '';
      return array[0];
    });

    // Obtener el último elemento de un array
    Handlebars.registerHelper('last', function(array) {
      if (!Array.isArray(array) || array.length === 0) return '';
      return array[array.length - 1];
    });

    // Verificar si un objeto tiene una propiedad - soporta uso como función y como bloque
    Handlebars.registerHelper('hasProperty', function(obj, property, options) {
      const hasProp = obj && typeof obj === 'object' && obj.hasOwnProperty(property);
      // Si el último argumento es el objeto options de Handlebars (uso como bloque)
      if (typeof options === 'object' && options && typeof options.fn === 'function') {
        return hasProp ? options.fn(this) : options.inverse(this);
      }
      // Si se usa como función (en expresiones)
      return hasProp;
    });

    // Obtener el tipo de dato
    Handlebars.registerHelper('getType', function(value) {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    });

    // Verificar si es el primer elemento en un loop
    Handlebars.registerHelper('isFirst', function(index, options) {
      const isFirst = index === 0;
      // Si el último argumento es el objeto options de Handlebars (uso como bloque)
      if (typeof options === 'object' && options && typeof options.fn === 'function') {
        return isFirst ? options.fn(this) : options.inverse(this);
      }
      // Si se usa como función (en expresiones)
      return isFirst;
    });

    // Verificar si es el último elemento en un loop
    Handlebars.registerHelper('isLast', function(index, array, options) {
      const isLast = index === array.length - 1;
      // Si el último argumento es el objeto options de Handlebars (uso como bloque)
      if (typeof options === 'object' && options && typeof options.fn === 'function') {
        return isLast ? options.fn(this) : options.inverse(this);
      }
      // Si se usa como función (en expresiones)
      return isLast;
    });

    // Registrar helper ifDefined para valores como minimum: 0
    Handlebars.registerHelper('ifDefined', function (value, options) {
      return typeof value !== 'undefined' ? options.fn(this) : options.inverse(this);
    });
  }

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

    // Configurar Handlebars para no escapar HTML automáticamente
    const template = Handlebars.compile(templateSource, {
      noEscape: true,
      strict: false,
      compat: false
    });
    return template(variables);
  }

  async writeRenderedTemplate(
    templateNameOrPath: string,
    targetPath: string,
    variables: Record<string, any>,
  ): Promise<void> {
    const content = await this.renderTemplate(templateNameOrPath, variables);
    await fs.writeFile(targetPath, content);
  }
} 