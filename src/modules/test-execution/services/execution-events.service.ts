import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';

export interface ExecutionEvent {
  executionId: string;
  type: 'started' | 'progress' | 'completed' | 'failed';
  status: string;
  progress?: number;
  message?: string;
  timestamp: string;
  projectId: string;
  entityName?: string;
  testSuiteId?: string;
  testCaseId?: string;
  results?: any;
}

@Injectable()
/**
 * Service: ExecutionEventsService
 *
 * Provides a lightweight server-sent events (SSE) publisher to stream
 * execution lifecycle events to subscribed clients.
 */
export class ExecutionEventsService {
  private readonly logger = new Logger(ExecutionEventsService.name);
  private readonly executionEvents = new Subject<ExecutionEvent>();

  /**
   * Emits an execution event to all subscribers.
   *
   * @param event - Execution event payload
   */
  emitExecutionEvent(event: ExecutionEvent) {
    this.logger.log(`Emitting execution event: ${event.type} for ${event.executionId}`);
    this.logger.log(`Full event data:`, JSON.stringify(event, null, 2));
    this.executionEvents.next(event);
  }

  /**
   * Returns an SSE stream filtered by project ID.
   *
   * @param projectId - Project identifier to filter events
   */
  getExecutionEvents(projectId: string): Observable<MessageEvent> {
    return this.executionEvents.asObservable().pipe(
      map(event => {
        // Only send events for the specific project
        if (event.projectId === projectId) {
          const messageEvent = {
            data: JSON.stringify(event),
          } as MessageEvent;
          this.logger.log(`Sending SSE event to client: ${event.type} for ${event.executionId}`);
          this.logger.log(`Message data: ${messageEvent.data}`);
          return messageEvent;
        }
        return null;
      }),
      filter((event): event is MessageEvent => event !== null)
    );
  }

  /**
   * Emits an execution started event.
   */
  emitExecutionStarted(executionId: string, projectId: string, entityName?: string, testSuiteId?: string, testCaseId?: string) {
    this.emitExecutionEvent({
      executionId,
      type: 'started',
      status: 'running',
      message: `Execution started${entityName ? ` for ${entityName}` : ''}`,
      timestamp: new Date().toISOString(),
      projectId,
      entityName,
      testSuiteId,
      testCaseId,
    });
  }

  /**
   * Emits an execution progress event.
   */
  emitExecutionProgress(executionId: string, projectId: string, progress: number, message?: string) {
    this.emitExecutionEvent({
      executionId,
      type: 'progress',
      status: 'running',
      progress,
      message,
      timestamp: new Date().toISOString(),
      projectId,
    });
  }

  /**
   * Emits an execution completed event.
   */
  emitExecutionCompleted(executionId: string, projectId: string, results: any) {
    this.emitExecutionEvent({
      executionId,
      type: 'completed',
      status: 'completed',
      message: 'Execution completed successfully',
      timestamp: new Date().toISOString(),
      projectId,
      results,
    });
  }

  /**
   * Emits an execution failed event.
   */
  emitExecutionFailed(executionId: string, projectId: string, error: string) {
    this.emitExecutionEvent({
      executionId,
      type: 'failed',
      status: 'failed',
      message: `Execution failed: ${error}`,
      timestamp: new Date().toISOString(),
      projectId,
    });
  }
}
