/**
 * Heylock: AI-powered messaging, rewriting, sorting, and context management client.
 * @module Heylock
 */

export default class Heylock {
  /**
   * Public read-only quota properties for each API type.
   * Updated after every successful API call. Retain previous value if headers/limits missing.
   * @type {number|null}
   */
  get remainingMessages() { return this._remainingMessages; }
  get remainingSorts() { return this._remainingSorts; }
  get remainingRewrites() { return this._remainingRewrites; }
  get remainingIndexingEvents() { return this._remainingIndexingEvents; }

  // Internal storage for quota values
  _remainingMessages = null;
  _remainingSorts = null;
  _remainingRewrites = null;
  _remainingIndexingEvents = null;

  /**
   * Create a new Heylock agent instance.
   * @param {string} key - Agent key for authentication
   * @param {boolean} [saveHistory=true] - Whether to save message history
   * @param {boolean} [saveContextInCookies=true] - Whether to persist context in cookies (browser only)
   */
  constructor(key, saveHistory = true, saveContextInCookies = true) {
    this.key = key;
    this.saveHistory = saveHistory;
    this.saveContextInCookies = saveContextInCookies;
    this._keyValidated = false;
    
    // Basic key validation
    if (!this.key || typeof this.key !== 'string' || this.key.trim().length === 0) {
      throw new Error("Agent key is required and must be a non-empty string.");
    }
    
    // Validate the key immediately during initialization
    this._validateKey().catch(error => {
      console.error('Key validation failed during initialization:', error.message);
      // Store the validation error to throw it on first method call
      this._keyValidationError = error;
    });
    
    // Load context from cookie if persistence enabled
    if (this.saveContextInCookies && typeof document !== 'undefined') {
      this._loadContextFromCookie();
    }

    // Check limits on initialization and update quota properties
    // This is async, but we do not block constructor; errors are logged and do not throw
    this.getLimits().then(limitsResult => {
      if (limitsResult && limitsResult.limits) {
        this._updateQuotaFromHeaders(new Map(), limitsResult.limits);
      }
    }).catch(err => {
      // Do not throw, just log
      console.warn('Failed to fetch limits on initialization:', err);
    });


  }

  /**
   * Stores the conversation history as an array of message objects.
   * @type {Array<{role: 'user' | 'assistant', content: string}>}
   */
  messageHistory = [];

  /**
   * Stores the context history as an array of context entries.
   * @type {Array<{message: string, timestamp: number}>}
   */
  contextHistory = [];

