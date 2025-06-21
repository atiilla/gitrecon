// Progress tracking and monitoring - orijinal koddan progress logic

const ColorUtils = require('../utils/colors');

class ProgressTracker {
    constructor() {
        this.tasks = new Map();
        this.currentTask = null;
        this.startTime = null;
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            totalItems: 0,
            processedItems: 0
        };
    }

    // Start tracking a new task
    startTask(taskId, description, totalItems = 0) {
        const task = {
            id: taskId,
            description,
            totalItems,
            processedItems: 0,
            startTime: Date.now(),
            status: 'running',
            errors: [],
            subTasks: new Map()
        };

        this.tasks.set(taskId, task);
        this.currentTask = taskId;
        this.stats.totalTasks++;
        this.stats.totalItems += totalItems;

        if (!this.startTime) {
            this.startTime = Date.now();
        }

        console.log(ColorUtils.green(`Starting: ${description}`));
        if (totalItems > 0) {
            this.displayProgress(taskId);
        }

        return task;
    }

    // Update task progress - orijinal koddan repository scanning progress
    updateProgress(taskId, processedItems = null, currentItem = null) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        if (processedItems !== null) {
            const increment = processedItems - task.processedItems;
            task.processedItems = processedItems;
            this.stats.processedItems += increment;
        } else {
            task.processedItems++;
            this.stats.processedItems++;
        }

        if (currentItem) {
            task.currentItem = currentItem;
        }

        this.displayProgress(taskId);
    }

    // Display progress bar - orijinal koddan progress display logic
    displayProgress(taskId) {
        const task = this.tasks.get(taskId);
        if (!task || task.totalItems === 0) return;

        const percentage = Math.round((task.processedItems / task.totalItems) * 100);
        const progressBarLength = 30;
        const filledLength = Math.round((progressBarLength * task.processedItems) / task.totalItems);
        
        const progressBar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);
        
        let progressText = `\r${ColorUtils.green(`[${progressBar}] ${percentage}%`)}`;
        progressText += ` ${ColorUtils.cyan(`${task.processedItems}/${task.totalItems}`)}`;
        
        if (task.currentItem) {
            const itemDisplay = task.currentItem.length > 30 ? 
                task.currentItem.substring(0, 27) + '...' : 
                task.currentItem;
            progressText += ` - ${ColorUtils.yellow(itemDisplay)}`;
        }

        process.stdout.write(progressText);

        // Add newline when complete
        if (task.processedItems >= task.totalItems) {
            process.stdout.write('\n');
        }
    }

    // Clear current progress line - orijinal koddan
    clearProgress() {
        process.stdout.write('\r' + ' '.repeat(100) + '\r');
    }

    // Add subtask
    addSubTask(parentTaskId, subTaskId, description, totalItems = 0) {
        const parentTask = this.tasks.get(parentTaskId);
        if (!parentTask) return;

        const subTask = {
            id: subTaskId,
            description,
            totalItems,
            processedItems: 0,
            startTime: Date.now(),
            status: 'running',
            errors: []
        };

        parentTask.subTasks.set(subTaskId, subTask);
        return subTask;
    }

    // Update subtask progress
    updateSubTask(parentTaskId, subTaskId, processedItems = null, currentItem = null) {
        const parentTask = this.tasks.get(parentTaskId);
        if (!parentTask) return;

        const subTask = parentTask.subTasks.get(subTaskId);
        if (!subTask) return;

        if (processedItems !== null) {
            subTask.processedItems = processedItems;
        } else {
            subTask.processedItems++;
        }

        if (currentItem) {
            subTask.currentItem = currentItem;
        }

        // Update parent task display with subtask info
        const subTaskProgress = subTask.totalItems > 0 ? 
            `${Math.round((subTask.processedItems / subTask.totalItems) * 100)}%` : 
            `${subTask.processedItems}`;

        this.displaySubTaskProgress(parentTaskId, subTaskId, subTaskProgress);
    }

    // Display subtask progress
    displaySubTaskProgress(parentTaskId, subTaskId, progress) {
        const parentTask = this.tasks.get(parentTaskId);
        const subTask = parentTask?.subTasks.get(subTaskId);
        
        if (!subTask) return;

        const indent = '  ';
        let progressText = `\r${indent}${ColorUtils.cyan('└─')} ${subTask.description}: ${ColorUtils.yellow(progress)}`;
        
        if (subTask.currentItem) {
            progressText += ` - ${ColorUtils.dim(subTask.currentItem)}`;
        }

        process.stdout.write(progressText);
    }

    // Complete a task
    completeTask(taskId, success = true, message = null) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        this.clearProgress();

        task.status = success ? 'completed' : 'failed';
        task.endTime = Date.now();
        task.duration = task.endTime - task.startTime;

        if (success) {
            this.stats.completedTasks++;
            console.log(ColorUtils.green(`✓ Completed: ${task.description}`));
        } else {
            this.stats.failedTasks++;
            console.log(ColorUtils.red(`✗ Failed: ${task.description}`));
        }

        if (message) {
            console.log(ColorUtils.dim(`  ${message}`));
        }

        // Show duration for longer tasks
        if (task.duration > 5000) {
            console.log(ColorUtils.dim(`  Duration: ${this.formatDuration(task.duration)}`));
        }

        if (taskId === this.currentTask) {
            this.currentTask = null;
        }
    }

    // Add error to task
    addError(taskId, error, item = null) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        const errorEntry = {
            message: error.message || error,
            item,
            timestamp: Date.now()
        };

        task.errors.push(errorEntry);
        
        console.log(ColorUtils.red(`Error in ${task.description}: ${errorEntry.message}`));
        if (item) {
            console.log(ColorUtils.dim(`  Item: ${item}`));
        }
    }

    // Estimate remaining time - orijinal koddan ETA calculation concepts
    estimateRemainingTime(taskId) {
        const task = this.tasks.get(taskId);
        if (!task || task.processedItems === 0 || task.totalItems === 0) return null;

        const elapsed = Date.now() - task.startTime;
        const rate = task.processedItems / elapsed; // items per millisecond
        const remaining = task.totalItems - task.processedItems;
        
        return remaining / rate;
    }

    // Format duration
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Display overall progress summary
    displaySummary() {
        console.log(ColorUtils.bright('\n=== PROGRESS SUMMARY ==='));
        
        const totalElapsed = this.startTime ? Date.now() - this.startTime : 0;
        
        console.log(`Total Duration: ${ColorUtils.cyan(this.formatDuration(totalElapsed))}`);
        console.log(`Tasks: ${ColorUtils.green(this.stats.completedTasks)} completed, ${ColorUtils.red(this.stats.failedTasks)} failed, ${ColorUtils.yellow(this.stats.totalTasks)} total`);
        console.log(`Items: ${ColorUtils.cyan(this.stats.processedItems)}/${this.stats.totalItems} processed`);

        // Show task details
        if (this.tasks.size > 0) {
            console.log(ColorUtils.bright('\nTask Details:'));
            
            this.tasks.forEach(task => {
                const statusIcon = task.status === 'completed' ? ColorUtils.green('✓') : 
                                 task.status === 'failed' ? ColorUtils.red('✗') : 
                                 ColorUtils.yellow('⧗');
                
                const duration = task.endTime ? this.formatDuration(task.duration) : 'running';
                const progress = task.totalItems > 0 ? 
                    `${task.processedItems}/${task.totalItems}` : 
                    `${task.processedItems} items`;
                
                console.log(`  ${statusIcon} ${task.description} - ${progress} (${duration})`);
                
                // Show errors
                if (task.errors.length > 0) {
                    console.log(ColorUtils.red(`    ${task.errors.length} errors`));
                }
                
                // Show subtasks
                if (task.subTasks.size > 0) {
                    task.subTasks.forEach(subTask => {
                        const subStatus = subTask.status === 'completed' ? ColorUtils.green('✓') : ColorUtils.yellow('⧗');
                        const subProgress = subTask.totalItems > 0 ? 
                            `${subTask.processedItems}/${subTask.totalItems}` : 
                            `${subTask.processedItems} items`;
                        
                        console.log(`    ${subStatus} ${subTask.description} - ${subProgress}`);
                    });
                }
            });
        }

        // Calculate success rate
        if (this.stats.totalTasks > 0) {
            const successRate = Math.round((this.stats.completedTasks / this.stats.totalTasks) * 100);
            console.log(`\nSuccess Rate: ${ColorUtils.cyan(successRate + '%')}`);
        }
    }

    // Get current status
    getStatus() {
        const currentTask = this.currentTask ? this.tasks.get(this.currentTask) : null;
        const totalElapsed = this.startTime ? Date.now() - this.startTime : 0;

        return {
            isRunning: !!this.currentTask,
            currentTask: currentTask ? {
                id: currentTask.id,
                description: currentTask.description,
                progress: currentTask.totalItems > 0 ? 
                    Math.round((currentTask.processedItems / currentTask.totalItems) * 100) : 0,
                processedItems: currentTask.processedItems,
                totalItems: currentTask.totalItems,
                currentItem: currentTask.currentItem,
                estimatedTimeRemaining: this.estimateRemainingTime(currentTask.id)
            } : null,
            stats: { ...this.stats },
            totalElapsed,
            tasks: Array.from(this.tasks.values()).map(task => ({
                id: task.id,
                description: task.description,
                status: task.status,
                processedItems: task.processedItems,
                totalItems: task.totalItems,
                duration: task.endTime ? task.duration : Date.now() - task.startTime,
                errors: task.errors.length
            }))
        };
    }

    // Export progress data for analysis
    exportData() {
        return {
            summary: {
                totalDuration: this.startTime ? Date.now() - this.startTime : 0,
                stats: { ...this.stats }
            },
            tasks: Array.from(this.tasks.entries()).map(([id, task]) => ({
                id,
                description: task.description,
                status: task.status,
                startTime: task.startTime,
                endTime: task.endTime,
                duration: task.duration,
                totalItems: task.totalItems,
                processedItems: task.processedItems,
                errors: task.errors,
                subTasks: Array.from(task.subTasks.values())
            }))
        };
    }

    // Reset all progress tracking
    reset() {
        this.clearProgress();
        this.tasks.clear();
        this.currentTask = null;
        this.startTime = null;
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            totalItems: 0,
            processedItems: 0
        };
    }

    // Pause current task
    pauseTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        task.status = 'paused';
        task.pausedAt = Date.now();
        
        console.log(ColorUtils.yellow(`⏸ Paused: ${task.description}`));
    }

    // Resume paused task
    resumeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'paused') return;

        const pauseDuration = Date.now() - task.pausedAt;
        task.startTime += pauseDuration; // Adjust start time to exclude pause duration
        task.status = 'running';
        delete task.pausedAt;
        
        console.log(ColorUtils.green(`▶ Resumed: ${task.description}`));
    }

    // Create progress bar string for external use
    createProgressBar(current, total, length = 20) {
        const percentage = Math.round((current / total) * 100);
        const filledLength = Math.round((length * current) / total);
        
        return {
            bar: '█'.repeat(filledLength) + '░'.repeat(length - filledLength),
            percentage,
            text: `[${this.createProgressBar(current, total, length).bar}] ${percentage}% (${current}/${total})`
        };
    }

    // Set custom progress display format
    setProgressFormat(taskId, formatter) {
        const task = this.tasks.get(taskId);
        if (!task) return;

        task.customFormatter = formatter;
    }

    // Cleanup resources
    cleanup() {
        this.clearProgress();
        this.tasks.clear();
        this.currentTask = null;
    }
}

module.exports = ProgressTracker;