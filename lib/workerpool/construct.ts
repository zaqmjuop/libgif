/**
 * Special message sent by parent which causes a child process worker to terminate itself.
 * Not a "message object"; this string is the entire message.
 */
export const TERMINATE_METHOD_ID = '__workerpool-terminate__'

/**
 * If sending `TERMINATE_METHOD_ID` does not cause the child process to exit in this many milliseconds,
 * force-kill the child process.
 */
export const CHILD_PROCESS_EXIT_TIMEOUT = 1000 
