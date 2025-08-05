/**
 * Heylock: AI-powered messaging, rewriting, sorting, and context management client.
 * @example
 * import Heylock from 'heylock';
 * 
 * // Initialize with API key
 * const heylock = new Heylock('your-api-key');
 */
declare class Heylock {
  /**
   * Create a new Heylock client instance.
   * @param key - API key for authentication
   * @param saveHistory - Whether to save message history (default: true)
   * @param saveContextInCookies - Whether to persist context in cookies (browser only, default: true)
   * @example
   * // Basic initialization
   * const heylock = new Heylock('your-api-key');
   * 
   * // With options
   * const heylock = new Heylock('your-api-key', false, false);
   */
  constructor(key: string, saveHistory?: boolean, saveContextInCookies?: boolean);

  /**
   * Stores the conversation history as an array of message objects.
   */
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>;

  /**
   * Stores the context history as an array of context entries.
   */
  contextHistory: Array<{ message: string; timestamp: number }>;

  /**
   * Send a message to the Heylock AI and receive a response.
   * @param message - The message to send
   * @param history - Optional conversation history
   * @returns The AI's response
   * @example
   * // Simple message
   * const response = await heylock.message('Hello!');
   * 
   * // With conversation history
   * const history = [
   *   { role: 'user', content: 'Hi there!' },
   *   { role: 'assistant', content: 'Hello! How can I help?' }
   * ];
   * const response = await heylock.message('What did I say?', history);
   */
  message(message: string, history?: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<string>;

  /**
   * Streams a message response from the AI model in real-time chunks.
   * @param message - The message to send
   * @param history - Optional conversation history
   * @yields Message chunks as they arrive
   * @example
   * // Process streaming response
   * for await (const chunk of heylock.messageStream('Tell me a story')) {
   *   console.log(chunk); // Each chunk of the response
   * }
   */
  messageStream(message: string, history?: Array<{ role: 'user' | 'assistant'; content: string }>): AsyncGenerator<string>;

  /**
   * Rewrite a given text using the AI, optionally following user instructions.
   * @param text - The text to rewrite
   * @param instructions - Optional instructions for rewriting
   * @returns The rewritten text
   * @example
   * // Simple rewrite
   * const rewritten = await heylock.rewrite('Hello world');
   * 
   * // Rewrite with instructions
   * const formal = await heylock.rewrite('Hi!', 'Make it more formal');
   */
  rewrite(text: string, instructions?: string | null): Promise<string>;

  /**
   * Sort a list using the AI, optionally following user instructions.
   * @param list - The array to sort
   * @param instructions - Optional instructions for sorting
   * @returns Sorted indexes and reasoning
   * @example
   * const items = ['apple', 'banana', 'orange'];
   * const result = await heylock.sort(items, 'Sort by sweetness');
   * console.log(result.indexes); // [1, 2, 0]
   * console.log(result.reasoning); // Explanation of the sorting
   */
  sort(list: any[], instructions?: string | null): Promise<{ indexes: number[]; reasoning: string; fallback?: boolean }>;

  /**
   * Ask the AI if it should engage based on provided instructions and context.
   * @param instructions - Optional instructions
   * @returns Whether to engage, reasoning, and fallback flag
   * @example
   * const result = await heylock.shouldEngage(
   *   'Engage if user seems interested in technical topics'
   * );
   * if (result.shouldEngage) {
   *   console.log('Engaging because:', result.reasoning);
   * }
   */
  shouldEngage(instructions?: string | null): Promise<{ shouldEngage: boolean; reasoning: string; fallback?: boolean }>;

  /**
   * Generate a greeting message, optionally following user instructions and using conversation history.
   * @param instructions - Optional instructions for the greeting
   * @returns The greeting message
   * @example
   * // Simple greeting
   * const greeting = await heylock.greet();
   * 
   * // Customized greeting
   * const greeting = await heylock.greet('Make it enthusiastic');
   */
  greet(instructions?: string | null): Promise<string>;

  /**
   * Add a new context entry with automatic timestamp.
   * @param message - Description of user action
   * @example
   * // Track user actions
   * heylock.addContext('User viewed pricing page');
   * heylock.addContext('User clicked signup button');
   */
  addContext(message: string): void;

  /**
   * Retrieve a copy of the context history array.
   * @returns The context history
   * @example
   * const history = heylock.getContext();
   * console.log(history); // [{message: '...', timestamp: 1234567890}]
   */
  getContext(): Array<{ message: string; timestamp: number }>;

  /**
   * Format context for API usage.
   * @returns The formatted context string
   * @example
   * const contextString = heylock.getContextAsString();
   * console.log(contextString); // "User actions in chronological order:..."
   */
  getContextAsString(): string;

  /**
   * Empty the context history and clear context cookie if enabled.
   */
  clearContext(): void;
}

export = Heylock;