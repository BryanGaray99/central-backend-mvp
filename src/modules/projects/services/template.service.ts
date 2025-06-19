import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class TemplateService {
  private readonly templatesPath: string;

  constructor() {
    // NestJS copia los assets al mismo nivel que el código compilado
    this.templatesPath = path.join(__dirname, '..', 'templates');
  }

  async renderTemplate(templateName: string, variables: Record<string, any>): Promise<string> {
    const templatePath = path.join(this.templatesPath, templateName);
    const template = await fs.readFile(templatePath, 'utf-8');
    
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  async writeRenderedTemplate(
    templateName: string,
    targetPath: string,
    variables: Record<string, any>,
  ): Promise<void> {
    const content = await this.renderTemplate(templateName, variables);
    await fs.writeFile(targetPath, content);
  }
} 