  /**
   * Send a message to the Heylock AI and receive a response.
   * @param {string} message - The message to send
   * @param {Array<{role: 'user' | 'assistant', content: string}>} [history=[]] - Optional conversation history
   * @returns {Promise<string>} - The AI's response
   */
  async message(message = null, history = []) {
    // Check network connectivity
    this._checkNetworkConnectivity();
    
    // Check if there was a key validation error during initialization
    if (this._keyValidationError) {
      throw this._keyValidationError;
    }
    
    // Validate API key on first network call
    await this._validateKey();
    
    //#region | Validate arguments
    if(typeof(message) !== "string" || message.length === 0){
      throw new Error("Message function must get a non-empty string in the message argument."); //Rewrite + leave room for docs link
    }

    if(history){
      if(!Array.isArray(history)){
        throw new Error("History must be a valid array of messages. Example: [{ role: \"user\", content: \"Hi there!\"}, { role: \"assustant\", content: \"Hi! How can I help you?\"}] This field is not required."); // Same here
      }

      // Validate array structure
      for (let i = 0; i < history.length; i++) {
        const msg = history[i];
        if (!msg || typeof msg !== 'object') {
          throw new Error(`History array item at index ${i} must be an object.`);
        }
        if (!msg.role || !msg.content) {
          throw new Error(`History array item at index ${i} must have 'role' and 'content' properties.`);
        }
        if (typeof msg.role !== 'string' || typeof msg.content !== 'string') {
          throw new Error(`History array item at index ${i}: 'role' and 'content' must be strings.`);
        }
        if (!['user', 'assistant'].includes(msg.role)) {
          throw new Error(`History array item at index ${i}: 'role' must be either 'user' or 'assistant'.`);
        }
      }
    }
    //#endregion

    //#region | Send a request
    // Determine which history to use: provided history overrides saved history
    const effectiveHistory = history.length > 0 ? history : this.messageHistory;

    try{
      const messageResponse = await fetch("https://heylock.dev/api/v1/message", {
        method: 'POST',
        headers: {
          'Authorization': this.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message,
          history: effectiveHistory,
          stream: false,
          context: this.getContextAsString()
        })
      });

      await this._handleCommonErrors(messageResponse);

      this._updateQuotaFromHeaders(messageResponse.headers);
          
      if(messageResponse.status === 200){
        let outputMessage = "";

        try{
          outputMessage = (await messageResponse.json()).message;

          if(typeof(outputMessage) !== "string"){
            throw new Error("Something went wrong with the response from the server. Check your connection settings or update the package.");
          }
        } catch(parsingError){
          throw parsingError;
        }

        // Save message history if saveHistory is true
        if(this.saveHistory) {
          // Add user message to history
          this.messageHistory.push({ role: "user", content: message });
          // Add assistant response to history
          this.messageHistory.push({ role: "assistant", content: outputMessage });
        }

        return outputMessage;
      } else {
        throw new Error(`HTTP status: ${messageResponse.status} - ${messageResponse.statusText}`);
      }
    } catch(fetchError){
      if(navigator.onLine === false){ // In node.js always returns undefined.
        throw new Error("You're offline");
      }
      else if(fetchError instanceof TypeError){
        throw new Error("Something is wrong with the server or your network. Try again later.");
      }
      else {
        throw fetchError;
      }
    }
    //#endregion
  }

  /**
   * Streams a message response from the AI model in real-time chunks.
   * @param {string} message - The message to send
   * @param {Array<{role: 'user' | 'assistant', content: string}>} [history=[]] - Optional conversation history
   * @yields {string} - Message chunks as they arrive
   */
  async *messageStream(message = null, history = []) {
    // Check network connectivity
    this._checkNetworkConnectivity();
    
    // Check if there was a key validation error during initialization
    if (this._keyValidationError) {
      throw this._keyValidationError;
    }
    
    // Validate API key on first network call
    await this._validateKey();
    
    //#region | Validate arguments
    if(typeof(message) !== "string" || message.length === 0){
      throw new Error("Message function must get a non-empty string in the message argument."); //Rewrite + leave room for docs link
    }

    if(history){
      if(!Array.isArray(history)){
        throw new Error("History must be a valid array of messages. Example: [{ role: \"user\", content: \"Hi there!\"}, { role: \"assustant\", content: \"Hi! How can I help you?\"}] This field is not required."); // Same here
      }

      // Validate array structure
      for (let i = 0; i < history.length; i++) {
        const msg = history[i];
        if (!msg || typeof msg !== 'object') {
          throw new Error(`History array item at index ${i} must be an object.`);
        }
        if (!msg.role || !msg.content) {
          throw new Error(`History array item at index ${i} must have 'role' and 'content' properties.`);
        }
        if (typeof msg.role !== 'string' || typeof msg.content !== 'string') {
          throw new Error(`History array item at index ${i}: 'role' and 'content' must be strings.`);
        }
        if (!['user', 'assistant'].includes(msg.role)) {
          throw new Error(`History array item at index ${i}: 'role' must be either 'user' or 'assistant'.`);
        }
      }
    }
    //#endregion

    //#region | Send a streaming request
    // Determine which history to use: provided history overrides saved history
    const effectiveHistory = history.length > 0 ? history : this.messageHistory;

    try {
      const messageResponse = await fetch("https://heylock.dev/api/v1/message", {
        method: 'POST',
        headers: {
          'Authorization': this.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message,
          history: effectiveHistory,
          stream: true,
          context: this.getContextAsString()
        })
      });
      await this._handleCommonErrors(messageResponse);
      
      this._updateQuotaFromHeaders(messageResponse.headers);
          
      if(messageResponse.status === 200){
        const reader = messageResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullMessage = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // Keep the last incomplete line in buffer
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              
              if (trimmedLine === '') continue;
              
              try {
                const chunk = JSON.parse(trimmedLine);
                
                if (chunk.message && !chunk.done) {
                  fullMessage += chunk.message;
                  yield chunk.message;
                } else if (chunk.done) {
                  // Save message history if saveHistory is true
                  if(this.saveHistory) {
                    // Add user message to history
                    this.messageHistory.push({ role: "user", content: message });
                    // Add assistant response to history
                    this.messageHistory.push({ role: "assistant", content: fullMessage });
                  }
                  return fullMessage;
                }
                
              } catch (parseError) {
                // Continue processing other chunks in case of parsing errors
              }
            }
          }
        } catch (streamError) {
          throw new Error(`Streaming error: ${streamError.message}`);
        }
      } else {
        throw new Error(`HTTP status: ${messageResponse.status} - ${messageResponse.statusText}`);
      }
    } catch(fetchError){
      if(navigator.onLine === false){ // In node.js always returns undefined.
        throw new Error("You're offline");
      }
      else if(fetchError instanceof TypeError){
        throw new Error("Something is wrong with the server or your network. Try again later.");
      }
      else {
        throw fetchError;
      }
    }
    //#endregion
  }

  /**
   * Rewrite a given text using the AI, optionally following user instructions.
   * @param {string} text - The text to rewrite
   * @param {string|null} [instructions=null] - Optional instructions for rewriting
   * @returns {Promise<string>} - The rewritten text
   */
  async rewrite(text = null, instructions = null) {
    // Check network connectivity
    this._checkNetworkConnectivity();
    
    // Check if there was a key validation error during initialization
    if (this._keyValidationError) {
      throw this._keyValidationError;
    }
    
    // Validate API key on first network call
    await this._validateKey();
    
    //#region | Validate arguments
    if(typeof(text) !== "string" || text.length === 0){
      throw new Error("Rewrite function must get a non-empty string in the text argument.");
    }

    if(instructions !== null && typeof(instructions) !== "string"){
      throw new Error("Instructions must be a string or null.");
    }
    //#endregion

    //#region | Send a request
    try{
      const rewriteResponse = await fetch("https://heylock.dev/api/v1/rewrite", {
        method: 'POST',
        headers: {
          'Authorization': this.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          instructions: instructions,
          context: this.getContextAsString()
        })
      });

      await this._handleCommonErrors(rewriteResponse);
          
      if(rewriteResponse.status === 200){
        let outputText = "";

        try{
          outputText = (await rewriteResponse.json()).text;

          this._updateQuotaFromHeaders(rewriteResponse.headers);

          if(typeof(outputText) !== "string"){
            throw new Error("Something went wrong with the response from the server. Check your connection settings or update the package.");
          }
        } catch(parsingError){
          throw parsingError;
        }

        return outputText;
      } else {
        throw new Error(`HTTP status: ${rewriteResponse.status} - ${rewriteResponse.statusText}`);
      }
    } catch(fetchError){
      if(navigator.onLine === false){ // In node.js always returns undefined.
        throw new Error("You're offline");
      }
      else if(fetchError instanceof TypeError){
        throw new Error("Something is wrong with the server or your network. Try again later.");
      }
      else {
        throw fetchError;
      }
    }
    //#endregion
  }

  /**
   * Sort a list using the AI, optionally following user instructions.
   * @param {Array} list - The array to sort
   * @param {string|null} [instructions=null] - Optional instructions for sorting
   * @returns {Promise<{indexes: number[], reasoning: string, fallback?: boolean}>} - Sorted indexes and reasoning
   */
  async sort(list = null, instructions = null) {
    // Check network connectivity
    this._checkNetworkConnectivity();
    
    // Check if there was a key validation error during initialization
    if (this._keyValidationError) {
      throw this._keyValidationError;
    }
    
    // Validate API key on first network call
    await this._validateKey();
    
    //#region | Validate arguments
    if(!list || typeof list !== "object" || list.length === undefined || list.length === 0){
      throw new Error("Sort function must get a non-empty array in the list argument.");
    }

    if(instructions !== null && typeof(instructions) !== "string"){
      throw new Error("Instructions must be a string or null.");
    }

    // If array has only one element, return object with indexes and reasoning without API call
    if(list.length === 1){
      return {
        indexes: [0],
        reasoning: "Array contains only one element, no sorting needed."
      };
    }
    //#endregion

    //#region | Send a request
    try{
      const sortResponse = await fetch("https://heylock.dev/api/v1/sort", {
        method: 'POST',
        headers: {
          'Authorization': this.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          list: list,
          instructions: instructions,
          context: this.getContextAsString()
        })
      });

      await this._handleCommonErrors(sortResponse);
          
      if(sortResponse.status === 200){
        try{
          this._updateQuotaFromHeaders(sortResponse.headers);

          const responseData = await sortResponse.json();

          // Validate response structure
          if(!responseData.indexes || !Array.isArray(responseData.indexes)){
            throw new Error("Invalid response format: indexes field is missing or not an array.");
          }

          if(typeof(responseData.reasoning) !== "string"){
            throw new Error("Invalid response format: reasoning field is missing or not a string.");
          }

          // Return the complete object with indexes and reasoning
          return {
            indexes: responseData.indexes,
            reasoning: responseData.reasoning,
            fallback: responseData.fallback || false
          };
        } catch(parsingError){
          throw parsingError;
        }
      } else {
        throw new Error(`HTTP status: ${sortResponse.status} - ${sortResponse.statusText}`);
      }
    } catch(fetchError){
      if(navigator.onLine === false){ // In node.js always returns undefined.
        throw new Error("You're offline");
      }
      else if(fetchError instanceof TypeError){
        throw new Error("Something is wrong with the server or your network. Try again later.");
      }
      else {
        throw fetchError;
      }
    }
    //#endregion
  }
  
  /**
   * Ask the AI if it should engage based on provided instructions and context.
   * @param {string|null} [instructions=null] - Optional instructions
   * @returns {Promise<{shouldEngage: boolean, reasoning: string, fallback?: boolean}>}
   */
  async shouldEngage(instructions = null) {
    // Check network connectivity
    this._checkNetworkConnectivity();
    
    // Check if there was a key validation error during initialization
    if (this._keyValidationError) {
      throw this._keyValidationError;
    }
    
    // Validate API key on first network call
    await this._validateKey();
    
    //#region | Validate arguments
    if(instructions !== null && typeof(instructions) !== "string"){
      throw new Error("Instructions must be a string or null.");
    }
    //#endregion

    //#region | Send a request
    try{
      const shouldEngageResponse = await fetch("https://heylock.dev/api/v1/should-engage", {
        method: 'POST',
        headers: {
          'Authorization': this.key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instructions: instructions,
          context: this.getContextAsString()
        })
      });

      await this._handleCommonErrors(shouldEngageResponse);
          
      if(shouldEngageResponse.status === 200){
        let responseData = null;

        try{
          this._updateQuotaFromHeaders(shouldEngageResponse.headers);

          responseData = await shouldEngageResponse.json();

          if(typeof(responseData.shouldEngage) !== "boolean" || typeof(responseData.reasoning) !== "string"){
            throw new Error("Something went wrong with the response from the server. Check your connection settings or update the package.");
          }
        } catch(parsingError){
          throw parsingError;
        }

        return {
          shouldEngage: responseData.shouldEngage,
          reasoning: responseData.reasoning,
          fallback: responseData.fallback || false
        };
      } else {
        throw new Error(`HTTP status: ${shouldEngageResponse.status} - ${shouldEngageResponse.statusText}`);
      }
    } catch(fetchError){
      if(navigator.onLine === false){ // In node.js always returns undefined.
        throw new Error("You're offline");
      }
      else if(fetchError instanceof TypeError){
        throw new Error("Something is wrong with the server or your network. Try again later.");
      }
      else {
        throw fetchError;
      }
    }
    //#endregion
  }

  /**
   * Generate a greeting message, optionally following user instructions and using conversation history.
   * @param {string|null} [instructions=null] - Optional instructions for the greeting
   * @returns {Promise<string>} - The greeting message
   */
  async greet(instructions = null) {
    //#region | Validate arguments
    if(instructions !== null && typeof(instructions) !== "string"){
      throw new Error("Instructions must be a string or null.");
    }
    //#endregion

    //#region | Generate greeting message
    let greetingPrompt = "Provide a friendly short greeting encouraging user to interact with you.";
    
    if(instructions) {
      greetingPrompt = `Provide a greeting following these instructions: ${instructions}`;
    }
    
    // Check if there's message history to personalize the greeting
    if(this.messageHistory.length > 0) {
      greetingPrompt += " Take into account our previous conversation history to make the greeting more personalized and contextual.";
    }

    try {
      // Use the current message history but don't save the greeting prompt
      const greeting = await this.message(greetingPrompt, this.messageHistory);
      return greeting;
    } catch(error) {
      this._updateQuotaFromHeaders(resp.headers, data.limits);
      throw new Error(`Failed to generate greeting: ${error.message}`);
    }
    //#endregion
  }

  //#region | Context System Methods

  /**
   * Add a new context entry with automatic timestamp.
   * @param {string} message - Description of user action
   */

  /**
   * Update quota properties from response headers and/or limits object.
   * Called after every API call. If headers or limits are missing, previous values are retained.
   * @private
   * @param {Headers} headers - Response headers
   * @param {object} [limits] - Optional limits object from /limits endpoint
   */
  _updateQuotaFromHeaders(headers, limits = null) {
    // Try to get from headers first (for message calls)
    const msgRemaining = headers.get('X-RateLimit-Remaining');
    if (msgRemaining !== null && msgRemaining !== undefined && msgRemaining !== '') {
      this._remainingMessages = isNaN(Number(msgRemaining)) ? null : Number(msgRemaining);
    }

    // If limits object provided (from /limits endpoint), update all types
    if (limits && typeof limits === 'object') {
      if (limits.messages && typeof limits.messages.remaining === 'number') {
        this._remainingMessages = limits.messages.remaining;
      }
      if (limits.sorts && typeof limits.sorts.remaining === 'number') {
        this._remainingSorts = limits.sorts.remaining;
      }
      if (limits.rewrites && typeof limits.rewrites.remaining === 'number') {
        this._remainingRewrites = limits.rewrites.remaining;
      }
      if (limits.indexing_events && typeof limits.indexing_events.remaining === 'number') {
        this._remainingIndexingEvents = limits.indexing_events.remaining;
      }
    }
    // For other endpoints, try to get from headers if available
    const sortsRemaining = headers.get('X-RateLimit-Sorts-Remaining');
    if (sortsRemaining !== null && sortsRemaining !== undefined && sortsRemaining !== '') {
      this._remainingSorts = isNaN(Number(sortsRemaining)) ? null : Number(sortsRemaining);
    }
    const rewritesRemaining = headers.get('X-RateLimit-Rewrites-Remaining');
    if (rewritesRemaining !== null && rewritesRemaining !== undefined && rewritesRemaining !== '') {
      this._remainingRewrites = isNaN(Number(rewritesRemaining)) ? null : Number(rewritesRemaining);
    }
    const indexingEventsRemaining = headers.get('X-RateLimit-IndexingEvents-Remaining');
    if (indexingEventsRemaining !== null && indexingEventsRemaining !== undefined && indexingEventsRemaining !== '') {
      this._remainingIndexingEvents = isNaN(Number(indexingEventsRemaining)) ? null : Number(indexingEventsRemaining);
    }
  }

  addContext(message) {
    //#region | Validate arguments
    if (typeof(message) !== "string" || message.length === 0) {
      throw new Error("addContext function must get a non-empty string in the message argument.");
    }

    if (message.length > 3900) {
      throw new Error("Context message is too long. Maximum length is 3900 characters.");
    }
    //#endregion

    //#region | Add context entry
    const contextEntry = {
      message: message,
      timestamp: Date.now()
    };

    // Check if adding this entry would exceed the 4000 character limit
    const tempHistory = [...this.contextHistory, contextEntry];
    const tempString = this._formatContextString(tempHistory);
    
    if (tempString.length > 4000) {
      this._cleanupContextForSize();
    }

    // Add the new entry
    this.contextHistory.push(contextEntry);

    // Save to cookie if persistence enabled
    if (this.saveContextInCookies) {
      try {
        this._saveContextToCookie();
      } catch (cookieError) {
        // Continue operation without cookies
        console.warn('Context cookie save failed:', cookieError);
      }
    }
    //#endregion
  }

  /**
   * Retrieve a copy of the context history array.
   * @returns {Array<{message: string, timestamp: number}>}
   */
  getContext() {
    return [...this.contextHistory]; // Return shallow copy
  }

  /**
   * Format context for API usage.
   * @returns {string}
   */
  getContextAsString() {
    if (this.contextHistory.length === 0) {
      return "";
    }

    return this._formatContextString(this.contextHistory);
  }

  /**
   * Empty the context history and clear context cookie if enabled.
   */
  clearContext() {
    this.contextHistory = [];
    
    // Clear context cookie if persistence enabled
    if (this.saveContextInCookies && typeof document !== 'undefined') {
      try {
        document.cookie = "heylock_context=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      } catch (cookieError) {
        console.warn('Context cookie clear failed:', cookieError);
      }
    }
  }

  //#endregion

  /**
   * Retrieve current usage limits and remaining quotas for the API key.
   * @returns {Promise<{plan: string, planExpires: number|null, limits: any, headers: any}>}
   */
  async getLimits() {
    this._checkNetworkConnectivity();

    if (this._keyValidationError) throw this._keyValidationError;
    await this._validateKey();

    try {
      const resp = await fetch("https://heylock.dev/api/v1/limits", {
        method: 'GET',
        headers: {
          'Authorization': this.key,
          'Content-Type': 'application/json'
        }
      });
      await this._handleCommonErrors(resp);

      const data = await resp.json();
      const headers = this._parseRateLimitHeaders(resp.headers);
      
      return { ...data, headers };
    } catch (err) {
      if (navigator.onLine === false) throw new Error("You're offline");
      if (err instanceof TypeError) throw new Error("Something is wrong with the server or your network. Try again later.");
      throw err;
    }
  }

  //////////////// Internal helpers ////////////////

  /**
   * Parse rate limit and plan headers from a Response headers object.
   * @private
   */
  _parseRateLimitHeaders(headers) {
    const limitRaw = headers.get('X-RateLimit-Limit');
    const remainingRaw = headers.get('X-RateLimit-Remaining');
    const resetRaw = headers.get('X-RateLimit-Reset');
    const plan = headers.get('X-Plan') || null;
    const planExpiresRaw = headers.get('X-Plan-Expires');

    const toNum = (v) => (v == null || v === '' || v === 'unlimited' || v === 'unknown') ? null : Number(v);

    const limit = toNum(limitRaw);
    const remaining = toNum(remainingRaw);
    const reset = toNum(resetRaw);
    const resetAt = reset ? new Date(reset * 1000) : null;
    const planExpires = toNum(planExpiresRaw);
    const planExpiresAt = planExpires ? new Date(planExpires * 1000) : null;

    return { limit, remaining, reset, resetAt, plan, planExpires, planExpiresAt, raw: { limitRaw, remainingRaw, resetRaw, plan, planExpiresRaw } };
  }

  /**
   * Handle common non-200 responses and throw appropriate errors, including quota (429).
   * @private
   */
  async _handleCommonErrors(response) {
    if (response.status === 200) return;

    if (response.status === 400) {
      try {
        const body = await response.json();
        throw new Error(body?.error || 'Bad request');
      } catch (_) {
        throw new Error('Bad request');
      }
    }

    if (response.status === 401) {
      throw new Error('Unauthorized. Check the key argument. Keep in mind that you need to use the latest generated key.');
    }

    if (response.status === 429) {
      let body = null;
      try { body = await response.json(); } catch (_) {}
      const headers = this._parseRateLimitHeaders(response.headers);
      const err = new Error(body?.detail || body?.error || 'Quota exceeded');
      err.name = 'HeylockQuotaError';
      err.code = 429;
      err.limit = headers.limit;
      err.remaining = headers.remaining;
      err.reset = headers.reset;
      err.resetAt = headers.resetAt;
      err.plan = headers.plan;
      err.planExpires = headers.planExpires;
      err.planExpiresAt = headers.planExpiresAt;
      err.headers = headers;
      throw err;
    }

    if (response.status === 500) {
      throw new Error('Something went bad. Try again later or check your internet connection.');
    }

    throw new Error(`HTTP status: ${response.status} - ${response.statusText}`);
  }

  //#region | Context System Helper Methods

  /**
   * Load context from cookie on initialization
   * @private
   */
  _loadContextFromCookie() {
    try {
      const cookies = document.cookie.split(';');
      const contextCookie = cookies.find(cookie => cookie.trim().startsWith('heylock_context='));
      
      if (contextCookie) {
        const contextValue = contextCookie.split('=')[1];
        const decodedValue = decodeURIComponent(contextValue);
        const parsedContext = JSON.parse(decodedValue);
        
        if (Array.isArray(parsedContext)) {
          this.contextHistory = parsedContext;
        }
      }
    } catch (error) {
      // If cookie loading fails, start with empty context
      this.contextHistory = [];
      console.warn('Context cookie load failed:', error);
    }
  }

  /**
   * Save context to cookie
   * @private
   */
  _saveContextToCookie() {
    if (typeof document === 'undefined') return; // Node.js environment
    
    const contextString = JSON.stringify(this.contextHistory);
    if (contextString.length <= 4000) {
      document.cookie = `heylock_context=${encodeURIComponent(contextString)}; path=/`;
    } else {
      // Trigger cleanup and retry
      this._cleanupContextForSize();
      const cleanedString = JSON.stringify(this.contextHistory);
      document.cookie = `heylock_context=${encodeURIComponent(cleanedString)}; path=/`;
    }
  }

  /**
   * Format context history as string
   * @private
   * @param {Array} contextArray - Context history array to format
   * @returns {string}
   */
  _formatContextString(contextArray) {
    if (contextArray.length === 0) {
      return "";
    }

    // Sort entries chronologically (oldest first)
    const sortedContext = [...contextArray].sort((a, b) => a.timestamp - b.timestamp);
    
    const now = Date.now();
    const lines = ["User actions in chronological order:"];
    
    for (const entry of sortedContext) {
      const timeDiff = now - entry.timestamp;
      const timeAgo = this._formatTimeAgo(timeDiff);
      lines.push(`- ${timeAgo}: ${entry.message}`);
    }
    
    const result = lines.join('\n');
    
    // If approaching 4000 characters, truncate keeping most recent entries
    if (result.length > 4000) {
      const recentEntries = sortedContext.slice(-10); // Keep last 10 entries
      const truncatedLines = ["User actions in chronological order:"];
      
      for (const entry of recentEntries) {
        const timeDiff = now - entry.timestamp;
        const timeAgo = this._formatTimeAgo(timeDiff);
        truncatedLines.push(`- ${timeAgo}: ${entry.message}`);
      }
      
      return truncatedLines.join('\n');
    }
    
    return result;
  }

  /**
   * Convert milliseconds to human-readable time ago format
   * @private
   * @param {number} milliseconds - Time difference in milliseconds
   * @returns {string}
   */
  _formatTimeAgo(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
    }
  }

  /**
   * Remove oldest entries to fit within size limit (FIFO cleanup)
   * @private
   */
  _cleanupContextForSize() {
    while (this.contextHistory.length > 1) {
      // Remove oldest entry
      this.contextHistory.shift();
      
      // Check if we're now within the limit
      const testString = this._formatContextString(this.contextHistory);
      if (testString.length <= 4000) {
        break;
      }
    }
  }

  //#endregion

  //#region | Network and Key Validation Methods

  /**
   * Validate the API key using the verifyKey endpoint
   * @private
   */
  async _validateKey() {
    if (this._keyValidated) {
      return; // Key already validated
    }

    try {
      const verifyResponse = await fetch("https://heylock.dev/api/internal/verifyKey", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: this.key
        })
      });

      if (verifyResponse.status === 400) {
        throw new Error("Invalid request format during key validation.");
      } else if (verifyResponse.status === 500) {
        throw new Error("Server error during key validation. Please try again later.");
      } else if (verifyResponse.status !== 200) {
        throw new Error(`Key validation failed with status: ${verifyResponse.status}`);
      }

      const responseData = await verifyResponse.json();
      
      if (!responseData.valid) {
        throw new Error("Invalid API key. Please check your key and ensure it's the latest generated key.");
      }

      this._keyValidated = true;
    } catch (fetchError) {
      if (fetchError instanceof TypeError) {
        throw new Error("Network error during key validation. Please check your internet connection and server availability.");
      } else {
        throw fetchError;
      }
    }
  }

  /**
   * Check network connectivity for Node.js environment
   * @private
   */
  _checkNetworkConnectivity() {
    // In Node.js environment, we need to check connectivity differently
    // since navigator.onLine is not available or always returns undefined
    if (typeof navigator === 'undefined' || navigator.onLine === undefined) {
      // Node.js environment - basic check
      // We can't do synchronous DNS lookup without blocking, so we'll do a basic check
      // The actual network error will be caught by the fetch calls themselves
      return;
    } else {
      // Browser environment
      if (navigator.onLine === false) {
        throw new Error("You're offline. Please check your internet connection.");
      }
    }
  }

  //#endregion
}