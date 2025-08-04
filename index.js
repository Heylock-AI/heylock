export default class Heylock {
    constructor(key, saveHistory = true, saveContextInCookies = true) {
        this.key = key;
        this.saveHistory = saveHistory;
        this.saveContextInCookies = saveContextInCookies;
        this._keyValidated = false;
        
        // Basic key validation
        if (!this.key || typeof this.key !== 'string' || this.key.trim().length === 0) {
            throw new Error("API key is required and must be a non-empty string.");
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
    }

    messageHistory = [];
    contextHistory = [];

    async message(message = null, history = []){
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
            const messageResponse = await fetch("http://localhost:3000/api/v1/message", { //PRODUCTION: Change the link as soon as the domain will be available.
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

            console.log(messageResponse.status);

            switch(messageResponse.status){
                case 400:
                    throw new Error((await messageResponse.json()).error);
                case 401:
                    throw new Error("Unauthorized. Check the key argument. Keep in mind that you need to use the latest generated key.");
                case 500:
                    throw new Error("Something went bad. Try again later or check your internet connection.");
            }
                
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
     * This function works like message() but returns streaming data as it's generated.
     *
     * @param {string} message - The message to send to the AI model
     * @param {Array} history - Optional conversation history array
     * @returns {AsyncGenerator<string>} - Yields message chunks as they arrive
     *
     * Usage Examples:
     *
     * // Basic streaming usage with for-await-of loop:
     * const heylock = new Heylock('your-api-key');
     * for await (const chunk of heylock.messageStream('Hello, how are you?')) {
     *     process.stdout.write(chunk); // Print each chunk as it arrives
     * }
     *
     * // Manual iteration for more control:
     * const stream = heylock.messageStream('Tell me a story');
     * let result = await stream.next();
     * while (!result.done) {
     *     console.log('Chunk:', result.value);
     *     result = await stream.next();
     * }
     *
     * // Collecting all chunks into a full message:
     * let fullMessage = '';
     * for await (const chunk of heylock.messageStream('Explain quantum physics')) {
     *     fullMessage += chunk;
     * }
     * console.log('Complete response:', fullMessage);
     *
     * // With conversation history:
     * const history = [
     *     { role: 'user', content: 'What is JavaScript?' },
     *     { role: 'assistant', content: 'JavaScript is a programming language...' }
     * ];
     * for await (const chunk of heylock.messageStream('Can you give me an example?', history)) {
     *     console.log(chunk);
     * }
     *
     * // Error handling:
     * try {
     *     for await (const chunk of heylock.messageStream('Hello')) {
     *         console.log(chunk);
     *     }
     * } catch (error) {
     *     console.error('Streaming error:', error.message);
     * }
     */
    async *messageStream(message = null, history = []){
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

        try{
            const messageResponse = await fetch("http://localhost:3000/api/v1/message", { //PRODUCTION: Change the link as soon as the domain will be available.
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

            console.log(messageResponse.status);

            switch(messageResponse.status){
                case 400:
                    throw new Error((await messageResponse.json()).error);
                case 401:
                    throw new Error("Unauthorized. Check the key argument. Keep in mind that you need to use the latest generated key.");
                case 500:
                    throw new Error("Something went bad. Try again later or check your internet connection.");
                    
            }
                
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
                                console.error('Error parsing streaming chunk:', parseError);
                                // Continue processing other chunks
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

    async rewrite(text = null, instructions = null){
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
            const rewriteResponse = await fetch("http://localhost:3000/api/v1/rewrite", { //PRODUCTION: Change the link as soon as the domain will be available.
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

            console.log(rewriteResponse.status);

            switch(rewriteResponse.status){
                case 400:
                    throw new Error((await rewriteResponse.json()).error);
                case 401:
                    throw new Error("Unauthorized. Check the key argument. Keep in mind that you need to use the latest generated key.");
                case 500:
                    if(navigator.onLine === false){ // In node.js always returns undefined.
                        throw new Error("You're offline");
                    }

                    throw new Error("Something went bad. Try again later or check your internet connection.");
            }
                
            if(rewriteResponse.status === 200){
                let outputText = "";

                try{
                    outputText = (await rewriteResponse.json()).text;

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

    async sort(list = null, instructions = null){
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
            const sortResponse = await fetch("http://localhost:3000/api/v1/sort", { //PRODUCTION: Change the link as soon as the domain will be available.
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

            console.log(sortResponse.status);

            switch(sortResponse.status){
                case 400:
                    throw new Error((await sortResponse.json()).error);
                case 401:
                    throw new Error("Unauthorized. Check the key argument. Keep in mind that you need to use the latest generated key.");
                case 500:
                    throw new Error("Something went bad. Try again later or check your internet connection.");
            }
                
            if(sortResponse.status === 200){
                try{
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
    
    async shouldEngage(instructions = null){
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
            const shouldEngageResponse = await fetch("http://localhost:3000/api/v1/should-engage", { //PRODUCTION: Change the link as soon as the domain will be available.
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

            console.log(shouldEngageResponse.status);

            switch(shouldEngageResponse.status){
                case 400:
                    throw new Error((await shouldEngageResponse.json()).error);
                case 401:
                    throw new Error("Unauthorized. Check the key argument. Keep in mind that you need to use the latest generated key.");
                case 500:
                    throw new Error("Something went bad. Try again later or check your internet connection.");
            }
                
            if(shouldEngageResponse.status === 200){
                let responseData = null;

                try{
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

    async greet(instructions = null){
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
            throw new Error(`Failed to generate greeting: ${error.message}`);
        }
        //#endregion
    }

    //#region | Context System Methods

    /**
     * Add a new context entry with automatic timestamp
     * @param {string} message - Description of user action
     */
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
     * Retrieve copy of context history array
     * @returns {Array<{message: string, timestamp: number}>}
     */
    getContext() {
        return [...this.contextHistory]; // Return shallow copy
    }

    /**
     * Format context for API usage (primarily shouldEngage)
     * @returns {string}
     */
    getContextAsString() {
        if (this.contextHistory.length === 0) {
            return "";
        }

        return this._formatContextString(this.contextHistory);
    }

    /**
     * Empty the context history
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
            const verifyResponse = await fetch("http://localhost:3000/api/internal/verifyKey", {
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