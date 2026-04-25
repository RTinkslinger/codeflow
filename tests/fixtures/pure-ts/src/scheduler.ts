import { Queue } from './queue.js'
export class Scheduler {
  private queue = new Queue<() => void>()
  schedule(task: () => void): void { this.queue.push(task) }
  run(): void { let t; while ((t = this.queue.pop()) !== undefined) t() }
}
